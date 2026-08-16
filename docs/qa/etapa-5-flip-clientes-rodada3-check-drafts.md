# Etapa 5 — Clientes — Rodada 3 (pré-preparação) — drafts de migration CHECK

> **Nada aplicado.** Este doc guarda os DRAFTS de migration da Rodada 3 do
> Pacote do Flip de Clientes ([`etapa-5-flip-clientes-pacote.md`](etapa-5-flip-clientes-pacote.md)
> §2.2/§4), preparados enquanto a Rodada 2b esperava os 2 fósseis do par G59
> aterrissarem (ambos já aterrissaram — ver addendum de §4 daquele pacote,
> verificação de integridade 16/ago/2026 — Rodada 2b desbloqueada).
> Escopo explícito desta rodada de preparação: **só `status`/`temperature`
> de `public.clients`** — nenhum campo de `crm_opportunities` (que também
> tem `stage`/`status`/`temperature`/`priority` sem CHECK) foi investigado
> ou desenhado aqui; se esse domínio também precisar do mesmo tratamento, é
> decisão de quem tiver a próxima rodada do pacote de CRM/Fatia 2, não
> assumida por analogia nesta rodada.
>
> **Gate de aplicação — 2 condições, as duas precisam estar satisfeitas:**
> 1. Code não roda DDL contra produção (protocolo §0/§6/§8-b) — aplicação é
>    sempre do operador, via Supabase CLI/dashboard.
> 2. **Só depois de uma Fase D de homologação real ter rodado sobre o
>    restante do domínio Clientes** — decisão registrada em
>    `etapa-5-flip-clientes-pacote.md` §4 (Rodada 3): não faz sentido travar
>    o vocabulário por CHECK antes de saber se algum caminho de escrita
>    ainda existente (ou a existir na Rodada 2b) grava fora dele. Este doc
>    é preparação adiantada, não uma proposta pra aplicar agora.

---

## 1. Vocabulário confirmado — por grep, não por leitura do tipo TS sozinho

Mesma disciplina do G40/G49 (nunca confiar só na declaração de tipo —
confirmar contra todo write path real): grep em `Clientes.tsx`/`CRM.tsx`
por todo literal de `status`/`temperature` que o app realmente escreve.

### `status` — 5 valores, sem drift entre o tipo e os write paths

```ts
// src/types/domain.ts:1
export type ClientStatus = "Ativo" | "Em negociação" | "Inativo" | "Potencial" | "Arquivado";
```

Confirmado idêntico no array-fonte do `<Select>` do form (`Clientes.tsx:58`):
```ts
const statuses: ClientStatus[] = ["Ativo", "Em negociação", "Potencial", "Inativo", "Arquivado"];
```
Default de criação (`Clientes.tsx:172`, `data.status || "Ativo"`) e default do
form vazio (`Clientes.tsx:416,928,964`, `"Potencial"`) — ambos dentro do
vocabulário. `CRM.tsx:666,681` (`handleConvertToClient`, G58) hardcoda
`status: "Ativo"` nos dois branches (local/Supabase) — subconjunto do
vocabulário, sem valor novo.

### `temperature` — 3 valores, sem drift

```ts
// src/types/domain.ts:2
export type ClientTemperature = "Frio" | "Morno" | "Quente";
```

Confirmado idêntico no array-fonte do `<Select>` (`Clientes.tsx:60`):
```ts
const temperatures: ClientTemperature[] = ["Frio", "Morno", "Quente"];
```
Default de criação (`Clientes.tsx:176`, `data.temperature || "Morno"`) —
dentro do vocabulário. Mapper de leitura (`useClientsDataSource.ts:19,33`)
já usa os mesmos fallbacks (`"Ativo"`/`"Morno"`) pra linha da nuvem sem
valor — os fallbacks de leitura e escrita já concordam entre si.

**Conclusão:** os 2 `<Select>` do form são a única superfície de escrita
manual de `status`/`temperature` hoje — fechados, sem input livre — e todo
outro write path (`CRM.tsx` G58, defaults internos) usa literais dentro do
mesmo vocabulário. Nenhum caminho de escrita encontrado grava algo fora
desses 5+3 valores. Isso é o que os 2 SELECTs de verificação do draft
abaixo esperam confirmar contra o banco (código correto ≠ dado no banco
necessariamente correto — daí a checagem, não a suposição).

---

## 2. Draft — `clients_status_temperature_known_chk`

Nome de arquivo sugerido, quando promovido a migration real (Rodada 3,
pós-Fase D, com "vai" do revisor): `<timestamp>_etapa5_flip_clientes_status_temperature_known_chk.sql`.

```sql
-- Etapa 5 · Clientes — Pacote do Flip, Rodada 3 (docs/qa/etapa-5-flip-clientes-pacote.md
-- §2.2/§4). CHECK PREVENTIVO — vocabulário de status/temperature já é
-- fechado por design (Select fixo em Clientes.tsx:58/60, sem input livre em
-- lugar nenhum do app), mas sem CHECK na coluna nada impede um caminho de
-- escrita futuro (script, integração, edição manual direto no banco) de
-- gravar um valor fora do vocabulário sem avisar ninguém — achado da Fase A
-- (etapa-5-flip-clientes-pacote.md §2.2): hoje `status`/`temperature` são
-- TEXT livre, sem nenhuma constraint além de RLS.
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b) — aplicação é gate do operador, e só DEPOIS de uma
-- Fase D de homologação real ter rodado sobre o restante do domínio
-- Clientes (decisão registrada em etapa-5-flip-clientes-pacote.md §4,
-- Rodada 3 — não faz sentido travar o vocabulário antes de saber se algum
-- caminho ainda escreve fora dele).
--
-- Passo do operador ANTES de aplicar: confirmar que não há linha em
-- public.clients com status/temperature fora do vocabulário abaixo
-- (expectativa é ZERO — confirmar, não supor):
--   SELECT DISTINCT status FROM public.clients WHERE status IS NOT NULL AND status NOT IN ('Ativo','Em negociação','Inativo','Potencial','Arquivado');
--   SELECT DISTINCT temperature FROM public.clients WHERE temperature IS NOT NULL AND temperature NOT IN ('Frio','Morno','Quente');
-- Se qualquer uma das 2 queries devolver linha, PARAR — não aplicar este
-- CHECK sem decidir o que fazer com o dado fora do vocabulário primeiro
-- (mesmo caminho de decisão que o G56/Caso 4.3 tomou pra
-- financial_transactions: investigar a causa raiz antes de travar o schema
-- por cima de um sintoma).
--
-- NULL é permitido nos dois casos (colunas nullable hoje, sem NOT NULL —
-- confirmado em supabase/migrations/20260530010000_create_clients_schema.sql
-- e em src/integrations/supabase/types.ts) — este CHECK não força
-- preenchimento, só restringe o vocabulário QUANDO preenchido.
ALTER TABLE public.clients
  ADD CONSTRAINT clients_status_known_chk
    CHECK (status IS NULL OR status IN ('Ativo', 'Em negociação', 'Inativo', 'Potencial', 'Arquivado')),
  ADD CONSTRAINT clients_temperature_known_chk
    CHECK (temperature IS NULL OR temperature IN ('Frio', 'Morno', 'Quente'));
```

---

## 3. O que este draft NÃO cobre (registrado por escopo, não esquecido)

- **`crm_opportunities`** — investigado na rodada seguinte, ver
  [`etapa-5-flip-crm-rodada3-check-drafts.md`](etapa-5-flip-crm-rodada3-check-drafts.md).
  Resultado: `status`/`temperature`/`priority` têm vocabulário fechado e
  seguro pra CHECK (draft pronto); `stage` é genuinamente dinâmico
  (customizável via "Gerenciar funis") e foi deliberadamente excluído — um
  CHECK ali quebraria pipelines customizados. Vocabulário de `temperature`
  dessa tabela é DIFERENTE do de `clients.temperature` (minúsculo, 4
  valores vs. maiúsculo, 3 valores) — os 2 drafts não compartilham
  constraint.
- **Nenhuma outra coluna de `clients`** foi revisada pra CHECK — só
  `status`/`temperature`, por serem as 2 apontadas no achado original (§2.2
  do pacote). `type`/`source`/`city`/`state` etc. são texto genuinamente
  livre (endereço, origem descritiva) — não têm vocabulário fechado, não
  são candidatos a CHECK pela mesma lógica.
- **Não dimensionado em fases/estimativa** — este doc só guarda os DRAFTS
  prontos pra sessão §8-b do operador, não decide QUANDO essa sessão
  acontece (depende da Fase D do domínio inteiro fechar primeiro).

---

## Referências

- [`etapa-5-flip-clientes-pacote.md`](etapa-5-flip-clientes-pacote.md) §2.2
  (achado original — sem CHECK, risco de "bucket de texto livre") e §4
  (Rodada 3, gate de pós-Fase D).
- `supabase/migrations/20260815000200_etapa5_flip_financeiro_type_status_known_chk.sql`
  — precedente direto de formato (CHECK preventivo + SELECTs de verificação
  no corpo da migration, mesmo padrão §8-b), adaptado aqui pra `clients`.
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G56 (Caso 4.3),
  precedente de "investigar causa raiz antes de travar schema por cima de
  sintoma", mesmo raciocínio aplicado aqui à ordem CHECK-só-pós-Fase-D.

**PARADO aqui — só drafts, nada em `supabase/migrations/` ainda. §18.**
