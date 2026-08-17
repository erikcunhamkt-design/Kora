# Auditoria — completude de leitura nuvem→local (campo cloud omitido do objeto de retorno)

> Inventário 100% leitura. Branch `etapa-5-auditoria-g37-leitura`, a partir do
> tip real de `origin/main` em `ff049dc`
> (`fix(crm): G64 - funis customizados... (itens 2/3, sem numero novo)`).

## 0. Escopo — por que esta auditoria é diferente da G37 espelhos

A auditoria anterior (`etapa-5-auditoria-g37-espelhos.md`) cobriu 2 classes na
direção **local→nuvem** (payload de escrita incompleto; passthrough de UUID em
`resolve*Fk`) e, por consequência, também achou/corrigiu 2 bugs de **leitura**
(G67-ext, `crmOpportunityMapper`) — mas aqueles eram `Number(uuid)` quebrando
(**cast quebrado**, produz `NaN`/`undefined` a partir de um valor presente).

Esta auditoria cobre uma classe diferente e mais silenciosa, específica da
direção **nuvem→local**: um campo que **existe** na coluna cloud, chega
completo na resposta do Supabase, mas o mapper de leitura **nunca o atribui**
ao objeto local — nem erra o cast, simplesmente não escreve a linha. Sem
`NaN`, sem exceção, sem warning — o campo local correspondente fica
`undefined` (ou no valor default do tipo) pra sempre, silenciosamente, mesmo
quando a coluna cloud tem um valor real. Foi esta classe que apareceu como
causa raiz num hotfix recente do `quoteMapper` (Lane A, em voo no momento
desta auditoria — ver §1.4 abaixo, achado que bate exatamente no mesmo lugar).

**Método**: `grep -rn "export function mapSupabase\w*ToLocal\w*"` → 8 funções
em 7 domínios (Quotes tem 2: quote + item). Para cada uma, o tipo `SupabaseX`
completo (via `grep`/leitura da interface no repository, ou da migration SQL
quando não há interface TS formal) foi comparado campo a campo contra o corpo
da função — todo campo cloud que não aparece do lado direito de nenhuma
atribuição é uma omissão candidata, depois classificada.

---

## 1. Inventário por mapper

### 1.1 `projectsMapper.mapSupabaseProjectToLocal` — ✅ CONFORME

`SupabaseProject` (`projectsRepository.ts:9-34`): 19 campos. Todos os campos
de domínio (não-infra) são lidos: `id`, `title`→`name`, `client_id` (via
`clientNameById` + cast smuggled), `description`, `status`+`archived` (via
`translateCloudProjectStatusToLocal`), `start_date`, `due_date`, `budget`,
`created_at`, `is_demo`, `quote_id`, `opportunity_id`, `source`,
`deliverables`, `updated_at`. Nenhuma omissão nova.

### 1.2 `financeMapper.mapSupabaseTransactionToLocal` — ✅ CONFORME

`SupabaseFinancialTransaction` (`financeRepository.ts:8-35`): 20 campos.
Todos os campos de domínio lidos: `id`, `type`+`status` (via
`translateCloudTransactionVocabulary`), `title`, `description`, `amount`,
`category`, `client_id` (via `clientNameById` + cast), `due_date`, `paid_at`,
`payment_method`, `source`, `created_at`, `is_demo`, `quote_id`,
`opportunity_id`. Nenhuma omissão nova — mapper já foi escrito "payload
completo desde o dia 1" (comentário do próprio arquivo, citando a lição do
G37/`deliverables`).

### 1.3 `tasksMapper.mapSupabaseTaskToLocal` — ⚠️ 1 achado (baixo risco)

`SupabaseTask` (`tasksRepository.ts:7-31`): 18 campos.

| Campo cloud | Lido? | Observação |
|---|---|---|
| `sort_order` | ❌ **nunca lido** | ~~Não é uma omissão "decidida" registrada~~ — **VEREDITO (rodada de verificação): VESTIGIAL, decisão agora documentada em comentário** (`tasksMapper.ts`, bloco de `mapSupabaseTaskToLocal`). Confirmado por leitura de `Tarefas.tsx`: toda ordenação é computada em runtime (`sortByDue`/`sortByPriority`/`sortByCreated`), nunca persistida; o drag-and-drop do Kanban (`handleDrop`/`moveTask`, `Tarefas.tsx:368-369,917-961`) move tarefas ENTRE colunas de status, não reordena dentro de uma coluna — `moveTask` (`useTasks.ts:154`) só grava `status`+`updatedAt`. `mapLocalTaskToSupabase` (escrita) já grava `sort_order: 0` hardcoded — inerte nos 2 sentidos, sem consumidor real hoje. |
| `opportunity_id` | ❌ nunca lido | **Decidido/documentado** — comentário no topo do arquivo (linhas 9-12): `Task` local não tem NENHUM campo `opportunityId` (só `Project` tem), "ausência estrutural do campo", já registrado antes desta auditoria. Não reaberto. |

Todos os demais campos (`id`, `title`, `description`, `client_id`,
`project_id`, `priority`, `due_date`, `status`, `created_at`, `updated_at`,
`archived`, `is_demo`, `quote_id`, `source`) são lidos.

### 1.4 `quoteMapper.mapSupabaseQuoteToLocalQuote` — ✅ CORRIGIDO EM `cd8bb26` (achado principal, era 🔴 no momento em que esta auditoria foi escrita)

> **Atualização pós-merge**: `client_id`/`opportunity_id` foram corrigidos pela
> LANE A em `cd8bb26` (`fix(vendas): G68 - mapSupabaseQuoteToLocalQuote perdia
> client_id/opportunity_id uuid na leitura (2ª extensão do G67)`), catalogado
> como 2ª extensão do G67 (sem número novo) — **antes** desta auditoria ser
> mergeada. Fix confirmado por leitura direta do código pós-rebase:
> `quoteMapper.ts:206-207` — `clientId: sq.client_id ? (sq.client_id as
> unknown as number) : undefined` / `opportunityId: sq.opportunity_id ? (...)
> : undefined`, mesmo molde "uuid contrabandeado" do G67-ext. Testado (describe
> "G68" em `quoteMapper.test.ts`) com prova fail→fix→pass por patch (G65).
> `updated_at` (achado secundário, risco baixo) e `is_demo` (não confirmado)
> **NÃO foram tocados** pelo hotfix — seguem em aberto, ver tabela consolidada
> (§2). Texto original abaixo preservado como registro do achado tal como
> reportado no momento em que foi encontrado, não apagado.

`SupabaseQuote` (`quotesRepository.ts:21-58`): 27 campos.

| Campo cloud | Lido? | Observação |
|---|---|---|
| **`client_id`** | ❌ **nunca lido** | `Quote.clientId?: number` **existe** no tipo local (`useQuotes.ts:53`) — nunca atribuído em `mapSupabaseQuoteToLocalQuote` (`quoteMapper.ts:171-201`). Confirmado por `grep client_id` no arquivo inteiro: só aparece na direção de ESCRITA (`mapLocalQuoteToSupabaseQuote`, linha 164) e no comentário do topo — zero ocorrências na função de leitura. |
| **`opportunity_id`** | ❌ **nunca lido** | Mesmo caso — `Quote.opportunityId?: number` existe (`useQuotes.ts:55`), nunca atribuído na leitura. |
| `updated_at` | ✅ **corrigido** | **VEREDITO FINAL: FIX APLICADO** (rodada de merge, autorizado após o refactor `activityTimeline` da Lane C mergear em `dc8cff8`). `Quote.updatedAt?: string` existe (`useQuotes.ts:59`), consumidor real em `buildCommercialEvents.ts` (evento "Orçamento vencido") — `parseDate(q.updatedAt) ?? parseDate(q.sentAt) ?? parseDate(q.createdAt)`, antes sempre caía no fallback `createdAt` pra quote nuvem. Fix: `updatedAt: sq.updated_at ?? undefined` (`quoteMapper.ts`). Testado (describe "quoteMapper — updatedAt", `quoteMapper.test.ts`): valor preservado quando presente; regressão — ausente vira `undefined`. Prova fail→fix→pass por patch (G65): 1 teste falha contra o código antigo, 43/43 verdes após reaplicar. |

**Por que isto é o achado central desta auditoria, não uma curiosidade:**
`useSupabaseQuotes.fetchQuotesWithItems` (`useSupabaseQuotes.ts:49-60`) — a
função que alimenta **toda** listagem de quotes em modo Supabase — mapeia
**cada** linha via `mapSupabaseQuoteToLocalQuote`. Ou seja: **toda quote
exibida na UI em modo nuvem tem `clientId`/`opportunityId` sempre
`undefined`**, mesmo quando a coluna `client_id`/`opportunity_id` no banco
tem um uuid real. Downstream confirmado por leitura de código:
- `QuotesSection.tsx:527,530` — o link "Ver cliente" (`quote.clientId ? ... : null`) nunca renderiza pra nenhuma quote nativo-nuvem.
- `QuoteToReceivableDialog.tsx:164` (`resolveFinanceFk(quote.clientId, {})`) e `QuoteToProjectDialog.tsx` — o passthrough de UUID que o G37/G68 corrigiram em `resolve*Fk` nunca chega a ser exercitado pra esse caminho, porque `quote.clientId` já chega `undefined` ANTES de qualquer `resolveFk` — o fix de passthrough (nível `resolveFk`) não tem como compensar um valor que nunca chegou no objeto `Quote` pra começar.
- `QuotesSection.tsx:168` (seed do wizard a partir de uma oportunidade) não é afetado — lê `opp.clientId` (Lead), não `quote.clientId`.

**Nota de coordenação**: a "vai" mais recente do revisor mencionou a LANE A
"mergeando hotfix do quoteMapper" em paralelo a esta auditoria — o sintoma
descrito ("campo FK omitido do objeto de retorno, não cast quebrado") bate
exatamente com este achado. É plausível que o hotfix da Lane A já resolva
isto (ou parte disto) — `quoteMapper.ts` **não foi tocado** nesta auditoria
(doc-only, por instrução), e este achado é reportado tal como encontrado no
tip usado (`ff049dc`, antes do hotfix da Lane A aparecer nesta branch).
Recomendação: **antes de qualquer rodada de fix**, conferir se o hotfix da
Lane A já fechou `client_id`/`opportunity_id`/`updated_at` — evitar duplicar
trabalho (mesma disciplina do G60: lição já corrigida em algum lugar não
precisa ser corrigida de novo, só verificada).

Todos os demais 24 campos são lidos (`id`, `client_name`, `client_email`,
`client_whatsapp`, `title`, `description`, `subtotal`, `discount`, `total`,
`payment_condition`, `delivery_deadline`, `validity_days`, `status`+`archived`,
`created_at`, `is_demo` (hardcoded `false`, não lido de `is_demo` — ver nota
abaixo), `company`, `notes`, `approved_at`, `rejected_at`).

**Sub-achado — `isDemo: false` hardcoded, não `sq.is_demo`**: diferente de
todos os outros 6 mappers (que fazem `st.is_demo ?? false`/`sp.is_demo ??
false`), `mapSupabaseQuoteToLocalQuote` grava `isDemo: false` sempre.

> **VEREDITO (rodada de verificação): VESTIGIAL/ESTRUTURAL, decisão agora
> documentada em comentário** (`quoteMapper.ts`, junto do `isDemo: false`).
> Confirmado por leitura de TODAS as migrations da tabela `quotes`
> (`20260531030000_create_quotes_schema.sql` + as 4 `ALTER TABLE`
> subsequentes) — **a coluna `is_demo` não existe** em `public.quotes`.
> Não é omissão em 2 camadas como suspeitado originalmente — é ausência real
> de coluna, o hardcode é o único comportamento correto possível. Também
> seguro por construção mesmo que a coluna seja adicionada um dia:
> `useLocalQuotesImport.ts:141` (`if (local.isDemo) continue;`) já impede
> qualquer quote demo de chegar na nuvem via import, e a criação nativa
> (`useSupabaseQuotes.createMutation`) nunca marca `is_demo` — não existe
> hoje um caminho real que produza uma quote nuvem demo.

### 1.5 `quoteMapper.mapSupabaseQuoteItemToLocalItem` — ⚠️ 1 achado (baixo risco, inerte)

`SupabaseQuoteItem` (`quotesRepository.ts:82-91`): 8 campos.

| Campo cloud | Lido? | Observação |
|---|---|---|
| `service_id` | ❌ nunca lido | **VEREDITO FINAL: BACKLOG ESTRUTURAL do ciclo futuro de Vendas/Catálogo** (registrado no merge, não corrigido). `QuoteItem.serviceId?: string` existe (`useQuotes.ts:17`) e **tem dado real**: `addServiceItem` (`QuotesSection.tsx:815-821`, fluxo "+ Adicionar serviço do catálogo") grava `serviceId: svc.id` genuinamente. Consumidor real: `ServicesSection.tsx:216-224` (`usageMap`/"serviço mais usado") conta `item.serviceId` em todas as quotes — hoje subconta silenciosamente qualquer item de quote nuvem, porque `serviceId` nunca sobrevive nem à escrita (`mapLocalQuoteItemToSupabaseItem` também hardcoda `undefined`) nem à leitura. **Pré-requisito antes de qualquer fix**: `service_id` é `uuid` na coluna (`quote_items`, migration `20260531030000_create_quotes_schema.sql:28`), mas o catálogo de Serviços (`useServices.ts`) não tem tabela Supabase própria nem import-map (`grep` por `servicesRepository`/`SupabaseService` no repo inteiro → zero resultados) — `Service.id` local (`svc-${Date.now()}`) nunca é um uuid válido, mandar cru violaria a regra Q4. Fica registrado como item do ciclo futuro de Vendas/Catálogo — construir o catálogo de Serviços na nuvem (tabela + import-map, mesmo desenho de clients/quotes/projects/tasks/crm) é pré-requisito, não um fix pontual. Proposta detalhada em comentário (`quoteMapper.ts`). |

`id`, `name`, `quantity`, `unit_price` são lidos. `quote_id`/`created_at`/
`updated_at` são estruturais (item sempre resolvido dentro do contexto de
uma quote já conhecida; local `QuoteItem` não tem campos de timestamp
próprios — consistente com o tipo).

### 1.6 `crmOpportunityMapper.mapSupabaseOpportunityToLocalLead` — ✅ DECISÃO DOCUMENTADA (rodada-relâmpago, comment-only)

`SupabaseOpportunity` (`crmOpportunitiesRepository.ts:14-51`): 32 campos.

| Campo cloud | Lido? | Observação |
|---|---|---|
| `status` | ❌ nunca lido | `Lead` local **não tem campo `status`** (só `stage`). Redundância: a escrita (`mapLocalLeadToSupabaseOpportunity:60`) já deriva `status` a partir de `stage` (`stage === "fechado" ? "won" : ...`) — `status` cloud é um espelho DERIVADO de `stage`, não uma fonte de informação nova. **Decisão agora registrada em comentário** (`crmOpportunityMapper.ts`, junto da atribuição de `stage`) — lição G61 aplicada: decisão sem comentário vira "campo esquecido" na próxima auditoria. |
| `lost_at` | ❌ nunca lido | `Lead` local **não tem campo `lostAt`** (só `lostReason`, sem timestamp) — mesma classe de ausência estrutural do `status` acima. `won_at` tem contraparte (`wonAt`, lido) — a assimetria é estrutural, não um esquecimento. **Decisão agora registrada em comentário** (`crmOpportunityMapper.ts`, junto de `lostReason`). |

Já corrigidos nesta etapa (G67-ext, não reabertos aqui): `client_id`,
`converted_client_id`. Todos os demais 28 campos são lidos ou estruturalmente
ausentes já documentados (`probability`, `contact_name` — fundidos em
`name`/`phone` por desenho de UI, não uma omissão silenciosa — são
combinados explicitamente, não abandonados).

### 1.7 `useClientsDataSource.mapSupabaseClientToLocalClient` — ✅ CONFORME

Sem interface TS formal pro tipo de leitura (`s: any`) — comparado contra
`SupabaseClientInput` (`clientsRepository.ts:4-30`, os 23 campos graváveis)
mais os 4 estruturais (`id`, `created_at`, `updated_at`, mais os já
cobertos). Todos os 23 campos de `SupabaseClientInput` são lidos:
`name`, `company`, `email`, `phone`, `whatsapp`, `instagram`, `website`→`site`,
`city`, `state`, `address`, `document`, `type`→`serviceType`, `status`,
`source`→`origin`, `temperature`, `potential_value`→`potentialValue`,
`total_revenue`→`totalRevenue`, `next_action`, `next_action_date`, `notes`→`observations`,
`tags`, `archived`, `is_demo`, `avatar_url`. Nenhuma omissão nova — `totalRevenue`
é lido corretamente aqui (o achado G61 é sobre a UI não exibir/derivar o
campo de forma útil, não sobre o mapper omiti-lo; não reaberto).

### 1.8 `mapSupabaseToLocalSheet` (Fichas Técnicas) — ⚠️ JÁ DOCUMENTADO, não reaberto (território G63/Lane E)

`client_technical_sheets` (`supabase/migrations/20260530020000_create_client_technical_sheets.sql:4-19`):
13 colunas. `ClientTechnicalSheet` local (`src/types/domain.ts:98-108`) tem
2 campos **nunca lidos** por este mapper: `accesses` e `competitors`.

**Isto NÃO é um achado novo desta auditoria** — já está documentado, campo a
campo, em `docs/qa/etapa-5-flip-fichas-pacote.md` (linhas 141-153, tabela
"cruzamento com G37"): `accesses`/`competitors` "não têm campo estruturado"
na cloud, vão só dentro de `raw_payload` (catch-all), e `raw_payload.accesses`/
`raw_payload.competitors` "nunca são lidos" — inclusive com a nota de
segurança sobre `accesses[].password` sendo dado sensível. Classificação
**decidida/documentada**, território ativo/recente da Lane E (G63,
`fix(fichas-tecnicas): G63 itens 1-3` já em `main`). Não investigado a fundo
aqui, por instrução (não tocar/duplicar trabalho em voo) — só referenciado
pra fechar o cruzamento pedido.

---

## 2. Tabela consolidada

| Mapper | Campo cloud | Atribuído? | Classificação | Evidência |
|---|---|---|---|---|
| `tasksMapper` | `sort_order` | ❌ | **Vestigial — decisão documentada** (comment-only): nenhum consumidor de ordenação persistida existe; escrita já hardcoda 0 | `tasksMapper.ts` (bloco de `mapSupabaseTaskToLocal`), `Tarefas.tsx` (`sortByDue`/`sortByPriority`/`sortByCreated`, `handleDrop`/`moveTask`) |
| `tasksMapper` | `opportunity_id` | ❌ | **Decidida/documentada** — ausência estrutural, comentário `tasksMapper.ts:9-12` | `tasksMapper.ts:9-12` |
| `quoteMapper` (quote) | `client_id` | ✅ (corrigido em `cd8bb26`) | Era **Esquecida** (risco ALTO) — fechada pela Lane A antes do merge desta auditoria, 2ª extensão do G67 | `quoteMapper.ts:206-207`, `useSupabaseQuotes.ts:49-60`, `QuotesSection.tsx:527,530` |
| `quoteMapper` (quote) | `opportunity_id` | ✅ (corrigido em `cd8bb26`) | Idem — mesmo fix, mesmo commit | `quoteMapper.ts:206-207` |
| `quoteMapper` (quote) | `updated_at` | ✅ **corrigido** | **Fix aplicado** (`updatedAt: sq.updated_at ?? undefined`) — autorizado após o refactor `activityTimeline` da Lane C mergear (`dc8cff8`), consumidor real em `buildCommercialEvents.ts` liberado | `quoteMapper.ts`, `buildCommercialEvents.ts`, testes describe "quoteMapper — updatedAt" |
| `quoteMapper` (quote) | `is_demo` | ❌ (hardcoded `false`) | **Vestigial/estrutural — decisão documentada** (comment-only): coluna `is_demo` NÃO existe em `public.quotes` (confirmado em todas as migrations da tabela) | `quoteMapper.ts` (comentário junto de `isDemo`), `supabase/migrations/20260531030000_create_quotes_schema.sql` |
| `quoteMapper` (item) | `service_id` | ❌ | **Backlog estrutural do ciclo futuro de Vendas/Catálogo** — pré-requisito: tabela cloud de Serviços + import-map (sem isso, mandar `service_id` violaria a regra Q4) | `quoteMapper.ts` (comentário extenso junto de `mapLocalQuoteItemToSupabaseItem`), `ServicesSection.tsx:216-224`, `QuotesSection.tsx:815-821` |
| `crmOpportunityMapper` | `status` | ❌ | **Decidida/documentada** (rodada-relâmpago, comment-only) — redundante com `stage` | `crmOpportunityMapper.ts:124-131` |
| `crmOpportunityMapper` | `lost_at` | ❌ | **Decidida/documentada** (rodada-relâmpago, comment-only) — `Lead` não tem `lostAt` | `crmOpportunityMapper.ts:150-153` |
| `mapSupabaseToLocalSheet` | `accesses` (via `raw_payload`) | ❌ | **Decidida/documentada** — já catalogado, território G63/Lane E | `etapa-5-flip-fichas-pacote.md:141,150` |
| `mapSupabaseToLocalSheet` | `competitors` (via `raw_payload`) | ❌ | **Decidida/documentada** — idem | `etapa-5-flip-fichas-pacote.md:142,151` |
| `projectsMapper` | — | — | ✅ Conforme, nenhuma omissão | §1.1 |
| `financeMapper` | — | — | ✅ Conforme, nenhuma omissão | §1.2 |
| `useClientsDataSource` | — | — | ✅ Conforme, nenhuma omissão | §1.7 |

---

## 3. Fechamento

**Rodada original (inventário)**: nenhuma linha de código alterada, inventário
puro, conforme instrução. Nenhum arquivo em voo de outra lane tocado
(`CRM.tsx`, `Financeiro.tsx`, `ClientTechnicalSheet.tsx`/`technicalSheet*`,
`quoteMapper.ts`, `QuotesSection.tsx`/`QuoteToReceivableDialog.tsx` — todos só
lidos, não editados).

**Achado central — corrigido antes do merge**: `quoteMapper.mapSupabaseQuoteToLocalQuote`
não lia `client_id`/`opportunity_id` (existem no tipo local, existem na
coluna cloud, nunca atravessavam) — bug ativo, afetava toda quote listada em
modo Supabase. Fechado pela Lane A em `cd8bb26`, catalogado como 2ª extensão
do G67, antes desta auditoria chegar ao merge — a nota de coordenação do
achado original se confirmou útil (evitou uma rodada de fix duplicada).

**Rodada-relâmpago (comment-only, pós-merge da Parte 1)**: os 2 achados
"plausivelmente decididos mas não documentados" (`crmOpportunityMapper.status`/
`lost_at`) ganharam comentário de decisão no próprio mapper — lição G61
aplicada ("decisão sem comentário vira campo esquecido pra próxima
auditoria"). Nenhuma linha de lógica mudou, só comentários.

**Rodada de verificação do backlog (4 campos, comment-only + doc — SEM fix de
lógica)**: os 4 campos ficaram divididos em 3 vereditos diferentes, mais
específicos que o "backlog genérico" da rodada anterior:

1. **`tasksMapper.sort_order` — VESTIGIAL, decisão documentada.** Confirmado
   por leitura de `Tarefas.tsx`: nenhum consumidor de ordenação persistida
   existe (ordenação sempre computada em runtime; o drag-and-drop do Kanban
   move status, não reordena). Comentário adicionado em `tasksMapper.ts`.
2. **`quoteMapper.is_demo` — VESTIGIAL/ESTRUTURAL, decisão documentada.**
   Confirmado lendo todas as migrations de `quotes`: a coluna `is_demo`
   simplesmente não existe — não era uma omissão em 2 camadas como suspeitado,
   é ausência real de coluna. Comentário adicionado em `quoteMapper.ts`.
3. **`quoteMapper.updated_at` — FIX APLICADO** (rodada de merge). O refactor
   `activityTimeline` da Lane C mergeou em `dc8cff8` antes desta rodada,
   liberando o único consumidor conhecido (`buildCommercialEvents.ts`,
   evento "Orçamento vencido") — antes degradava pra usar `createdAt` em vez
   de `updatedAt`/`sentAt`. Fix de 1 linha (`updatedAt: sq.updated_at ??
   undefined`), testado fail→fix→pass por patch (G65): 1 teste falha contra
   o código antigo, 43/43 verdes após reaplicar.
4. **`quoteMapper` (item) `.service_id` — BACKLOG ESTRUTURAL do ciclo futuro
   de Vendas/Catálogo**, não corrigido. Diferente do que a rodada anterior
   presumiu ("inerte nos 2 sentidos"): tem consumidor real
   (`ServicesSection.tsx`, "serviço mais usado") E dado real
   (`QuotesSection.tsx.addServiceItem`) — mas o catálogo de Serviços não tem
   tabela Supabase nem import-map, então resolver isso com segurança (regra
   Q4, nunca id local cru em coluna uuid) exige construir esse catálogo na
   nuvem primeiro. Registrado como pré-requisito do próximo ciclo de
   Vendas/Catálogo, não um fix pontual — proposta detalhada em comentário
   (`quoteMapper.ts`).

Nenhum arquivo em voo tocado nesta rodada (`QuotesSection.tsx`/runbook —
Lane A; `functions`/`flow_data` — Lane E — todos só lidos/referenciados
quando aplicável, nunca editados). `buildCommercialEvents.ts`
(`activityTimeline`, Lane C) já não estava mais em voo no momento do merge —
mergeado em `dc8cff8` antes desta rodada, confirmado via `git fetch`.

**Já coberto por trabalho existente, não reaberto**: `accesses`/`competitors`
de Fichas Técnicas (G63, Lane E).

## Referências

- `docs/qa/etapa-5-auditoria-g37-espelhos.md` — auditoria irmã (direção
  local→nuvem + passthrough de UUID), mesmo método de inventário puro.
- `docs/qa/etapa-5-flip-fichas-pacote.md` §"cruzamento com G37" — achado
  `accesses`/`competitors` já documentado, referenciado em §1.8.
- G67/G67-ext (`kora-hub-auditoria-e-plano.md`) — classe irmã já corrigida
  (cast quebrado, `Number(uuid)` → `NaN`), diferente da classe desta
  auditoria (campo nunca atribuído).
- G61 (`totalRevenue` vestigial) — cross-referenciado em §1.7, não reaberto.
