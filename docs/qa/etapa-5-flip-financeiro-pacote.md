# Etapa 5 — G1/Financeiro — Pacote do Flip — Fase A executiva (desenho)

> Zero mudança de código nesta fase — molde de `docs/qa/etapa-5-flip-projetos-pacote.md` (o "pacote" é a camada de desenho executável que a Fase B código vai implementar; o inventário puro já foi feito em `docs/architecture/etapa-5-flip-financeiro-fase-a.md`, base direta deste doc).

## Abertura

- Branch: `etapa-5-flip-financeiro-pacote`, a partir do tip real de `origin/main`.
- Hash confirmado por `git log origin/main -1`: **`49545ec`** (`fix(tasks): G40 - R1, updateTaskStatus perdia "revisao" do vocabulario local`) — bate com o esperado.
- **Decisões já tomadas pelo revisor, incorporadas sem rediscussão:**
  - Flags: `kora.finance.dataSource.v1` (default `"local"` pré-flip) + `kora.finance.supabaseWrite.enabled` (opt-in, default OFF, pré-flip) — mesma convenção de `kora.projects.dataSource.v1`/`kora.projects.supabaseWrite.enabled`.
  - **Lição G37 aplicada por desenho** (não reativamente): todo espelho/mapper de Financeiro nasce com payload completo + passthrough de UUID nas FKs.
  - **Lição G30 aplicada por desenho**: mutações de escrita real (`updateTransaction`) escrevem no cache React Query com a resposta do próprio `UPDATE`, nunca só `invalidateQueries()`.

---

## 1. Gaps de schema — bloqueantes vs. pós-flip

Dos 5 gaps identificados na Fase A (`etapa-5-flip-financeiro-fase-a.md` §3): **2 bloqueiam, 3 ficam pós-flip.** Critério de decisão: um gap bloqueia quando (a) é tecnicamente barato de fechar (coluna `text` simples, sem nova tabela/domínio) e (b) sua ausência degrada a tela principal (`Financeiro.tsx`) de forma visível no dia 1. Um gap fica pós-flip quando fechá-lo exigiria construir um domínio relacional novo (tabela própria, FK, UI de gestão) — escopo de produto, não de flip de storage.

### 1.1 Bloqueantes (migration proposta, não aplicada)

| Campo local | Por que bloqueia | Natureza |
|---|---|---|
| `category` | Toda transação exibe/filtra por categoria em `Financeiro.tsx` — sem a coluna, a tela principal perde uma faceta usada em toda transação, não só em casos de borda. Localmente é texto livre definido pelo workspace (`FinanceCategory[]`, `useFinance.ts:100-106`) — nunca foi um enum fixo, então a coluna cloud também não precisa de CHECK. | Coluna `text` simples, sem relação |
| `paymentMethod` | Enum pequeno e fechado (`"pix"\|"card"\|"boleto"\|"transfer"\|"cash"\|"other"`, `useFinance.ts:7`), usado na aba "Transações" pra toda entrada. Barato de adicionar e — diferente de `category` — vale CHECK desde o dia 1 (mesmo raciocínio do G40, ver §2). | Coluna `text` + CHECK, sem relação |

```sql
-- PROPOSTA — não aplicada nesta rodada. Confirmar com o operador antes de aplicar
-- (Code não roda SQL contra produção, protocolo §0/§6).
ALTER TABLE public.financial_transactions
  ADD COLUMN category text NULL,
  ADD COLUMN payment_method text NULL,
  ADD CONSTRAINT financial_transactions_payment_method_known_chk
    CHECK (payment_method IS NULL OR payment_method IN ('pix','card','boleto','transfer','cash','other'));
```

### 1.2 Pós-flip (decisão de escopo de produto, não deste pacote)

| Campo local | Por que NÃO bloqueia | O que faltaria pra fechar |
|---|---|---|
| `supplierId` | Só usado em transações `type="expense"` — fatia menor da tela. Fechar exigiria uma tabela `suppliers` própria (nome, contato, etc.) — um domínio novo, não uma coluna. | Tabela `suppliers` + FK + tela de gestão de fornecedores na nuvem |
| `cashAccountId` | Usado só na aba "Caixa" (gestão de saldo por conta) — feature de produto mais funda que "guardar um id". Fechar como coluna solta sem tabela de contas perderia o propósito (saldo agregado por conta). | Tabela `cash_accounts` (com saldo derivado) + FK + UI |
| `recurrence` | **O maior gap dos 5** — não é só um campo, é uma sub-feature inteira: `RecurringEntry[]` (`useFinance.ts:173-186`, chave `kora.finance.recurring.v1`) é um store SEPARADO de templates que geram transações futuras. Fechar isso exige lógica de geração (quem cria a próxima ocorrência? client-side ao abrir o app, ou um cron server-side?), não uma migration de coluna. | Tabela `recurring_entries` + mecanismo de geração (decisão de arquitetura própria, fora do escopo de um flip de storage) |

**Comportamento com os 3 campos pós-flip, em modo Supabase**: nem perder silenciosamente, nem bloquear a ação — a transação salva normalmente (os 3 campos simplesmente não têm coluna pra ir), e a UI mostra um aviso pontual explícito ("Fornecedor/Conta/Recorrência ainda não sincronizam com a nuvem — disponível só em modo Local") quando o usuário tenta usar um desses campos com `dataSource=supabase`. Decisão de UX final (aviso inline vs. desabilitar o campo) fica para a Fase B — este pacote só fecha que a transação em si não é bloqueada por causa deles.

---

## 2. Mapper — desenho campo a campo + equivalente-O12 resolvido por desenho (G40)

### 2.1 Vocabulário oficial de `status`/`type` ANTES de existir dado ruim

**Este é o núcleo da lição G40 aplicada aqui**: em Tarefas, o vocabulário divergente (`updateTaskStatus` só aceitava 3 de 4 valores) só foi corrigido DEPOIS de um caminho de escrita real já estar em produção perdendo dado (perda silenciosa confirmada em produção, string vazia). Em Projetos, o O12 original também foi reativo — o CHECK só chegou depois do `status='archived'` cru já ter sido gravado por escritas antigas. **Financeiro tem a vantagem de a Fase A ter identificado o risco antes de qualquer escrita nova existir** — nenhuma linha de `financial_transactions` foi gravada por um caminho que ainda não segue o vocabulário local (todo escritor até hoje — `createReceivableFromQuote`, `mapLocalTransactionToSupabase` via `CLOUD_TYPE`, `importTransaction` — já usa exatamente os 4 valores de `TxStatus`/2 de `CLOUD_TYPE`), então o CHECK abaixo pode entrar **preventivamente, sem shim de tradução**:

```sql
-- PROPOSTA — não aplicada nesta rodada. Confirmar com o operador que não há linha
-- fora do vocabulário antes de aplicar (protocolo §0/§6) — expectativa é ZERO, já
-- que todo escritor até hoje já usa esse vocabulário verbatim, mas confirmar, não supor.
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_type_known_chk
    CHECK (type IN ('receivable', 'payable')),
  ADD CONSTRAINT financial_transactions_status_known_chk
    CHECK (status IN ('pending', 'paid', 'overdue', 'canceled'));
```

Diferença de mecanismo em relação a Projetos/Tarefas: lá o CHECK forçou um shim de tradução (`translateLocalProjectStatusToCloud`/`normalizeCloudTaskStatus`) porque o vocabulário JÁ divergia. Aqui, como local e cloud já usam os mesmos 4+2 valores literais, **não há tradução de vocabulário a escrever** — só a proteção contra um futuro caminho de escrita (ainda não existente) introduzir um valor fora do contrato.

### 2.2 Passthrough de UUID nas FKs — G37 por desenho, não por incidente

`resolveFinanceFk` (`financeMapper.ts:43-49`) hoje trata TODO `localId` como id local a procurar no import-map — a mesma causa raiz do G37 (Projetos): se uma FK chegar como uuid real (ex.: `quoteId` vindo de uma quote já lida da nuvem, não de import), o lookup no map sempre falha e a FK vira `null` silenciosamente. Correção proposta, já no desenho da Fase B (não como fix reativo de uma futura homologação):

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveFinanceFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  const key = String(localId);
  if (UUID_RE.test(key)) return key; // já é uuid real — nunca procura no import-map (G37)
  return map[key] ?? null;
}
```

### 2.3 Payload completo — todo campo que existe na coluna, existe no payload

Lição G37, segunda metade (o `deliverables` esquecido no payload de `mapLocalProjectToSupabase`): a checklist de revisão do mapper de Financeiro na Fase B precisa confirmar, campo a campo, que TODO campo com coluna cloud está no objeto retornado por `mapLocalTransactionToSupabase` — incluindo os 2 novos do §1.1 assim que a migration entrar:

| Campo local | Coluna cloud | Tratamento |
|---|---|---|
| `type` | `type` | Traduzido via `CLOUD_TYPE` (já existe, `financeMapper.ts:51`) |
| `status` | `status` | Passagem direta (já existe) — agora protegido por CHECK preventivo (§2.1) |
| `title`, `description`, `dueDate→due_date`, `paidDate→paid_at`, `source`, `amount` | idem | Já existe (`financeMapper.ts:110-116`) |
| `clientId`, `quoteId`, `opportunityId` | `client_id`, `quote_id`, `opportunity_id` | Já existe, ganha o passthrough de UUID (§2.2) |
| **`category`** | `category` *(nova, §1.1)* | **A adicionar no payload** — `category: transaction.category ?? null` |
| **`paymentMethod`** | `payment_method` *(nova, §1.1)* | **A adicionar no payload** — `payment_method: transaction.paymentMethod ?? null` |
| `notes` | *(sem coluna — já fundido em `description`)* | Comportamento mantido, decisão de Fase A anterior |
| `supplierId`, `cashAccountId`, `recurrence` | *(sem coluna, pós-flip §1.2)* | **Não entram no payload** — omitidos, não `null` forçado por engano |

### 2.4 Direção de leitura — mapper que ainda não existe

**Achado desta rodada**: `financeMapper.ts` só tem a direção de escrita (`mapLocalTransactionToSupabase`) — ao contrário de `projectsMapper.ts`/`quoteMapper.ts`, **não existe `mapSupabaseTransactionToLocal`**. É trabalho de Fase B, não um gap a "descobrir" depois: bifurcar a leitura (§3) exige converter `SupabaseFinancialTransaction` → `Transaction` local, campo a campo (mesma tabela do §2.3, invertida), incluindo derivar `clientName`/`quoteTitle` (denormalizados, resolvidos por join/lookup local — mesmo padrão de `mapSupabaseProjectToLocal` recebendo um `clientNameById`).

Também falta `financeRepository.listTransactions` (todas, não só `type='receivable'`) — `listReceivables` (`financeRepository.ts:89-100`) filtra só recebíveis, insuficiente pra alimentar a tela principal que mostra receivable E payable juntos.

### 2.5 Escrita real — `updateTransaction` novo, `createTransaction` reaproveitando `importTransaction`

- **`updateTransaction(workspaceId, transactionId, patch)`** — novo em `financeRepository.ts`, mesmo formato de `projectsRepository.updateProject`: `UPDATE ... WHERE id AND workspace_id`, devolve a linha via `.select().single()`.
- **`createTransaction` (nativa, modo Supabase)** — não precisa de função nova: reaproveita `financeRepository.importTransaction(workspaceId, buildNativeSourceLocalId(), payload)`, mesmo precedente já usado por Projetos (`useSupabaseProjects.ts`, citado no pacote de Projetos §6.2 — "criação NATIVA via `buildNativeSourceLocalId()` + `projectsRepository.importProject`") e por Quotes antes dele (Q10). O `importTransaction` já resolve os 2 arbiters de idempotência (`source_local_id` e o índice quote-linked) — uma criação nativa nunca colide com nenhum dos dois.
- **G30 por desenho**: a mutation de `updateTransaction` (React Query) escreve a linha devolvida pelo próprio `UPDATE` direto no cache via `setQueryData`, nunca só `invalidateQueries()` — mesmo fix que Projetos precisou aplicar reativamente (G30) depois de um drawer aberto ficar preso mostrando status antigo.

---

## 3. Plano de bifurcação dos consumidores

**Hook novo**: `useBifurcatedFinance()`, mesmo molde de `useBifurcatedProjects.ts` — read-only por design (só os componentes fora da tela principal), leitura via `getFinanceDataSource()`:

```ts
export function useBifurcatedFinance(): Transaction[] {
  const { transactions: localTransactions } = useFinance();
  const { transactions: supabaseTransactionsRaw } = useSupabaseFinanceAll(); // §2.4, listTransactions
  const supabaseTransactions = useMemo(
    () => supabaseTransactionsRaw.map((st) => mapSupabaseTransactionToLocal(st, /* lookups denormalizados */)),
    [supabaseTransactionsRaw],
  );
  return getFinanceDataSource() === "supabase" ? supabaseTransactions : localTransactions;
}
```

**Achado reaproveitável**: `useSupabaseFinancialSummary.ts` já existe e já segue o padrão correto de gate (`enabled: !!workspaceId`, `useSupabaseFinancialSummary.ts:14` — **não** `enabled: dataSource === "supabase"`, mesmo padrão confirmado como "design da casa" pelo G32 de Projetos). Só precisa: (a) trocar `listReceivables` por um novo `listTransactions` (todas, não só recebíveis) e (b) renomear/generalizar o hook (ou criar um irmão) já que hoje ele é nomeado e documentado como "summary de recebíveis" especificamente.

### 3.1 Consumidores a bifurcar (5 de classe (a), Fase A §2)

| Arquivo | Ação |
|---|---|
| `useDayCenterData.ts` | Trocar `useFinance()` por `useBifurcatedFinance()` |
| `DayCenter.tsx` / `useDayCenterActions.ts` | Leitura via `useBifurcatedFinance()`; escrita (`updateTransactionStatus`) segue local-only por enquanto — mesma decisão que Projetos tomou pro onboarding (classe b), já que "concluir transação" pela Central do Dia não é a rota crítica desta fatia |
| `ClientProfileDrawer.tsx` | Trocar `useFinance()` por `useBifurcatedFinance()`, mesmo padrão já usado ali para projetos |
| `ClientActivitiesTab.tsx` | Ver §3.2 — rota crítica |
| `QuoteToReceivableDialog.tsx` | Ver §5 — não é uma bifurcação de leitura, é o segundo diálogo de escrita a unificar |

### 3.2 `ClientActivitiesTab.tsx` — atenção especial, 3 domínios no mesmo arquivo

Já mapeado na Fase A (`etapa-5-flip-financeiro-fase-a.md` §2, achado estrutural): este arquivo acumula `useBifurcatedProjects` (já migrado), `useFinance()` cru (Financeiro — objeto deste pacote) e `useTasks()` cru (Tarefas — flip próprio, ainda não desenhado como pacote). Com este pacote, o arquivo passa de "1 bifurcado + 2 crus" para "**2 bifurcados + 1 cru** (tasks)".

**Risco de coordenação, não técnico**: este é o segundo pacote de flip a tocar este arquivo (depois de Projetos) e — se a Etapa 5 continuar avançando por domínio — não será o último (Tarefas ainda falta). Antes de editar, confirmar no `git log -- src/components/clients/ClientActivitiesTab.tsx` se alguma outra lane tem trabalho em voo no mesmo arquivo, para não colidir com uma edição concorrente da mesma rota crítica — mesmo cuidado que já valeu para o G34/G37 (renumeração por colisão) em outro arquivo.

---

## 4. Import local→nuvem — já existe, já foi homologado (diferente de Projetos)

**Achado que muda a lição de Projetos aqui**: em Projetos, o R4 foi "`useLocalProjectsImport.ts` foi construído mas nunca homologado numa rodada de verdade — import nunca homologado é import que não existe." **Para Financeiro isso já não se aplica da mesma forma**: `useLocalFinanceImport.ts` + `LocalFinanceImportCard.tsx` (Etapa 5, Fatia 6) **já rodaram uma homologação real, executada e aprovada** (`docs/qa/etapa-5-fatia-6-finance.md` §10-11, "Resultado da rodada — EXECUTADA (vai do revisor)"), cobrindo 5 casos via seed em produção: caminho geral (upsert por `source_local_id`), caminho quote-linked (arbiter dedicado), FK órfã, linha pré-existente (backfill de `source_local_id`), e idempotência (reimport não duplica). Confirmado também no roadmap (`kora-roadmap.md:25`): **"Import homologado (5/5); cutover de leitura/escrita default ainda pendente."**

**O que ainda falta, então, não é homologar o import do zero — é re-confirmar que ele continua correto depois das mudanças deste pacote**, no molde do `LocalProjectsImportCard.tsx` como referência de UI (Configurações → "Importar..."), mas como uma rodada de **regressão**, não de primeira homologação:

1. Os 2 campos novos (`category`, `payment_method`, §1.1) entram no payload de import (`mapLocalTransactionToSupabase`, §2.3) — confirmar que o import volta a rodar limpo com os campos novos presentes.
2. O passthrough de UUID (§2.2) não deveria afetar o import geral (que sempre trabalha com ids locais genuínos, não uuids) — mas vale um caso de regressão confirmando que `resolveFinanceFk` com um id local comum (não-uuid) continua indo pro import-map normalmente, sem o passthrough capturar por engano um id local que parece um uuid (extremamente improvável dado o formato de id local usado, mas o teste automatizado do mapper — não uma rodada semeada — já cobre isso, mesmo padrão do teste que o G37 acrescentou em `projectsMapper.test.ts`).
3. **Volume real do operador**: mesma pergunta de runbook que Projetos fez — quantas transações reais (não-demo) existem em `orbyt.finance.v1` hoje que ainda não estão em `kora.finance.supabaseImport.v1.importedMap`? Code não acessa `localStorage` do operador (protocolo §0/§6) — pergunta pro runbook da Fase D, não resolvida aqui.

---

## 5. Interação com o já-existente

### 5.1 Recebíveis de quote (`financial_transactions` já homologado) — como convive com o flip

`CreateReceivableDialog.tsx` (CRM) já grava local + espelha via `createReceivableFromQuote` (dual-write, atrás de `kora.quotes.supabaseCreateReceivable.enabled`) — este pacote **não substitui** esse caminho, ele passa a ser um dos DOIS produtores de `financial_transactions` que a tela principal, em modo Supabase, vai ler de volta (Caso 3 de homologação, Fase A §5, já antecipava isso). Nenhuma mudança de comportamento nesse dialog é necessária — ele já produz linhas no formato certo.

`QuoteToReceivableDialog.tsx` (Vendas) é o gap real: só grava local, sem mirror nenhum — mesmo achado da Fase A. Proposta: ganha o **mesmo espelho best-effort G22** que `CreateReceivableDialog.tsx` já tem, unificando o comportamento dos 2 diálogos (pré-requisito já documentado em `etapa-5-fatia-6-finance.md` §9). Sem isso, o segundo diálogo continua sendo uma fonte de "recebível que desaparece" assim que a leitura virar Supabase-default — mesma classe do R5 de Projetos (`QuoteToProjectDialog.tsx`).

### 5.2 Asaas/Pix — trava explícita, continuam dormindo

Nenhuma mudança neste pacote acorda Asaas/Pix — confirmado na Fase A (`etapa-5-flip-financeiro-fase-a.md` §4): ambos são Fase 4 do roadmap de integrações, posterior e independente da migração de storage tratada aqui. **Trava explícita**: nenhuma migration, mapper, ou UI deste pacote deve introduzir uma coluna, campo, ou texto que sugira início de integração de pagamento real — os 2 campos novos do §1.1 (`category`, `payment_method`) são metadados de classificação, não trilhos de cobrança (`payment_method` grava a FORMA declarada, não processa nada).

---

## 6. Fases B/C/D e homologação

### 6.1 Sequência (mesma ordem de Projetos — não flipar leitura antes da escrita estar pronta)

1. **Fase B (código)**: migrations do §1.1/§2.1 (com "vai" próprio antes de aplicar em produção — Code não aplica DDL, protocolo §8-b), mapper (§2), repository (`updateTransaction`, `listTransactions`), `useBifurcatedFinance` + 3 consumidores migrados (§3.1), `ClientActivitiesTab.tsx` com atenção de coordenação (§3.2), `QuoteToReceivableDialog.tsx` ganhando espelho G22 (§5.1). `tsc`/lint/testes verdes, PARA pra aprovação — mesmo padrão de todas as fatias anteriores.
2. **Fase C (flip dos defaults)**: `kora.finance.dataSource.v1` → `supabase` E `kora.finance.supabaseWrite.enabled` → opt-out (default ON), no mesmo pacote (precedente de `quotes`/`projects` — decidem os dois juntos).
3. **Fase D (homologação B.3)**: runbook próprio, cenário sintético (`HOMOLOG-FLIP-financeiro`), print por caso.

### 6.2 Casos de homologação (7)

1. **Leitura em modo Supabase**: transações já existentes na nuvem (recebíveis de quote homologados) aparecem em `Financeiro.tsx` sem duplicar as locais equivalentes.
2. **Escrita nativa (criar transação manual em modo Supabase)**: usa `createTransaction`/`importTransaction` (§2.5) — grava com `source='manual'`, `category`/`payment_method` preenchidos, aparece sem reload.
3. **Edição real refletida na própria mutação (G30)**: marcar uma transação como "paga" pela tela; o próprio componente que disparou a escrita reflete sem fechar/reabrir — mesmo caso 2b do doc de Fase A, agora com código real por trás.
4. **Consistência cruzada — os 2 diálogos de recebível**: gerar um recebível por `CreateReceivableDialog` (CRM) E por `QuoteToReceivableDialog` (Vendas, pós-fix do §5.1); os dois aparecem em `Financeiro.tsx` em modo Supabase, sem duplicata (`source_local_id`/`ux_ft_receivable_from_quote`).
5. **Campos pós-flip (§1.2) não bloqueiam nem perdem silenciosamente**: criar/editar transação usando fornecedor/conta/recorrência em modo Supabase — aviso explícito aparece, transação salva mesmo assim.
6. **`ClientActivitiesTab.tsx` com os 2 domínios bifurcados**: projetos E finanças de um cliente sintético aparecem corretos na timeline, tasks (ainda cru) sem regressão visível.
7. **Regressão do import (§4)**: rodar "Importar transações locais" pós-Fase B; os 5 casos da Fatia 6 (`etapa-5-fatia-6-finance.md` §10) continuam verdes com os campos novos no payload.

### 6.3 Rollback — 2 níveis, mesmo padrão da casa

- **Nível 1 (imediato, sem código)**: `kora.finance.dataSource.v1=local` — reversível a qualquer momento, sem perda (transações criadas em modo Supabase somem da view local, não são apagadas). A flag de escrita sozinha não bloqueia CRUD (lição G29) — só a combinação com `dataSource=local` garante leitura 100% local.
- **Nível 2 (revert de código)**: só se o Nível 1 não bastar — `git revert` do commit de flip, mantendo o schema/mapper (Fase B) intactos, mesmo tratamento de Projetos.

---

## Fechamento — estimativa

Confirma a estimativa da Fase A (`etapa-5-flip-financeiro-fase-a.md` §6): **maior que o flip de Projetos**, agora com números concretos em vez de comparação qualitativa — 2 migrations (colunas+CHECK, §1.1/§2.1), 1 mapper de leitura inteiro a construir do zero (§2.4, Projetos já tinha), 1 repository method novo (`listTransactions`) além de `updateTransaction`, 5 consumidores a bifurcar (mesmo número de Projetos) mais a atenção de coordenação em `ClientActivitiesTab.tsx` (2º pacote a tocar o arquivo), e 1 diálogo (`QuoteToReceivableDialog.tsx`) precisando do espelho G22 que Projetos não teve equivalente (`QuoteToProjectDialog.tsx` já nasceu com o espelho na fatia anterior, resolvido lá).

Compensando: o import já está homologado (§4, diferente do R4 de Projetos), o CHECK preventivo do §2.1 não precisa de shim de tradução (diferente de O12/G40), e o padrão de criação nativa via `importTransaction` já existe pronto pra reaproveitar (§2.5) sem inventar um caminho novo.

**Insumo para o operador**: este pacote é 1 fatia (Fase B + C + D), do mesmo tamanho de esforço do Pacote do Flip de Projetos — não maior o suficiente para justificar quebrar em duas rodadas, mas com mais peças móveis simultâneas (2 migrations + mapper de leitura novo + 1 diálogo a corrigir) do que Projetos teve na sua própria Fase B.

---

## Referências

- `docs/architecture/etapa-5-flip-financeiro-fase-a.md` — inventário-base desta rodada
- `docs/qa/etapa-5-flip-projetos-pacote.md` — molde de estrutura/profundidade, precedente direto de `updateProject`/`useBifurcatedProjects`/criação nativa via `importProject`
- `docs/qa/etapa-5-fatia-6-finance.md` §10-11 — homologação já executada do import (5/5)
- `docs/architecture/kora-hub-auditoria-e-plano.md` — G22 (dual-write existente), G29 (banner desatualizado), G30 (cache de mutação), G32 (fetch paralelo é design da casa), G37 (payload de espelho incompleto + passthrough de UUID), G40 (vocabulário cloud incompleto — equivalente-O12 de Tarefas)
- `docs/architecture/kora-roadmap.md` §3.4 — status de Financeiro pré-flip
