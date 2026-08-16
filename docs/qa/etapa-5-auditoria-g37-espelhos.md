# Auditoria G37 — completude de espelhos/mappers local→nuvem

> Inventário original 100% leitura (branch/hash abaixo). **Atualização
> 16/ago/2026 (fix G68, branch `etapa-5-g68-fix-uuid-quote-crm`)**: os 2
> achados de `resolve*Fk` (§2) e o achado de `approved_at`/`rejected_at`
> (§1.5) foram corrigidos. Tabelas/seções atualizadas in-place; texto
> original preservado com nota do que mudou, não apagado. Nenhum arquivo em
> voo de outra lane tocado em nenhuma das duas rodadas.

Branch: `etapa-5-auditoria-g37-espelhos`, a partir do tip real de `origin/main`
em `6f773b0` (`fix(hooks): G30 - useSupabaseClients (4) + useSupabaseClientContacts (3)`).

## Método

Classe G37 original: *"espelho local→nuvem grava um payload empobrecido —
campo que já existe na coluna cloud, mas o mapper esquece de enviar"*
(`mirrorProjectToSupabase`/`deliverables`, achado original) — e a metade 2 do
mesmo G37: *"todo `localId` tratado como id local a resolver via import-map,
sem checar se já é um uuid real"* (passthrough de UUID).

`grep -r "export function mapLocal\w*ToSupabase"` + `grep "function mirror"` →
**6 mappers** (`services/*/​*Mapper.ts`) + **5 funções `mirror*` inline** em
componentes (todas thin wrappers que delegam pro mapper do domínio, ver §3).
Cada mapper lido por inteiro; campo a campo contra o tipo local (`Lead`/`Quote`/
`Task`/`Transaction`/`Project`) e contra a interface `Supabase*`/schema da
tabela (`*Repository.ts`).

---

## 1. Completude de payload — campo a campo

### 1.1 `projectsMapper.mapLocalProjectToSupabase` — ✅ CONFORME

G37 original foi encontrado e fechado aqui (`deliverables` esquecido,
`kora-hub-auditoria-e-plano.md` G37). Confirmado por releitura: todo campo de
`Project` com coluna cloud correspondente está no payload — `deliverables`
incluído desde o fix. Nenhum achado novo.

### 1.2 `financeMapper.mapLocalTransactionToSupabase` — ✅ CONFORME

`category`/`payment_method` (Fase B, §1.1 do pacote de Financeiro) já
entraram no payload. `supplierId`/`cashAccountId`/`recurrence`/`notes`
omitidos — **decidido-fora**, documentado (sem coluna cloud, domínio
relacional novo, pós-flip). Nenhum achado novo.

### 1.3 `tasksMapper.mapLocalTaskToSupabase` — ✅ CONFORME

Payload completo desde a Fase B/G53 (Lane D). `opportunity_id` sempre `null`
— ausência estrutural do campo local (`Task` nunca teve `opportunityId`), não
uma omissão. Nenhum achado novo (o vocabulário de `priority`/G49 é classe
diferente — tradução, não completude — já fechado, não reaberto aqui).

### 1.4 `crmOpportunityMapper.mapLocalLeadToSupabaseOpportunity` — ✅ CONFORME (completude)

Campo a campo contra `Lead` (`useLeads.ts:9-51`) e `SupabaseOpportunityInput`
(`crmOpportunitiesRepository.ts:53-85`): todo campo de `Lead` com coluna cloud
correspondente está no payload (`client_id`, `title`, `company`,
`contact_name`, `email`, `phone`, `whatsapp`, `stage`, `status`, `source`,
`temperature`, `priority`, `potential_value`, `probability`, `next_action`,
`next_action_date`, `expected_close_date`, `notes`, `quote_id`, `quote_title`,
`converted_client_id`, `won_at`, `lost_at`, `lost_reason`, `is_demo`,
`archived`, `tags`, `history`). Campos de `Lead` sem contraparte
(`serviceType`, `pipelineId`, `stageId`, `lastInteraction`, `converted`) —
**decidido-fora**: nenhuma dessas colunas existe em `SupabaseOpportunity`
(confirmado lendo a interface inteira, linhas 14-51) — ausência estrutural,
não omissão. **Achado real deste mapper está em UUID passthrough, §2.**

### 1.5 `quoteMapper.mapLocalQuoteToSupabaseQuote` — ✅ CONFORME (G68, corrigido 16/ago)

`approved_at`/`rejected_at` **têm coluna real** em `SupabaseQuote`
(`quotesRepository.ts:38-39`) e o campo local `Quote.approvedAt`/`rejectedAt`
é **genuinamente populado** — não é um campo-fantasma de tipo: `useQuotes.ts:226-227`
grava `patch.approvedAt = now`/`patch.rejectedAt = now` na transição de
status local real. `mapLocalQuoteToSupabaseQuote` (`quoteMapper.ts:117-149`)
**nunca inclui os dois no payload** — `status` é traduzido (`translateLocalStatusToCloud`),
mas o carimbo de tempo da aprovação/rejeição não viaja junto.

- **Consequência concreta**: um orçamento local já "aprovado" (com
  `approvedAt` real, de meses atrás) que seja importado ou criado
  nativamente na nuvem (`useSupabaseQuotes.createQuoteWithItems`,
  `useLocalQuotesImport.ts`) chega ao Supabase com `status: "approved"` mas
  `approved_at: NULL` — os badges "Aprovado em"/"Rejeitado em"
  (`SupabaseQuotesViewerCard.tsx`, `LinkedQuotesSection.tsx`, citados no
  comentário de `quotesRepository.updateStatus`) ficariam sem data pra esse
  registro, mesmo a aprovação tendo uma data real do lado local.
- **Por que só apareceu agora**: `quotesRepository.updateStatus` (o caminho
  de TRANSIÇÃO de status já em nuvem) já grava `approved_at`/`rejected_at`
  corretamente — o gap é só no caminho de IMPORT/criação nativa
  (`mapLocalQuoteToSupabaseQuote`), que nunca foi revisitado depois que
  `updateStatus` resolveu o problema pro caminho dele.
- **Arquivo:linha**: `src/services/quotes/quoteMapper.ts:117-149` (payload),
  campos ausentes `approved_at`/`rejected_at`; contraparte local em
  `src/hooks/useQuotes.ts:61-62,226-227`; coluna cloud em
  `src/repositories/quotesRepository.ts:38-39`.
- **Fix (G68)**: `approved_at: quote.approvedAt || null, rejected_at: quote.rejectedAt || null`
  adicionados ao payload. Testados (describe "G68" em `quoteMapper.test.ts`):
  envia quando populado, `null` (nunca `undefined`) quando não.

### 1.6 `technicalSheetMapper.mapLocalToSupabaseSheet` — REFERENCIADO, NÃO AUDITADO

Domínio de Fichas Técnicas já tem achado crítico catalogado e em hotfix pela
Lane E (**G63**, `kora-hub-auditoria-e-plano.md`) — por instrução, este
mapper não foi auditado a fundo aqui pra não colidir com o trabalho dela em
voo. Observação de inventário, sem investigar: `mapLocalToSupabaseSheet(localSheet: any)`
(`technicalSheetMapper.ts:4`) usa `any` como tipo do parâmetro — sem
checagem de tipo no payload de escrita. Registrado como candidato a
verificação futura, não investigado (poderia ser um achado G37 ou não —
não sei, não olhei o resto do arquivo).

---

## 2. Passthrough de UUID em `resolve*Fk` — G37, metade 2

**Estado original (16/ago, manhã): 3 de 5 mappers conformes; 2 violações novas.**
**Estado atual (pós G68, 16/ago): 5 de 5 mappers conformes — nenhuma violação remanescente.**

| Mapper | Função | Status | Arquivo:linha |
|---|---|---|---|
| `projectsMapper.ts` | `resolveProjectFk` | ✅ conforme | `projectsMapper.ts:56-73` — origem do fix original de G37 |
| `financeMapper.ts` | `resolveFinanceFk` | ✅ conforme | `financeMapper.ts:38-59` — G37 por desenho, aplicado antes de qualquer incidente |
| `tasksMapper.ts` | `resolveTaskFk` | ✅ conforme | `tasksMapper.ts` — fix aplicado nesta etapa (Lane D, G53) |
| `crmOpportunityMapper.ts` | `resolveUuid` | ✅ conforme **(G68, corrigido 16/ago)** | `crmOpportunityMapper.ts:31-40` — `UUID_RE.test()` adicionado, mesmo molde |
| `quoteMapper.ts` | `resolveQuoteFk` | ✅ conforme **(G68, corrigido 16/ago)** | `quoteMapper.ts:29-45` — idem |

**Por que isso é um risco real, não só teórico** — evidência concreta, não
suposição:

- `QuoteToReceivableDialog.tsx:164-165` chama `resolveFinanceFk(quote.clientId, {})`
  com um **import-map vazio** (`{}`) — a única forma desse `client_id`
  resolver pra um valor não-nulo é o passthrough de UUID capturar
  `quote.clientId` já sendo um uuid real (quote lida da nuvem, não
  importada). Confirma que o padrão "campo local pode chegar como uuid real
  em contextos nativo-nuvem" já é exercitado de verdade no domínio de
  Financeiro — o mesmo cenário estrutural existe pra `Lead.clientId`/
  `Quote.clientId` sempre que uma quote/lead nativo-nuvem (não importado)
  alimenta `crmOpportunityMapper`/`quoteMapper`.
- `useSupabaseQuotes.ts` (comentário de topo, achado desta auditoria):
  cita `CreateCrmSupabaseQuoteDialog.tsx` como um caminho de **criação
  nativa** de quote a partir do CRM — se esse fluxo passar um `clientId`/
  `opportunityId` que já é uuid real (cliente/oportunidade já lidos da
  nuvem, não do import-map), `resolveQuoteFk` hoje devolve `null`
  silenciosamente, perdendo a FK — exatamente a classe de bug que o G37
  original catalogou em `projectsMapper.ts` antes do fix.
- Mesmo raciocínio vale pra `crmOpportunityMapper.resolveUuid`:
  `Lead.clientId`/`Lead.quoteId`/`Lead.convertedClientId` podem chegar como
  uuid real (cliente já 100% Supabase desde 2026-06-15, `quote.id` de uma
  quote nativa) — `resolveUuid` não distingue, sempre tenta o import-map.

**Corrigido em G68** (16/ago, branch `etapa-5-g68-fix-uuid-quote-crm`) — mesmo
molde `UUID_RE` aplicado aos 2 mappers. Testes novos (describe "G68" nos 2
arquivos de teste): uuid real nunca procurado no import-map (mesmo com
entrada conflitante no map) + regressão (id local numérico continua
resolvendo via map). Fail→fix→pass por patch (G65, sem `git stash`).

**Achado adicional descoberto durante o fix G68, corrigido na rodada
seguinte (G67-ext)**: lendo `crmOpportunityMapper.ts` de novo pra aplicar o
fix acima, `mapSupabaseOpportunityToLocalLead` (direção NUVEM→LOCAL, função
diferente de `resolveUuid`) usava `Number(opportunity.client_id)`/
`Number(opportunity.converted_client_id)` (linhas 139 e 145) — mesma classe
do **G67** (`Number(uuid)` vira `NaN`, `NaN || undefined` sempre cai em
`undefined`). Um `Lead` lido da nuvem com essas 2 FKs preenchidas (uuid real)
sempre perdia os valores na leitura, silenciosamente. Catalogado em G68 sem
corrigir (fora do escopo daquela rodada) — fix aplicado logo em seguida,
mesmo padrão de "uuid contrabandeado" já usado em `useClientsDataSource.ts:9`
(cast em vez de `Number()`); catalogado como adendo G67-ext (mesmo incidente
raiz do G67, direção de leitura) em `kora-hub-auditoria-e-plano.md`, não como
entrada numerada nova.

---

## 3. Funções `mirror*` inline em componentes — todas delegam, nenhum achado novo

| Função | Arquivo:linha | Delega para | Status |
|---|---|---|---|
| `mirrorProjectToSupabase` | `projectsCloudMirror.ts:72-91` | `mapLocalProjectToSupabase` (§1.1) | ✅ conforme, thin wrapper |
| `mirrorCreateToSupabase` | `ProjectsSection.tsx:192-202` | `mirrorProjectToSupabase` | ✅ conforme, thin wrapper |
| `mirrorCreateToSupabase` | `QuoteToProjectDialog.tsx:166-173` | `mirrorProjectToSupabase` | ✅ conforme, thin wrapper |
| `mirrorUpdateToSupabase` | `ProjectDetailDrawer.tsx:121-129` | `mirrorProjectToSupabase` | ✅ conforme, thin wrapper |
| `mirrorReceivableToSupabase` | `QuoteToReceivableDialog.tsx:159-180` | `financeRepository.createReceivableFromQuote` (payload próprio, não usa `financeMapper`) | ✅ conforme — payload já auditado por G22/G37/G41/G56 em rodadas anteriores; `category`/`payment_method` genuinamente enviados (diferente do diálogo do CRM, ver abaixo); usa `resolveFinanceFk` (conforme, §2) |
| mirror inline (sem nome próprio) | `CreateReceivableDialog.tsx:112-120` | `financeRepository.createReceivableFromQuote` | **decidido-fora (G41)** — `category`/`payment_method` hardcoded no lançamento local e OMITIDOS do espelho (não hardcoded lá, simplesmente ausentes) — G41 já catalogou isso como decisão de produto, não reaberto aqui. `client_id`/`opportunity_id` passados direto (`clientId ?? null`, sem `resolveFinanceFk`) — **confirmado correto**: os props já chegam como uuid da nuvem (`clientId?: string \| null`, `CreateReceivableDialogProps:25-26`), não IDs locais — não precisam de resolução via import-map. |

`ServicesSection.tsx` (citado no "não tocar" desta rodada) — confirmado por
grep: **nenhuma função de mirror/espelho** nesse arquivo. A menção no "não
tocar" provavelmente se refere ao achado não-relacionado de `step={50}` (fix
da Lane A), não a G37 — nada a inventariar aqui.

---

## 4. Cruzamento com achados já conhecidos

- **`Client.totalRevenue` / G61**: vestigial por decisão do revisor
  (`kora-hub-auditoria-e-plano.md`, G61) — campo com intenção derivada
  perdida num refactor, decisão registrada de NÃO completar o payload como
  campo simples. **Não reaberto.** Fora do escopo desta auditoria de
  qualquer forma (`Client`/`clientsRepository` não têm uma função
  `mapLocal*ToSupabase` própria — o payload de `useSupabaseClients.addClient`
  é montado direto pelo chamador, não por um mapper dedicado).
- **Fichas Técnicas / G63**: achado crítico catalogado, Lane E em hotfix
  ativo. **Referenciado, não auditado** (§1.6) — evita colisão com o
  trabalho dela em voo, conforme instrução.
- **Financeiro / G52 (`paid_at` NULL no caminho nativo de marcar pago)**:
  já fechado — mas é uma classe DIFERENTE (UPDATE parcial num caminho de
  transição de status já em nuvem, `SupabaseTransactionsPanel.setStatus()`),
  não o mapper de import/criação (`mapLocalTransactionToSupabase`, §1.2,
  confirmado completo). Não confundir os dois — `financeMapper.ts` já envia
  `paid_at` no payload de import (`transaction.paidDate || null`).
- **Financeiro / G41 (2 diálogos de recebível)**: já fechado (mecânico) +
  decisão de produto registrada (category/paymentMethod hardcoded no CRM) —
  cross-referenciado em §3, não reaberto.
- **Financeiro / G56 (colisão de idempotência)**: já fechado — cross-referenciado
  em §3 (o comentário do próprio `QuoteToReceivableDialog.tsx` já cita).

---

## Fechamento

**Rodada original (16/ago, manhã)**: nenhuma linha de código alterada, só
inventário — 2 achados de `resolve*Fk` (§2) + 1 de completude de payload
(§1.5), catalogados sem corrigir.

**Rodada de fix G68 (16/ago, branch `etapa-5-g68-fix-uuid-quote-crm`)**: os 3
achados corrigidos — passthrough de UUID nos 2 mappers + `approved_at`/
`rejected_at` no payload de `quoteMapper`. Testes fail→fix→pass por patch
(método G65). Achado adicional (leitura, `mapSupabaseOpportunityToLocalLead`,
mesma classe do G67) descoberto durante o fix e catalogado, não corrigido —
fora do escopo autorizado.

**Estado final: 5/5 mappers conformes em passthrough de UUID, payload de
`quoteMapper` completo nos 2 campos identificados.** Nenhum arquivo em voo
de outra lane (`CRM.tsx`, `ClientTechnicalSheet.tsx`/`technicalSheet*`,
`QuotesSection.tsx`) tocado em nenhuma das duas rodadas.

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G37 (payload de espelho incompleto + passthrough de UUID), G41, G49, G52, G56, G61, G63
- `docs/qa/etapa-5-auditoria-hooks-g30-g32.md` — auditoria irmã (classe G30/G32, mesmos 15 hooks `useSupabase*`), mesmo método de inventário puro
- `src/services/finance/financeMapper.ts:38-59`, `src/services/projects/projectsMapper.ts:56-73` — moldes de `resolve*Fk` conforme, já em produção
