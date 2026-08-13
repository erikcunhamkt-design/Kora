# Etapa 5 — G1/Financeiro — Fase A (inventário, somente leitura)

> Molde: réplica da profundidade de `docs/qa/etapa-5-flip-projetos-pacote.md` (Fase A de Projetos). Este doc é só inventário — não decide se Financeiro entra antes ou depois da Etapa 9 (decisão do operador, fora de escopo aqui). Zero código tocado nesta rodada.

Branch: `etapa-5-flip-financeiro-fase-a`, a partir do tip real de `origin/main` em `e4391eb` (`docs(projects): emenda o runbook - Caso 2 e rollback nivel 1 refletem G29`).

---

## 1. Estado atual do domínio

### 1.1 Dados locais — `orbyt.finance.v1` e 5 stores irmãs

Tudo em `src/hooks/useFinance.ts`. `Transaction` (linhas 11-36) é o tipo vivo — **não confundir** com a cópia órfã em `src/types/domain.ts:219-249`, byte-a-byte idêntica mas sem nenhum import real em `src/` (confirmado por grep: todo consumidor importa de `@/hooks/useFinance`). A cópia em `domain.ts` é código morto, classe O9-like — não é um segundo domínio, é duplicação esquecida.

`useFinance.ts` guarda 6 stores locais independentes, nenhuma com contraparte em Supabase (confirmado por grep em `supabase/migrations/*.sql` — zero `CREATE TABLE` para qualquer uma das 5 abaixo):

| Store | Chave localStorage | Linha |
|---|---|---|
| `Transaction[]` | `orbyt.finance.v1` | `useFinance.ts:46` |
| `Supplier[]` | `kora.finance.suppliers.v1` | `useFinance.ts:126-136` |
| `FinanceCategory[]` | `kora.finance.categories.v1` | `useFinance.ts:100-106` |
| `PixSettings` | `kora.finance.pixSettings.v1` | `useFinance.ts:150-158` |
| `RecurringEntry[]` | `kora.finance.recurring.v1` | `useFinance.ts:173-186` |
| `CashAccount[]` | `kora.finance.cashAccounts.v1` | `useFinance.ts:197-205` |

### 1.2 Supabase — `financial_transactions` (a feature SUPABASE-QUOTE-RECEIVABLES)

Tabela criada em `supabase/migrations/20260601020000_create_financial_transactions_schema.sql:4-23`: `id, workspace_id, client_id, quote_id, opportunity_id, type (default 'receivable'), status (default 'pending'), title, description, amount, due_date, paid_at, source (default 'quote'), is_demo, archived, deleted_at, created_at, updated_at`. RLS completo (select/insert/update/delete via `is_workspace_member`, linhas 29-39). **Sem CHECK em `type`/`status`** — ambos são `text` livre (relevante no §3).

Evolução: índices de performance (`20260701210000_batch2_performance.sql:83-104`), índice único parcial anti-duplicata de recebível por orçamento (`20260704120000_etapa3_unique_receivable_from_quote.sql:44-46`), coluna `source_local_id` + índice único `(workspace_id, source_local_id)` para reconciliação de import (`20260721000000...add_source_local_id.sql` e `20260721000100...unique_source_local_id.sql`).

Camada de código já existente e homologada (Etapa 5, Fatia 6 — import assistido, doc `docs/qa/etapa-5-fatia-6-finance.md`):
- `src/repositories/financeRepository.ts` — `findReceivableByQuote`, `createReceivableFromQuote` (idempotente em `23505`), `softDeleteReceivable` (soft, via `deleted_at` — local é hard-delete, ver §3), `listReceivables`, `importTransaction` (bulk import)
- `src/services/finance/financeMapper.ts` — `mapLocalTransactionToSupabase`, tradução `income→receivable`/`expense→payable` (`CLOUD_TYPE`, linha 51), `inspectFinanceMoney` (só reporta divergência, não corrige)
- `src/hooks/useSupabaseFinancialSummary.ts` — leitor cloud-only, único consumidor é `SupabaseOperationalDashboardCard.tsx:258` (painel de QA em Configurações, flag `supabaseOperationalDashboard` default OFF)

### 1.3 Flags — Financeiro NÃO tem flag de fonte de dados

Ao contrário de `clients`/`crm`/`quotes`/`projects`, que têm `get*DataSource()` dedicado em `src/config/flags.ts` (ex.: `PROJECTS_DATA_SOURCE_KEY`/`getProjectsDataSource()`, linhas 106/187-193), **Financeiro não tem `kora.financeiro.dataSource.v1` nem equivalente**. A única flag que toca finance é `kora.quotes.supabaseCreateReceivable.enabled` (`BOOLEAN_FLAG_KEYS.quotesSupabaseCreateReceivable`, `flags.ts:39`, default OFF) — ela só habilita o botão "Gerar recebível" em `LinkedQuotesSection.tsx:39-40` e o mirror best-effort dentro de `CreateReceivableDialog.tsx`. Não gateia `Financeiro.tsx`, que hoje tem **zero referência a Supabase em toda a tela** (confirmado por grep).

---

## 2. Consumidores de dados financeiros — classificação

| Arquivo:linha | Uso | Classe |
|---|---|---|
| `src/pages/Financeiro.tsx:26-30,134-136` | `useFinance`, `useFinanceMetrics`, `useMonthlySeries` — tela inteira (todas as abas: Transações, Clientes, Fornecedores, Pix, Recorrências, Caixa) | **(a) precisa migrar** — é a tela real, 100% local |
| `src/components/day/DayCenter.tsx:38,119` | `useFinance()` → `updateTransactionStatus, transactions` | **(a) precisa migrar** |
| `src/hooks/useDayCenterActions.ts:4,16` | `useFinance()` → `updateTransactionStatus, transactions` | **(a) precisa migrar** |
| `src/hooks/useDayCenterData.ts:4,25,27` | `useFinance()` para `transactions` (local, cru) **ao lado de** `useBifurcatedProjects()` (linha 6/27) | **(a) precisa migrar** — comentário explícito nas linhas 15-20 do próprio arquivo já registra finance/tarefas/leads/quotes como "100% locais, fora de escopo desta fatia" (a fatia de projetos). É o padrão a replicar. |
| `src/components/clients/ClientActivitiesTab.tsx:19,166,431` | `useFinance()` → `transactions` (linha 431) **ao lado de** `useBifurcatedProjects` (linha 20/434) | **(a) precisa migrar** — mesmo arquivo já mistura bifurcado (projetos) com cru (finance) |
| `src/components/clients/ClientProfileDrawer.tsx:46,962-965` | `useFinance()` → `transactions` filtradas por cliente, **ao lado de** `useBifurcatedProjects` (linha 45/912) | **(a) precisa migrar** — mesmo padrão misto |
| `src/components/crm/CreateReceivableDialog.tsx:15-16,47,90-125` | `useFinance().addTransaction` (escrita local, linha 90) **+** `financeRepository.createReceivableFromQuote` (mirror best-effort, linha 111, try/catch que nunca bloqueia a escrita local) | **(b) já bifurcado (dual-write na escrita)** — é o equivalente do `mirrorProjectToSupabase` para finance (fix do G22). Gateado por `quotesSupabaseCreateReceivable`. |
| `src/components/vendas/QuoteToReceivableDialog.tsx:16-17,45,87-104` | `useFinance().addTransaction` só — **sem mirror cloud nenhum** | **(a) precisa migrar** (e é um gap hoje: dois diálogos de "gerar recebível" com comportamento inconsistente — já registrado em `docs/qa/etapa-5-fatia-6-finance.md` §9) |
| `src/components/dashboard/KoraOnboarding.tsx:8,38` | `useFinance()` → `transactions` (checklist de onboarding) | **(a) precisa migrar** (baixa prioridade, sinal read-only) |
| `src/hooks/useLocalFinanceImport.ts` + `src/components/settings/LocalFinanceImportCard.tsx` | Assistente de import (Configurações → Dados), escreve via `financeRepository.importTransaction`, progresso em `kora.finance.supabaseImport.v1` | **(b) já bifurcado em espírito** — mas é import unidirecional sob ação do usuário, não bifurcação de leitura/escrita da tela |
| `src/lib/dayCenter.ts:8,104-112,352-412` | Só o tipo `Transaction` (função pura `computeDayCenter`) | **(a) indireto** — não é fonte de dado, mas consome o que `useDayCenterData.ts` alimentar (hoje sempre local) |
| `src/components/dashboard/FinanceSummary.tsx:5-40` | Nada — números 100% hardcoded (`revenue = 6500` etc.) | **(c) não se aplica** — widget decorativo |
| `src/components/settings/SupabaseOperationalDashboardCard.tsx:258,309-311` | `useSupabaseFinancialSummary()` (leitor cloud-only) | **(b) já Supabase** — painel de QA/ops, não tela de uso |

**Achado estrutural principal** (o padrão que o pacote de Projetos pediu para observar): `ClientActivitiesTab.tsx` e `ClientProfileDrawer.tsx` **já usam `useBifurcatedProjects` e, nos mesmos arquivos, chamam `useFinance()` cru**. É a evidência mais forte de onde um `useBifurcatedFinance` deveria entrar primeiro — o padrão de bifurcação já está ao lado, só falta replicar para o segundo domínio dentro do mesmo componente.

---

## 3. Schema real — `Transaction` local vs. `financial_transactions`

| Campo local (`useFinance.ts:11-36`) | Coluna cloud | Mapeia 1:1? |
|---|---|---|
| `id` | `id` (uuid gerado na nuvem) | Não diretamente — reconciliação via `source_local_id` (`installId:localId`), não via `id` |
| `type: "income"\|"expense"` | `type: text` (sem CHECK) | **Traduzido**: `income→receivable`, `expense→payable` (`financeMapper.ts:51,108`) |
| `status: "pending"\|"paid"\|"overdue"\|"canceled"` | `status: text`, default `pending`, **sem CHECK** | Passado verbatim, sem tradução (`financeMapper.ts:109`) |
| `title`, `description?`, `dueDate`, `paidDate?`, `source`, `isDemo` | `title`, `description`, `due_date`, `paid_at`, `source`, `is_demo` | 1:1 (paidDate→paid_at sem perda prática; isDemo import sempre grava `false`, linha 117) |
| `amount` | `amount: numeric` | 1:1, com `roundMoney()` na escrita |
| `clientId?`, `quoteId?`, `opportunityId?` | `client_id`, `quote_id`, `opportunity_id` (uuid) | Gap resolvido via import-map (`resolveFinanceFk`, nunca id local cru) |
| **`category: string`** | *(sem coluna)* | **Gap** — nenhuma tabela `finance_categories` existe |
| **`supplierId?`** | *(sem coluna)* | **Gap** — nenhuma tabela `suppliers` |
| **`cashAccountId?`** | *(sem coluna)* | **Gap** — nenhuma tabela `cash_accounts` |
| **`paymentMethod`** | *(sem coluna)* | **Gap** — não persistido na nuvem, nem como texto livre |
| **`recurrence`** | *(sem coluna, sem `recurring_entries`)* | **Gap** — todo o sub-domínio `RecurringEntry` não tem representação cloud |
| `clientName?`, `quoteTitle?` (denormalizados) | *(resolvidos via join)* | Não é gap, por desenho — mesmo padrão de projetos/quotes |
| `notes?` | *(sem coluna — dobrado em `description` na escrita)* | Efetivamente fundido, não representado à parte |
| *(local faz hard-delete)* | `deleted_at`, `archived` | **Gap reverso**: `deleteTransaction` local (`useFinance.ts:263-265`) remove do array (exceto `isDemo`); cloud só suporta soft-delete (`softDeleteReceivable`) |

### Equivalente do O12 (tradução de enum na escrita)

Para Projetos, o O12 era: `status` gravado verbatim numa coluna que depois ganhou CHECK (`projects_status_known_chk`) não cobrindo todos os valores locais, exigindo shim de tradução.

**Para Financeiro, o problema ainda não existe — mas é latente, não resolvido**: `financial_transactions.status`/`.type` **não têm CHECK constraint** (confirmado grepando todas as migrations). O único leitor cloud hoje (`SupabaseOperationalDashboardCard.tsx:309-311`) só filtra `status === "pending"` e `status === "paid"` — nunca testou `overdue`/`canceled` ponta a ponta. Se Financeiro for flipado, adicionar um `financial_transactions_status_known_chk` (cobrindo `pending|paid|overdue|canceled` e `receivable|payable`) **antes** do flip é o passo de hardening proativo — ao contrário de Projetos, onde o CHECK foi reativo ao O12.

---

## 4. Integrações a NÃO acordar — Asaas / Pix

Nenhuma integração Asaas real existe. Todas as referências são de stub desconectado:
- `src/hooks/useIntegrations.ts:21` — `{ id: "asaas", status: "disconnected", isDemo: true }`
- `src/pages/Configuracoes.tsx:721` — card com `state="disconnected"`
- `src/components/settings/QuotesSupabaseReceivableToggleCard.tsx:23` — texto explícito: "Pagamentos, Pix, Asaas e financeiro local continuam bloqueados."

Pix é campo manual local, nunca trilho de pagamento real: `PixMethod = "manual" | "future"` (`useFinance.ts:148`); `Financeiro.tsx:845` tem disclaimer explícito ("PIX manual não confirma pagamento automaticamente"), `Financeiro.tsx:784` tem placeholder `<SelectItem value="future">Integração futura</SelectItem>`.

Doc de referência: `docs/integrations/INTEGRATIONS-ROADMAP.md` (não em `docs/architecture/`). §4 sequencia Asaas/Pix na **Fase 4 (Pagamentos & Financeiro)**, depois de Fases 1-3 (Base SaaS, Storage, E-mail) — bloqueado, não iniciado. §5 proíbe chave Asaas no frontend. §6 planeja (não construído) um `POST /api/payments/webhook`.

**Conclusão: o flip de fonte de dados de Financeiro não deve, e não precisa, tocar Asaas/Pix** — são fases distintas e posteriores no roadmap de integrações, independentes da migração de storage local→Supabase tratada aqui.

---

## 5. Esboço dos casos de homologação e critérios de rollback

Herdando as lições registradas em:
- **G29** — banner de "modo leitura" sobrevivendo ao flip real da escrita (texto de UI desatualizado depois que CRUD virou funcional);
- **G30** — `useProjects`-equivalente cujo `updateMutation` só fazia `invalidateQueries()` e confiava no refetch subsequente pra refletir a própria escrita; qualquer lag entre o UPDATE confirmado e o GET seguinte sobrescrevia o cache de volta pro valor antigo. Classe: "cache de mutação confiava só no refetch, não na resposta da própria escrita". Fix aplicado em Projetos foi o `updateMutation.onSuccess` escrever a linha devolvida pelo próprio `.select().single()` direto no cache via `setQueryData`, em vez de só invalidar. **Direto aplicável aqui**: se `financeRepository`/um futuro `useSupabaseFinanceTransactions` seguir o mesmo padrão invalidate-then-refetch em updates de status/edição de transação, herda o mesmo risco — vale desenhar a mutation já escrevendo a resposta do UPDATE no cache, não só invalidando, para não redescobrir o G30 num segundo domínio;
- uma investigação em aberto na Fase D de Projetos (Caso 3.2, comportamento de fetch em modo local) — ainda sem veredito nem número fixo no catálogo; citada aqui só como sinal de que a bateria de casos de Projetos ainda não fechou 100%, sem assumir causa ou classificação antecipada;
- a disciplina operacional de "criar ANTES de consultar" (evitar SELECT prematuro contra estado que ainda não existe na base nova):

1. **Caso 1 — Leitura em modo Supabase, workspace com recebíveis já importados**: abrir `Financeiro.tsx` com a flag de fonte de dados em `supabase`; esperado: transações antes só locais aparecem oriundas de `financial_transactions` (via `listReceivables`/repository), sem duplicar as que já foram importadas por `useLocalFinanceImport`.
2. **Caso 2 — Escrita: criar transação manual em modo Supabase**: criar uma transação manual (não vinda de orçamento) pela tela; esperado: grava em `financial_transactions` com `source='manual'`, aparece na relação sem reload. Prova: query na tabela por `title`/`workspace_id` recém-criados.
2b. **Caso 2b — Edição de status refletida na própria mutação (lição G30)**: com a transação aberta (ex.: drawer/detalhe, se a UI vier a ter um), marcar como "paga" pela tela; esperado: o próprio componente que disparou a escrita reflete "paga" sem precisar fechar/reabrir ou dar F5 — não basta o card da lista atualizar, o ponto de origem da mutação também precisa. Se a mutation usada seguir o padrão invalidate-only, este caso reproduz o G30 e deve usar o mesmo fix (setQueryData com a linha do UPDATE).
3. **Caso 3 — Consistência cruzada Financeiro × CreateReceivableDialog**: gerar um recebível pelo fluxo CRM existente (`CreateReceivableDialog`, já em produção atrás da flag) e depois abrir `Financeiro.tsx` em modo Supabase; esperado: a mesma linha aparece nos dois lugares (mesmo `id`), sem duplicata via `source_local_id`/`ux_ft_receivable_from_quote`.
4. **Caso 4 — Exclusão: soft-delete vs. hard-delete**: excluir uma transação pela tela em modo Supabase; esperado: linha desaparece da UI mas continua na tabela com `deleted_at` preenchido (soft), NÃO removida fisicamente — diferente do comportamento local hoje (hard-delete). Ressalva: se a UI não filtrar `deleted_at IS NULL` na leitura, o item "voltaria" — checar explicitamente.
5. **Caso 5 — Campos sem representação cloud (categoria, fornecedor, conta-caixa, forma de pagamento, recorrência)**: criar/editar transação usando qualquer um desses 5 campos em modo Supabase; esperado documentado ANTES do teste (não descoberto durante): qual comportamento é aceito — perder o campo silenciosamente, bloquear a ação, ou manter local-only até essas sub-entidades ganharem tabela própria. Este caso não tem "esperado" ainda porque depende de decisão de escopo (§6).
6. **Caso 6 — Os 5 consumidores cruzados (Central do Dia, ClientActivitiesTab, ClientProfileDrawer, DayCenter, KoraOnboarding)**: cada um deve refletir a mesma fonte de dados que `Financeiro.tsx` está usando (nada de um consumidor ainda lendo local enquanto a tela principal já lê Supabase) — replicar o padrão dos 5 consumidores classe (a) já fechados na Fase B de Projetos.
7. **Caso 7 — Banner/texto de UI desatualizado (lição G29)**: auditar `Financeiro.tsx` e os 6 consumidores por qualquer copy fixo tipo "em breve"/"modo leitura"/"local" e confirmar que nenhum sobrevive ao ponto em que a escrita real já funciona.
8. **Caso 8 — Rollback disparado**: com o flip já ativo, reverter a flag de fonte de dados para `local`; esperado: tela volta a ler `orbyt.finance.v1` sem perder as transações criadas em modo Supabase (elas simplesmente somem da view local, não são apagadas) — mesma semântica de rollback nível 1 documentada para Projetos (flag sozinha não apaga dado, só troca a fonte de leitura).

**Rollback nível 1** (flag de dataSource → local): reversível a qualquer momento, sem perda — mesma lição do G29/runbook de Projetos: a flag de escrita (se existir, equivalente a `kora.projects.supabaseWrite.enabled`) sozinha **não bloqueia CRUD**, só troca onde a leitura busca dado.

**Rollback nível 2** (parar de gravar em Supabase): manter dual-write (local continua fonte de verdade, Supabase vira espelho best-effort) — reverte para o estado atual do `CreateReceivableDialog`.

---

## 6. Fechamento — estimativa honesta

**O flip de Financeiro é maior que o de Projetos**, por três razões concretas, não por impressão:

1. **Projetos partiu de um schema já 1:1 com poucos gaps** (o pacote de Projetos cita objetos como `deliverables` como a única lacuna relevante além do status/O12). **Financeiro tem 5 gaps de schema simultâneos** (categoria, fornecedor, conta-caixa, forma de pagamento, recorrência) — nenhum tem tabela cloud hoje. Cada um decide entre "criar tabela nova" ou "aceitar perda de campo no flip", e são decisões de produto, não só técnicas.
2. **Projetos já tinha `useBifurcatedProjects` e um `getProjectsDataSource()` prontos antes da Fase B começar** (só faltava ligar CRUD real). **Financeiro não tem NENHUMA flag de fonte de dados hoje** — a Fase A de Financeiro precisa desenhar essa flag do zero, não só ativar uma que já existe.
3. **Financeiro tem 2 diálogos de escrita inconsistentes já em produção** (`CreateReceivableDialog` com mirror, `QuoteToReceivableDialog` sem mirror) — unificar esse comportamento é pré-requisito documentado (`etapa-5-fatia-6-finance.md` §9), não algo que a Fase A de Projetos precisou resolver.

Compensando parcialmente: o repository/mapper (`financeRepository.ts`, `financeMapper.ts`) e a reconciliação de FK via import-map já existem e são reaproveitáveis — a Fatia 6 (import assistido) já fez boa parte do trabalho de tradução local↔cloud que Projetos teve que construir do zero na sua própria Fase B. Isso reduz, mas não elimina, a diferença de tamanho.

**Insumo para a decisão do operador**: Financeiro não é um flip "curto" no molde de Projetos. Se a ordem entre Financeiro e Etapa 9 for decidida por esforço, Financeiro pesa mais — em especial pelas 5 decisões de schema pendentes do §3/§5 Caso 5, que são de produto e não puramente técnicas.

---

## Referências

- `docs/qa/etapa-5-flip-projetos-pacote.md` — molde de estrutura/profundidade usado aqui
- `docs/qa/etapa-5-fatia-6-finance.md` — import assistido já homologado, base de código reaproveitável
- `docs/architecture/kora-roadmap.md` §3.4 — status "dual-write parcial, leitura local por padrão" e critério de pronto já registrado (linhas 110-125)
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G22 (fix do dual-write atual), G29 (lição de banner de UI desatualizado)
- `docs/integrations/INTEGRATIONS-ROADMAP.md` §4-§6 — Asaas/Pix bloqueados na Fase 4, fora de escopo deste flip
