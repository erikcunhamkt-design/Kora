# Auditoria G37 — completude de espelhos/mappers local→nuvem — SOMENTE LEITURA

> Inventário puro, doc-only. Nenhum código tocado, nenhum arquivo em voo de
> outra lane editado (só lido, quando necessário pro inventário). Achados
> classificados **conforme / violação / decidido-fora**; fixes ficam para
> rodada própria, com "vai" explícito.

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

### 1.5 `quoteMapper.mapLocalQuoteToSupabaseQuote` — 🔴 **VIOLAÇÃO NOVA**

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

**3 de 5 mappers conformes; 2 violações novas.**

| Mapper | Função | Status | Arquivo:linha |
|---|---|---|---|
| `projectsMapper.ts` | `resolveProjectFk` | ✅ conforme | `projectsMapper.ts:56-73` — origem do fix original de G37 |
| `financeMapper.ts` | `resolveFinanceFk` | ✅ conforme | `financeMapper.ts:38-59` — G37 por desenho, aplicado antes de qualquer incidente |
| `tasksMapper.ts` | `resolveTaskFk` | ✅ conforme | `tasksMapper.ts` — fix aplicado nesta etapa (Lane D, G53) |
| `crmOpportunityMapper.ts` | `resolveUuid` | 🔴 **violação nova** | `crmOpportunityMapper.ts:31-34` — `if (localId===null\|\|undefined\|\|"") return null; return map[String(localId)] ?? null;` — sem `UUID_RE.test()`, mesmo padrão pré-G37 |
| `quoteMapper.ts` | `resolveQuoteFk` | 🔴 **violação nova** | `quoteMapper.ts:29-35` — mesmo padrão, sem guard |

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

**Não corrigido nesta rodada** (inventário puro, protocolo do pedido) — fica
catalogado pra uma rodada de fix própria, com "vai" explícito.

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

## Fechamento — não corrigido, só inventariado

**2 achados novos, ambos em `resolve*Fk` (§2)** — `crmOpportunityMapper.resolveUuid`
e `quoteMapper.resolveQuoteFk` sem passthrough de UUID. **1 achado novo de
completude de payload (§1.5)** — `quoteMapper.mapLocalQuoteToSupabaseQuote`
omite `approved_at`/`rejected_at`, campos com coluna real e dado local real.
Nenhuma linha de código alterada nesta rodada.

**Ordem de risco sugerida** (não decidida aqui): `quoteMapper.resolveQuoteFk`
primeiro — Quotes é o domínio com mais caminhos de criação nativa já vivos
(`CreateCrmSupabaseQuoteDialog.tsx`, criação direta em `QuotesSection.tsx`)
e o `approved_at`/`rejected_at` do mesmo arquivo pode ser corrigido na mesma
rodada (mesmo mapper, mesmo tipo de mudança) → `crmOpportunityMapper.resolveUuid`
depois (mesmo padrão, arquivo separado, sem dependência entre os dois).

## Referências

- `docs/architecture/kora-hub-auditoria-e-plano.md` — G37 (payload de espelho incompleto + passthrough de UUID), G41, G49, G52, G56, G61, G63
- `docs/qa/etapa-5-auditoria-hooks-g30-g32.md` — auditoria irmã (classe G30/G32, mesmos 15 hooks `useSupabase*`), mesmo método de inventário puro
- `src/services/finance/financeMapper.ts:38-59`, `src/services/projects/projectsMapper.ts:56-73` — moldes de `resolve*Fk` conforme, já em produção
