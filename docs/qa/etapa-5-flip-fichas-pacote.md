# Etapa 5 — G1/Fichas Técnicas — Fase A (inventário) — SOMENTE LEITURA

> Zero código tocado. Molde de `docs/qa/etapa-5-flip-tarefas-pacote.md`/`etapa-5-flip-clientes-pacote.md`
> — inventário do domínio + mapeamento de assimetrias local↔nuvem usando o catálogo de classes de
> bug já conhecidas (G37/G40/G49/G52/G56) como checklist, não descoberta às cegas.

## Abertura

- Branch: `etapa-5-flip-fichas-fase-a`, worktree `Kora-laneE`, a partir do tip real de
  `origin/main` em `43a47ba` (`fix(crm): G57 - corrige alegacao falsa de idempotencia, documenta
  limitacao real`), confirmado por `git fetch origin main` antes de abrir.
- **Insumo direto**: `docs/qa/varredura-fosseis-pos-flip-financeiro.md` §1.1/§2.8 (Lane B) —
  classificou o banner "somente leitura" de `ClientTechnicalSheet.tsx:551` como **falso positivo
  preciso**, concluindo que o domínio "nunca teve cutover de escrita". **Este inventário
  contradiz essa conclusão — ver §5.**
- **Atualização (16/ago/2026)**: achado catalogado como **G63**
  (`docs/architecture/kora-hub-auditoria-e-plano.md`), com pacote de remediação de 5 itens.
  Operador rodou a verificação de exposição em produção — **0 linhas com `password` em
  `raw_payload`** — severidade ajustada de "vazamento ativo" pra "janela de vazamento sem dado
  exposto". Item 5 (limpeza de dado) cancelado por não ter objeto; itens 1-3 (fechar o código)
  seguem pendentes e com prioridade. Query de verificação e detalhe completo no G63.

---

## ⚠️ Achado crítico (resumo executivo, antes do inventário completo)

**Existe um caminho de escrita nativo, LIGADO POR PADRÃO, que grava direto em
`public.client_technical_sheets` — incluindo senhas em texto puro — sem que o operador tenha
ligado nada.** Detalhado em §5; resumo:

1. `getTechnicalSheetExperimentalEnabled()` e `getTechnicalSheetAutoSaveEnabled()`
   (`src/config/flags.ts:167-168,178-179`) são **opt-OUT — default `true`** (só `"false"`
   explícito desliga).
2. `getTechnicalSheetDataSource(clientId)` (`flags.ts:247-249`) — **default `"supabase"`** por
   cliente (só `"local"` explícito escolhe local), e há um `useEffect` de "auto-promote" que força
   `"supabase"` assim que o cliente tem `supabaseClientId` (`ClientTechnicalSheet.tsx:334-339`).
3. Com os 3 defaults intocados, `activeDataSource === "supabase"` e `autosaveEnabled === true` já
   na primeira visita à ficha de qualquer cliente vinculado ao Supabase — toda edição chama
   `persist()` → `clientTechnicalSheetsRepository.upsertTechnicalSheet()`
   (`ClientTechnicalSheet.tsx:290-321`), sem clique em nenhum botão "salvar" nem qualquer aviso de
   confirmação.
4. `mapLocalToSupabaseSheet` (`technicalSheetMapper.ts:34,59-68`) grava `raw_payload` como um
   **clone integral do objeto local** — sanitiza só `assets`/`branding` (remove dataURL/blob) —
   **`accesses[].password` (senhas de plataformas do cliente, `ClientAccess.password`,
   `types/domain.ts:80`) passa direto, sem redação nenhuma.**
5. O texto do banner que aparece nesse exato estado (`ClientTechnicalSheet.tsx:506-509`, "Modo
   Supabase experimental ativo... As edições feitas aqui são temporárias e não serão salvas
   automaticamente") **descreve o oposto do comportamento real** quando `autosaveEnabled` está no
   próprio default — mesma classe do achado que motivou a varredura da Lane B (G29, banner
   desatualizado), só que não coberto por ela.

**Alcance real, não hipotético**: exige que o cliente já tenha `supabaseClientId` resolvido —
`useSupabaseTechnicalSheet.ts:30-43` lê isso de `kora.clients.supabaseImport.v1` (`importedMap`),
o mapa de reconciliação legado de Clientes (pré-cutover da Fatia 4). Qualquer cliente que já foi
processado pelo assistente de import de Clientes em algum momento (histórico normal de qualquer
workspace anterior ao cutover não-governado do G58, `etapa-5-flip-clientes-pacote.md`) tem essa
entrada — não é um caso de laboratório. Clientes criados nativamente no Supabase **depois** do
cutover do G58 (`Clientes.tsx:159-194`, Supabase-first) não passam por esse mapa — para eles,
`supabaseClientId` fica `null` e o caminho segue bloqueado (`disabled={!supabaseClientId}`,
`ClientTechnicalSheet.tsx:489`).

**Não corrigido aqui — Fase A é inventário, protocolo §0/§4 (Code não aplica mudança de
comportamento sem "vai" explícito).** Ver §8 (riscos) e §9 (recomendação).

**Atualização (16/ago/2026)**: catalogado como **G63**, verificação de exposição em produção
rodada — **0 linhas com `password` exposto**. Janela de vazamento existe no código (defeito de
desenho continua), mas nenhum dado real foi vazado até hoje. Ver adendo completo em
`kora-hub-auditoria-e-plano.md` (G63).

---

## 1. Estado atual do domínio — hook local + storage

`ClientTechnicalSheet` (`src/types/domain.ts:98-108`) — 9 sub-objetos, campo aninhado dentro de
`Client.technicalSheet` (`types/domain.ts:160`), **não é um hook/store próprio**:

```ts
export interface ClientTechnicalSheet {
  branding?: ClientBranding;        // logo, cores, slogan, tom de voz
  persona?: ClientPersona;          // público-alvo
  editorialLine?: ClientEditorialLine;
  typography?: ClientTypography;
  socialLinks?: ClientSocialLinks;
  accesses?: ClientAccess[];        // ⚠️ id, platform, login, password, notes
  competitors?: ClientCompetitor[];
  briefing?: ClientBriefing;
  assets?: ClientAsset[];           // arquivos/links, pode ter dataURL/blob (binário local)
}
```

- **Storage local**: `orbyt.clients.v1` (`useClients.ts:48`) — mesma chave dos registros de
  cliente, **não** uma chave própria. `useClients()` só re-exporta o tipo
  (`useClients.ts:7,14`); não tem nenhuma função de leitura/escrita específica de ficha técnica.
- **Leitura/escrita local real**: `ClientTechnicalSheet.tsx:234` (`useClients()`, pega
  `client.technicalSheet`) e `:294` (`updateClient(client.id, { technicalSheet: next })`) —
  direto, sem hook intermediário.
- **Chave auxiliar**: `kora.technicalSheets.restoreBackups.v1` (`:110,123`) — snapshots locais
  pra desfazer edição, não relacionado a nuvem.

---

## 2. Hooks/repository Supabase existentes

Já existe infraestrutura completa — este NÃO é um domínio greenfield como Financeiro era antes
da Fatia N:

| Peça | Arquivo | O que faz |
|---|---|---|
| Repository | `src/repositories/clientTechnicalSheetsRepository.ts` | `getTechnicalSheet`/`upsertTechnicalSheet`/`deleteTechnicalSheet` — CRUD completo, `upsert` com `onConflict: "client_id"` |
| Hook de leitura | `src/hooks/useSupabaseTechnicalSheet.ts` | React Query, `enabled: !!workspaceId && !!supabaseClientId` (G32 — design da casa) |
| Import assistido | `src/hooks/useLocalTechnicalSheetsImport.ts` | Assistente opt-in em Configurações → Dados, mesmo padrão dos outros domínios (candidatos, `importSelected`, metadata própria `kora.technicalSheets.supabaseImport.v1`) |
| Toggle autosave | `src/components/settings/QuotesSupabaseTechnicalSheetsAutoSaveToggleCard.tsx` | Card em Configurações — mostra "Status: Ativo" por padrão (reflete o opt-OUT real, ver §4). **Nome do arquivo cita "Quotes" por engano** (resíduo de copy-paste, cosmético) — o card é 100% sobre Fichas Técnicas. |

**Nenhum card equivalente para `TECHNICAL_SHEETS_EXPERIMENTAL_KEY`** — só o autosave tem
toggle visível em Configurações; o modo experimental (que já vem ligado por padrão) não tem
onde ser desligado pela UI de Configurações, só pelo seletor "Local"/"Supabase experimental"
dentro da própria página da ficha (`ClientTechnicalSheet.tsx:474-497`), que grava por-cliente,
não é uma flag global.

---

## 3. Mapper — `technicalSheetMapper.ts` (escrita) / `supabaseTechnicalSheetToLocalMapper.ts` (leitura)

### 3.1 Escrita — `mapLocalToSupabaseSheet` (`technicalSheetMapper.ts:4-69`)

| Campo local | Campo cloud | Tratamento |
|---|---|---|
| `branding` | `branding` | Direto, com sanitização de dataURL/blob string-a-string |
| `persona` | `persona` | Direto |
| `editorialLine` | `editorial` | Direto (nome diferente, sem tradução de vocabulário — é só rename de chave) |
| `typography` | `typography` | Direto |
| `socialLinks` | `social_links` | Direto |
| `briefing` | `briefing` | Direto |
| `assets[]` | `materials[]` | Filtrado — só entra item com `url` real (não `data:`/`blob:`), remapeado pra `{title, url, type, description}` |
| **(objeto local inteiro)** | `raw_payload` | `JSON.parse(JSON.stringify(localSheet))`, sanitizado só nos campos `assets`/`branding` |
| `accesses[]` | **nenhuma coluna dedicada** | **Não sanitizado — vai inteiro dentro de `raw_payload`, incluindo `password`** |
| `competitors[]` | **nenhuma coluna dedicada** | Vai inteiro dentro de `raw_payload` (sem dado sensível conhecido aqui, diferente de `accesses`) |

### 3.2 Leitura — `mapSupabaseToLocalSheet` (`supabaseTechnicalSheetToLocalMapper.ts:5-90`)

| Campo cloud | Campo local | Tratamento |
|---|---|---|
| `branding`/`persona`/`editorial`/`typography`/`social_links`/`briefing` | mesmos 6 locais | Direto, `\|\| {}` |
| `raw_payload.assets` (preferencial) OU `materials` (fallback) | `assets[]` | Reconstrói com defaults (`accessStatus: "privado"`), filtra dataURL/blob de volta |
| `raw_payload.accesses` | **nunca lido** | `accesses` nunca é reconstruído — o dado que foi escrito (§3.1) nunca volta |
| `raw_payload.competitors` | **nunca lido** | idem |

**Consequência**: a escrita de `accesses`/`competitors` pro `raw_payload` não serve a NENHUM
propósito funcional hoje — não há round-trip, ninguém lê de volta. É puramente um efeito
colateral de `raw_payload` ser um clone bruto do objeto inteiro, não uma decisão de produto de
"guardar senha na nuvem pra algo".

---

## 4. Flags atuais

| Flag | Chave | Semântica | Default | Onde |
|---|---|---|---|---|
| Modo experimental | `kora.technicalSheets.supabaseExperimental.enabled` | opt-OUT (`!== "false"`) | **`true`** | `flags.ts:167-168` |
| Autosave | `kora.technicalSheets.supabaseAutoSave.enabled` | opt-OUT (`!== "false"`) | **`true`** | `flags.ts:178-179` |
| Fonte por cliente | `kora.technicalSheets.dataSource.v1` (mapa JSON `{clientId: "local"\|"supabase"}`) | só `"local"` explícito escolhe local | **`"supabase"`** por cliente não mapeado | `flags.ts:247-249` |

**Nenhuma dessas 3 é `BOOLEAN_FLAG_KEYS`/`getBooleanFlag`** (esse conjunto é opt-in default-OFF,
documentado assim em `flags.ts:27-34`) — as 3 flags deste domínio são deliberadamente as
exceções opt-OUT do módulo, junto com `kora.whatsapp.campaignSender.enabled`
(`flags.ts:16-22`). O comentário de topo do arquivo já avisa sobre isso — não é um bug de
convenção, é documentado; o que não está documentado em lugar nenhum é a CONSEQUÊNCIA prática
dos 3 defaults somados (§ achado crítico acima).

---

## 5. Produtores de escrita — inventário completo

| # | Caminho | Arquivo:linha | Gate | Estado real |
|---|---|---|---|---|
| 1 | Autosave ao editar a ficha | `ClientTechnicalSheet.tsx:290-321` (`persist`) | `activeDataSource === "supabase" && autosaveEnabled` | **Ligado por padrão** (§4) — dispara em qualquer edição de campo enquanto a fonte ativa é Supabase |
| 2 | Botão "Salvar no Supabase" | `ClientTechnicalSheet.tsx:267-288` (`handleSaveToSupabase`) | Só precisa de `workspace.id` + `supabaseClientId` — **sem gate de flag nenhum** | Sempre disponível quando o cliente tem vínculo Supabase, independente do autosave estar ligado ou não |
| 3 | Import assistido em lote | `useLocalTechnicalSheetsImport.ts:137-193` (`importSelected`) | Opt-in manual (Configurações → Dados, seleção explícita) | Comportamento esperado de assistente de import — não é o achado crítico |

**Caminhos 1 e 2 são os que a varredura da Lane B não capturou.** A busca dela (§1.1 daquele doc)
comparou o texto do banner **"somente leitura"** contra o estado do domínio, mas esse banner
específico (`:543-552`) descreve corretamente um painel DIFERENTE — o "Painel Versão Supabase"
(pré-visualização read-only, resumo por seção preenchida/vazia, `:531-620`+). É um segundo banner,
mais acima na mesma página (`:502-513`, "Modo Supabase experimental ativo"), que promete
"edições temporárias, não salvas automaticamente" — e é esse segundo banner que está errado
quando `autosaveEnabled` está no próprio default. Dois banners parecidos, cobrindo dois blocos de
UI diferentes, um preciso e outro não — o tipo de detalhe que uma varredura por grep de texto
("somente leitura") não diferenciaria sem ler os dois com atenção ao contexto.

---

## 6. Tabela cloud — schema, FK, RLS

`public.client_technical_sheets` (`supabase/migrations/20260530020000_create_client_technical_sheets.sql`):

```sql
id UUID PK, workspace_id UUID FK→workspaces (CASCADE), client_id UUID FK→clients (CASCADE, UNIQUE),
branding/persona/editorial/typography/social_links/briefing JSONB DEFAULT '{}',
materials JSONB DEFAULT '[]', raw_payload JSONB DEFAULT '{}',
created_at/updated_at TIMESTAMPTZ, trigger de updated_at (padrão da casa)
```

- `UNIQUE(client_id)` — 1:1 real com `clients`, `isOneToOne: true` confirmado em
  `types.ts:283-288`. É o arbiter de idempotência que `upsertTechnicalSheet`'s
  `onConflict: "client_id"` usa — **corresponde exatamente à regra de negócio** (1 ficha por
  cliente), diferente do G56 (onde a constraint certa existia mas 2 produtores diferentes
  colidiam sem avisar) — aqui só há 1 produtor real de cada vez por cliente.
- RLS: 4 policies (`SELECT`/`INSERT`/`UPDATE`/`DELETE`), todas `is_workspace_member(workspace_id)`
  — padrão idêntico ao resto da casa, nenhuma policy mais permissiva. **A superfície de exposição
  de `accesses[].password` (§3.1) é "qualquer membro do workspace", não "qualquer pessoa"** — RLS
  em si não está mal configurada; o problema é gravar segredo em texto puro num JSONB, não quem
  pode lê-lo depois.
- Sem coluna `source_local_id` — não há arbiter pra reenvio duplicado do import assistido além do
  `UNIQUE(client_id)` em si (que já resolve, porque reimportar o mesmo cliente só faz upsert na
  mesma linha).

---

## 7. Assimetrias local↔nuvem — checklist por classe conhecida

| Classe | Pergunta do checklist | Resultado |
|---|---|---|
| **G37** (payload completo) | Todo campo local com correspondência estrutural chega na escrita? | `accesses`/`competitors` **não têm campo estruturado** — vão só dentro de `raw_payload`, sem redação de `password`. Não é "campo esquecido" (G37 clássico) — é "campo nunca teve desenho de destino, mas vaza mesmo assim pelo catch-all". Achado próprio, não um G37 direto — ver §8 R1. |
| **G40/G49** (vocabulário nuvem = local literal) | Existe enum/status traduzido incorretamente? | **N/A** — domínio não tem nenhum campo de vocabulário fechado (sem `status`/`priority`/`stage`); tudo é JSONB livre ou sub-objeto. Nada a verificar nesta classe. |
| **G52** (campo condicionado a transição de estado) | Existe um campo tipo `paid_at`/`won_at` que uma transição de status deveria setar/limpar? | **N/A** — não há status persistido (o "vazio/parcial/completo" é computado em runtime, `statusOf`/`overallStatus`, nunca gravado). Nada a verificar. |
| **G56** (idempotência/constraint colidindo entre produtores) | 2+ produtores podem colidir na mesma constraint sem avisar? | **Não observado** — só 1 arbiter (`UNIQUE(client_id)`), e os 3 produtores do §5 fazem `upsert` (idempotente por desenho), não `insert` cru. Diferente do G56 (Financeiro), aqui não há 2 caminhos competindo por criar a MESMA linha de formas diferentes. |
| **G30** (cache de mutação, resposta da própria escrita) | A UI atualiza a partir da resposta da mutation, ou só espera refetch? | Misto — `handleSaveToSupabase`/`persist` chamam `refreshSupabase()` (refetch) depois do `upsert`, não usam a resposta (`data`) que o repository já devolve (`.select().single()`, `clientTechnicalSheetsRepository.ts:47-48`). Funciona (React Query refetch é rápido, staleTime 30s), mas é o padrão que o G30 original corrigiu em outros domínios — mencionado aqui como observação leve, não acionado (sem sintoma relatado). |
| **G29** (banner/texto desatualizado) | Algum texto de UI descreve capacidade que não bate com o código? | **Sim — achado crítico do §5**: banner "edições temporárias" (`:506-509`) desatualizado sempre que autosave está no default (ligado). |

---

## 8. Riscos nomeados

- **R1 — Segredo em texto puro trafegando pra nuvem sem necessidade funcional.**
  `ClientAccess.password` (senha de plataforma do cliente) é gravado em `raw_payload` sempre que
  qualquer um dos 2 caminhos de escrita ativos (§5, itens 1/2) roda — e nunca é lido de volta
  (§3.2). Maior risco deste inventário. Mitigação mínima (não implementada aqui, fica pra Fase B
  se autorizada): excluir `accesses` do `JSON.parse(JSON.stringify(localSheet))` antes de montar
  `raw_payload`, mesmo padrão de sanitização que `assets`/`branding` já recebem.
- **R2 — Escrita ativa por padrão, sem confirmação, contradizendo o texto da própria UI.** Ver
  achado crítico. Qualquer clique em campo de formulário da ficha técnica de um cliente já
  vinculado ao Supabase grava na nuvem imediatamente, sem toast de "você está prestes a...".
- **R3 — Dependência de um mapa de reconciliação de outro domínio (`kora.clients.supabaseImport.v1`) sem journaling próprio.** Se esse mapa for limpo/perdido (mesma classe de risco do G57,
  achado anterior desta Lane), `supabaseClientId` volta a `null` pra todo mundo — os 2 caminhos
  de escrita ficam inacessíveis silenciosamente (fail-safe, não fail-open, então não é um risco
  de segurança agravado — mas é uma dependência cross-domínio não documentada em nenhum README
  deste domínio específico).
- **R4 — `materials`/`assets` filtram binário (`data:`/`blob:`) mas não têm limite de tamanho.**
  Mesma ausência de soft-cap já registrada como padrão aceito noutros domínios (ex.: cérebro do
  robô, Etapa 9 item 2) — não é um achado novo, só not-yet-a-problema registrado por completude.

---

## 9. Fechamento — recomendação, não decisão

Este domínio **não é greenfield** (repository, hooks, mapper, RLS, import assistido — tudo já
existe e já funciona pro caso feliz) — mas também **não está no estado "somente leitura" que a
varredura anterior concluiu**. A combinação dos 2 fatos muda a recomendação de sequência:

- **Não é uma Fase A de "desenhar do zero"** — a maior parte da infraestrutura de escrita já foi
  construída (provavelmente numa rodada anterior não documentada como "flip formal", por isso não
  apareceu no radar de nenhum pacote até agora).
- **A prioridade imediata não é desenhar uma Fase B nova — é decidir o que fazer com R1/R2
  agora**, porque diferente dos outros domínios auditados nesta série (onde a Fase A vem ANTES de
  qualquer escrita existir), aqui a escrita já está acontecendo em produção, hoje, pra quem já
  tem clientes vinculados ao Supabase. Isso não é "planejar um flip" — é "auditar um flip que já
  aconteceu sem journaling formal".
- **Sugestão de sequência pro revisor decidir (texto original, 14/ago→16/ago/2026)**: *"(1)
  confirmar R1/R2 com o operador — checar se há dado de `accesses`/`password` real já em
  `raw_payload` em produção (SQL de verificação...); (2) se houver, tratar como incidente de dado
  sensível, não como item de backlog normal; (3) só depois disso faz sentido desenhar uma Fase B
  'de verdade'..."*
- **Passo (1) cumprido (16/ago/2026, G63)**: verificação rodada, **0 linhas expostas** — passo
  (2) não se aplica (nada a tratar como incidente de dado). Passo (3) fica mais simples do que
  o texto original antecipava: não há dado real a migrar/reconciliar, só o defeito de desenho a
  fechar — o pacote de remediação do G63 (4 itens pendentes: sanitizar `raw_payload`, fechar
  autosave por padrão, corrigir o banner, e já feito, a verificação) já cobre isso sem precisar
  de uma Fase B tradicional de flip (sem backfill, sem decisão de convivência — mesma economia
  que a mesa vazia deu pra Tarefas em `tarefas-r2-auditoria.md`).

---

## Referências

- `docs/qa/varredura-fosseis-pos-flip-financeiro.md` §1.1/§2.8 — conclusão original (revisada
  por este doc)
- `docs/qa/etapa-5-flip-clientes-pacote.md` §1.4/§1.5 — contrato cross-domínio de
  `kora.clients.supabaseImport.v1`, cutover não-governado de Clientes (G58)
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G29 (banner desatualizado), G30 (cache de
  mutação), G37 (payload incompleto), G52 (campo condicional), G56 (idempotência) — classes
  usadas como checklist no §7; **G63** — catalogação formal deste achado, pacote de remediação
  de 5 itens (1 cancelado, 4 mantêm prioridade) e adendo de verificação (16/ago/2026)
- `src/types/domain.ts:31-108` — shape completo local de `ClientTechnicalSheet` e sub-tipos
- `supabase/migrations/20260530020000_create_client_technical_sheets.sql` — schema, RLS, trigger

---

**PARADO aqui — inventário encerrado, zero código alterado. Achado crítico (§ topo, R1/R2)
registrado para decisão do revisor/operador — não corrigido nesta rodada por instrução explícita
de escopo (só leitura + doc). Fase B (se houver) só com novo "vai".**
