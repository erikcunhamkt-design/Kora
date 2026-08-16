# Etapa 5 — CRM (crm_opportunities) — drafts de migration CHECK

> **Nada aplicado.** Extensão natural do draft de Clientes
> ([`etapa-5-flip-clientes-rodada3-check-drafts.md`](etapa-5-flip-clientes-rodada3-check-drafts.md)
> — mesma classe de achado, §2.2 daquele pacote, "fora de escopo" ali,
> investigado aqui). `public.crm_opportunities` tem 4 colunas de
> vocabulário sem CHECK: `stage`, `status`, `temperature`, `priority`
> (`supabase/migrations/20260530050000_create_crm_opportunities.sql:14-18`).
> Investiguei as 4 — **1 delas (`stage`) NÃO deve virar CHECK**, motivo
> abaixo. Achado de divergência real encontrado e reportado, não corrigido
> nem normalizado (instrução explícita: reportar, não decidir por conta).
>
> **Mesmo gate duplo do draft de Clientes:** Code não roda DDL contra
> produção (protocolo §0/§6/§8-b) — aplicação é do operador; e só depois de
> uma Fase D de homologação real ter rodado sobre o domínio (CRM/Fatia 2
> tem achados recentes ainda em fila — G57, G58/G59 tangencial via
> `handleConvertToClient`, R1/R2 de `useSupabaseOpportunities` migrando pra
> `useMutation` — não faz sentido travar vocabulário num domínio com essa
> volatilidade de código recente).

---

## 1. `stage` — NÃO É CANDIDATO A CHECK. Coluna é genuinamente dinâmica.

**Veredito, confirmado por leitura direta (não só pelo tipo TS):** o CRM
tem um editor de funis (`PipelineEditorDialog.tsx`, "Gerenciar funis") que
deixa o usuário criar pipelines e estágios customizados sem limite.
`usePipelines.ts:45`:
```ts
export const newStageId = () => `s_${Math.random().toString(36).slice(2, 9)}`;
```
`PipelineStage.id` é `string` livre — não um enum fixo. O caminho de
escrita ao vivo (arrastar card / "mover para" no menu) grava esse id
diretamente, sem allow-list, confirmado em `crmOpportunitiesRepository.ts:177-178`:
```ts
async moveOpportunityStage(workspaceId: string, opportunityId: string, stage: string) {
  const patch: Partial<SupabaseOpportunityInput> = { stage };
  // ...
```
Pra qualquer pipeline não-padrão, `stage` na nuvem será um id tipo
`s_k3j9fpq` — um CHECK com lista fixa de valores quebraria a funcionalidade
de funis customizados na primeira vez que alguém movesse um card. **Não
desenhado, não faz sentido desenhar.** A única coisa segura de reforçar
aqui é o que já existe: `NOT NULL` (já é a constraint atual, sem mudança
necessária).

### Achado de divergência (reportado, NÃO corrigido nesta rodada — instrução explícita)

O caminho de CRIAÇÃO (`CRM.tsx:1202`, `NewLeadDialog`) coage `stage` pra um
dos 6 valores do pipeline padrão (`known = ["lead","contato","proposta","negociacao","fechado","perdido"]`,
fallback `"lead"`) **mesmo quando o usuário está criando a oportunidade
dentro de um pipeline customizado** — descarta silenciosamente o estágio
customizado real selecionado. Já o caminho de MOVER estágio
(`moveOpportunityStage`, acima) grava o id customizado de verdade, sem essa
restrição. Ou seja: **o caminho de import/criação usa um vocabulário mais
estreito (6 valores fixos) que o caminho de movimentação ao vivo (qualquer
id customizado)** — mesma classe G40/G49 (mappers/produtores divergentes
do mesmo campo), mas aqui a superfície de divergência é "criar" vs "mover",
não "local" vs "nuvem". Tem um efeito prático: uma oportunidade criada
dentro de um funil customizado nasce classificada erradamente como
`"lead"` (estágio do funil padrão) em vez do estágio customizado
selecionado.

Efeito colateral relacionado, também não corrigido aqui: a derivação de
`status` ("won"/"lost") em `moveOpportunityStage`/`CRM.tsx:1203`/
`crmOpportunityMapper.ts:49` compara `stage === "fechado"`/`"perdido"`
LITERAL, não `PipelineStage.type === "won"/"lost"` — um funil customizado
com estágios de fechamento com id diferente nunca dispara `status:"won"`/`"lost"`
por esses caminhos (`markOpportunityWon`/`markOpportunityLost`, que fazem
isso certo por `status` direto, existem no repository mas não têm nenhum
chamador na UI — confirmado por grep, `useSupabaseOpportunities.ts` é o
único lugar que os referencia fora de testes).

**Não numerado nesta rodada** — achado de código (2 bugs latentes:
criação descarta estágio customizado; status não deriva certo em funis
customizados), não um gap de schema/CHECK. Fica pra quem decidir se abre
G-número e rodada própria pra CRM/pipelines customizados — fora do escopo
"drafts de CHECK" desta tarefa.

---

## 2. `status` — vocabulário fechado e consistente, CHECK seguro

3 valores, `open`/`won`/`lost`, batendo em TODOS os 5 pontos de escrita
encontrados (nenhum tem `<Select>` de UI — é sempre derivado, nunca
digitado):

- `crmOpportunitiesRepository.ts:183/187/192` (`moveOpportunityStage`)
- `crmOpportunitiesRepository.ts:201` (`markOpportunityWon`)
- `crmOpportunitiesRepository.ts:212` (`markOpportunityLost`)
- `CRM.tsx:1203` (criação)
- `crmOpportunityMapper.ts:49` (import)

Default da coluna já é `'open'`. Nenhuma divergência de VOCABULÁRIO
encontrada (a fragilidade é de LÓGICA — ver §1, não afeta os valores em si).

---

## 3. `temperature` — vocabulário fechado e consistente PRA ESTA TABELA, mas incompatível com `clients.temperature` (achado cross-table, reportado)

4 valores, `frio`/`morno`/`quente`/`não definida` — mesmo vocabulário de
`LeadTemperature` (`useLeads.ts:7`), minúsculo, sem divergência entre os
write paths: criação (`CRM.tsx:1205`), edição (`CRM.tsx:1273`, passthrough),
import (`crmOpportunityMapper.ts:51`, passthrough), 3 `<Select>` de UI
idênticos (`CRM.tsx:965-968`, `:1850-1853`, `:2002-2005`).

**Achado cross-table (reportado, não normalizado):** `Client.temperature`
(`useClients.ts:2`) é `"Frio"|"Morno"|"Quente"` — maiúsculo, só 3 valores,
SEM equivalente a `"não definida"`. É um vocabulário genuinamente diferente
do de `crm_opportunities.temperature`, e as duas tabelas não compartilham
constraint nem tradução automática — o único ponto do código que cruza os
dois hoje (`CRM.tsx:402`, lead-a-partir-de-cliente) já faz a tradução
manual e correta:
```ts
const tempMap: Record<string, LeadTemperature> = { Quente: "quente", Morno: "morno", Frio: "frio" };
// ...
temperature: (client.temperature && tempMap[client.temperature]) || "não definida",
```
Isso funciona HOJE porque é o único caminho que cruza as duas tabelas. Mas
os dois CHECKs (este e o de `clients.temperature`, já desenhado no draft
irmão) **não podem usar a mesma lista de valores** — são vocabulários
diferentes por design, não um erro a unificar. Registrado aqui pra quem
aplicar os 2 drafts não presumir que são a mesma coisa, e pra qualquer
caminho de escrita FUTURO que cruze `Client`→`crm_opportunities.temperature`
sem passar por esse `tempMap` ser pego antes de virar um valor inválido
silencioso.

---

## 4. `priority` — vocabulário fechado e consistente, CHECK seguro

3 valores, `alta`/`média`/`baixa` (mesmo vocabulário de `Priority`,
`useLeads.ts:5`) — sem divergência: criação (`CRM.tsx:1206`), edição
(`CRM.tsx:1274`, passthrough), import (`crmOpportunityMapper.ts:52`,
passthrough), `<Select>` do drawer de edição (`CRM.tsx:2009-2016`).
`tempToPriority` (`CRM.tsx:1698-1699`, deriva prioridade a partir de
temperatura no form de criação) só emite membros do mesmo conjunto.

---

## 5. Draft — `crm_opportunities_status_temperature_priority_known_chk`

**`stage` deliberadamente EXCLUÍDO deste draft** (§1). Nome de arquivo
sugerido, quando promovido a migration real (pós-Fase D, com "vai" do
revisor): `<timestamp>_etapa5_flip_crm_status_temperature_priority_known_chk.sql`.

```sql
-- Etapa 5 · CRM (crm_opportunities) — draft de CHECK preventivo
-- (docs/qa/etapa-5-flip-crm-rodada3-check-drafts.md), extensão do achado
-- de Clientes (etapa-5-flip-clientes-pacote.md §2.2). 3 das 4 colunas de
-- vocabulário de crm_opportunities (status/temperature/priority) têm
-- vocabulário fechado e consistente em todo write path (criação, edição,
-- import) — confirmado por leitura exaustiva, não só pelo tipo TS.
--
-- `stage` foi INVESTIGADO e DELIBERADAMENTE EXCLUÍDO deste draft — é
-- genuinamente dinâmico (ids de estágio customizados via "Gerenciar
-- funis", usePipelines.ts/PipelineEditorDialog.tsx), um CHECK de lista
-- fixa quebraria pipelines customizados na primeira movimentação de card.
-- Ver §1 do doc pra um achado de divergência real (criação vs. movimentação
-- de estágio) encontrado mas não corrigido nesta rodada.
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b) — aplicação é gate do operador, e só DEPOIS de
-- uma Fase D de homologação real ter rodado sobre o domínio CRM/Fatia 2
-- (achados recentes ainda em fila: G57, G58/G59 tangencial, migração de
-- useSupabaseOpportunities pra useMutation em andamento — código ainda
-- instável demais pra travar schema por cima).
--
-- Passo do operador ANTES de aplicar: confirmar que não há linha em
-- public.crm_opportunities com status/temperature/priority fora do
-- vocabulário abaixo (expectativa é ZERO — confirmar, não supor):
--   SELECT DISTINCT status FROM public.crm_opportunities WHERE status IS NOT NULL AND status NOT IN ('open','won','lost');
--   SELECT DISTINCT temperature FROM public.crm_opportunities WHERE temperature IS NOT NULL AND temperature NOT IN ('frio','morno','quente','não definida');
--   SELECT DISTINCT priority FROM public.crm_opportunities WHERE priority IS NOT NULL AND priority NOT IN ('alta','média','baixa');
-- Se qualquer uma das 3 queries devolver linha, PARAR — não aplicar este
-- CHECK sem decidir o que fazer com o dado fora do vocabulário primeiro.
--
-- ATENÇÃO — vocabulário de temperature aqui é DIFERENTE (case e
-- cardinalidade) do de public.clients.temperature (draft irmão,
-- etapa-5-flip-clientes-rodada3-check-drafts.md) — 'frio'/'morno'/'quente'/
-- 'não definida' minúsculo aqui vs. 'Frio'/'Morno'/'Quente' maiúsculo lá,
-- SEM 'não definida' equivalente. NÃO são a mesma constraint, não
-- unificar por engano.
--
-- NULL é permitido nas 3 (colunas nullable hoje, sem NOT NULL) — este
-- CHECK não força preenchimento, só restringe o vocabulário QUANDO
-- preenchido.
ALTER TABLE public.crm_opportunities
  ADD CONSTRAINT crm_opportunities_status_known_chk
    CHECK (status IS NULL OR status IN ('open', 'won', 'lost')),
  ADD CONSTRAINT crm_opportunities_temperature_known_chk
    CHECK (temperature IS NULL OR temperature IN ('frio', 'morno', 'quente', 'não definida')),
  ADD CONSTRAINT crm_opportunities_priority_known_chk
    CHECK (priority IS NULL OR priority IN ('alta', 'média', 'baixa'));
```

---

## Referências

- [`etapa-5-flip-clientes-rodada3-check-drafts.md`](etapa-5-flip-clientes-rodada3-check-drafts.md)
  — draft irmão (`clients.status`/`temperature`), mesmo formato, vocabulário
  DIFERENTE (não compartilhar constraint).
- [`etapa-5-flip-clientes-pacote.md`](etapa-5-flip-clientes-pacote.md) §2.2
  — achado original que motivou a classe inteira ("bucket de texto livre
  sem proteção de schema").
- `supabase/migrations/20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql`
  — precedente de formato (CHECK preventivo + SELECTs de verificação no
  corpo da migration).
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G57 (import de
  oportunidades, mesmo arquivo `crmOpportunityMapper.ts` investigado aqui),
  G58/G59 (mesmo `CRM.tsx`).

**PARADO aqui — só drafts, nada em `supabase/migrations/`. Achado de §1
(estágio customizado descartado na criação) reportado, não corrigido — fica
pra decisão de numeração/rodada própria. §18.**
