# Etapa 5 · Fatia 6 — `financial_transactions` (finance)

> **Escopo desta entrega:** **Fase A apenas** — diagnóstico de leitura pura, pelos invariantes do
> molde [Espelho Reversível](../architecture/espelho-reversivel.md) e do
> [protocolo de homologação](protocolo-homologacao.md) (§8/§9). **Nenhuma rodada de
> homologação, migration ou escrita em banco/localStorage foi executada.** Proposta, não
> aprovada.
>
> **Enquadramento, verificado nesta leitura (lição da Fatia 4 aplicada — ver §2):** o CRUD
> principal de finance (`useFinance()`, tela `Financeiro.tsx`) **é greenfield** — 100%
> `localStorage`, sem nenhum cutover silencioso tipo `useClientsDataSource`. Mas a tabela
> `financial_transactions` **já não está vazia nem intocada**: existe, desde a Etapa 3, um fluxo
> estreito e já em produção (`financeRepository.ts` + `CreateReceivableDialog.tsx`) que cria
> **recebíveis nativos da nuvem** a partir de **orçamentos já migrados** — com seu próprio
> contrato de idempotência (`ux_ft_receivable_from_quote`, índice único parcial). Qualquer
> mecanismo de import geral que a Fatia 6 desenhar **tem que conviver** com esse contrato
> existente, não substituí-lo nem duplicá-lo. Esta é a complexidade central da fatia.

---

## 0. Registros necessários — queries para o OPERADOR rodar (Code não acessa banco nem browser)

Workspace de teste (mesmo das Fatias 1-4): `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`.

### 0.1 Nuvem (SQL Editor do Supabase)

```sql
-- (1) Contagem total de financial_transactions vivas (deleted_at IS NULL)
select count(*) from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null;
```

```sql
-- (2) Quebra por type/source/status — perfil do que já existe na nuvem
select type, source, status, count(*) as qtd, sum(amount) as soma
from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and deleted_at is null
group by type, source, status
order by type, source, status;
```

```sql
-- (3) Colunas atuais de public.financial_transactions (checar drift schema-vs-código)
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'financial_transactions'
order by ordinal_position;
```

```sql
-- (4) Estado do índice de fan-in (Etapa 3 S5) — indisvalid/indisunique + definição exata
select indexrelid::regclass as index_name, indisvalid, indisunique,
       pg_get_indexdef(indexrelid) as definition
from pg_index
where indexrelid = 'public.ux_ft_receivable_from_quote'::regclass;
```

```sql
-- (5) Confirma os demais índices de performance (batch2) existem
select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'financial_transactions'
order by indexname;
```

```sql
-- (6) Recebíveis já ligados a quotes migradas — estado atual do fan-in quote->finance
select ft.id, ft.title, ft.amount, ft.quote_id, ft.client_id, ft.opportunity_id,
       ft.source, ft.created_at, q.title as quote_title, q.source_local_id
from public.financial_transactions ft
join public.quotes q on q.id = ft.quote_id
where ft.workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and ft.deleted_at is null
order by ft.created_at;
```

### 0.2 Local (console do navegador, origem de produção)

```js
// (7) Total local (inclui demo)
JSON.parse(localStorage.getItem("orbyt.finance.v1")).length
```

```js
// (8) Reais — mesmo critério isDemo das Fatias 3/4
JSON.parse(localStorage.getItem("orbyt.finance.v1")).filter(t => !t.isDemo).length
```

```js
// (9) Lista dos reais, com os 3 campos de fan-out (clientId/quoteId/opportunityId)
console.table(
  JSON.parse(localStorage.getItem("orbyt.finance.v1"))
    .filter(t => !t.isDemo)
    .map(t => ({
      id: t.id, title: t.title, type: t.type, source: t.source, amount: t.amount,
      status: t.status, clientId: t.clientId, quoteId: t.quoteId, opportunityId: t.opportunityId,
    }))
)
```

```js
// (10) Fan-in "molhado ou seco"? Quantos reais têm quoteId setado (referência a
//      LOCAL quote id — precisa tradução via kora.quotes.supabaseImport.v1 antes
//      de virar quote_id na nuvem)
JSON.parse(localStorage.getItem("orbyt.finance.v1"))
  .filter(t => !t.isDemo && t.quoteId)
  .map(t => ({ id: t.id, title: t.title, quoteId: t.quoteId, amount: t.amount }))
```

```js
// (11) Desses quoteIds (query 10), quais já têm UUID de nuvem mapeado —
//      cruza com o import-map de quotes já usado pelas Fatias 3/4
const localTxWithQuote = JSON.parse(localStorage.getItem("orbyt.finance.v1"))
  .filter(t => !t.isDemo && t.quoteId);
const quoteMap = JSON.parse(localStorage.getItem("kora.quotes.supabaseImport.v1") || '{"importedMap":{}}');
localTxWithQuote.map(t => ({ quoteId: t.quoteId, quoteUuidNaNuvem: quoteMap.importedMap[t.quoteId] || null }))
```

```js
// (12) Log local do fluxo já existente CreateReceivableDialog (Etapa 3, se algum
//      recebível já foi gerado direto na nuvem por essa via) — contexto, não é
//      fonte de verdade (a fonte é a nuvem, query 6)
JSON.parse(localStorage.getItem("kora.quotes.supabaseReceivables.v1") || "[]")
```

**Preencher após rodar:** todos os resultados colados brutos. A query (10)+(11) juntas decidem se
o fan-in está "molhado" (existe transação real com quoteId já mapeado — cenário de risco de
duplicata contra `ux_ft_receivable_from_quote` se o import não tratar 23505) ou "seco" (nenhuma
— import geral não colide com o contrato da Etapa 3 na prática, só precisa estar *desenhado*
para não colidir).

---

## 1. Auditoria por invariante (Fase A)

| Inv. | Ponto | Veredito |
|---|---|---|
| (a) | Não apaga local antes do remoto | ✅ OK — nenhum código de finance escreve na nuvem a partir de `orbyt.finance.v1` hoje (ver §2) |
| (b) | Idempotência | ⛔ **MISTA** — Variante B necessária pro caso geral + Variante-A-like já existe pro subset quote-linked, precisam coexistir sem colidir |
| (c) | Leitura server-side | 🟡 parcial — só existe pro card operacional (§2), não pro CRUD principal |
| (d) | Reversibilidade | N/A ainda — sem cutover, sem flag, nada a reverter |
| (e) | Disparo consciente | N/A ainda — nenhum import de finance existe (verificado, não presumido — ver §2) |
| + | FK / dependentes | ✅ sem drift nas 3 FKs (`client_id`/`quote_id`/`opportunity_id` já existem desde a criação da tabela); **sem dependentes** (leaf table) |
| + | Atomicidade pai-filho | ✅ **N/A** — `financial_transactions` não tem filhos (sem parcelas, sem itens); `recurring` é registro local **separado**, nunca uma sub-linha de uma transação |
| + | Precisão monetária | 🟡 ajuste — sem `roundMoney` em nenhum dos 2 caminhos que gravam `amount` hoje |
| + | Drift schema-vs-código | ✅ **sem drift** — contraste positivo com a Fatia 3 original |

### (a) Não apaga o local — ✅ OK

`useFinance()` (`src/hooks/useFinance.ts`) só lê/escreve `localStorage` (`orbyt.finance.v1` +
5 chaves auxiliares — suppliers/categories/pix/recurring/cash). Nenhuma chamada a
`financeRepository` nem a `supabase` existe nesse arquivo. Não há caminho de código que apague
`orbyt.finance.v1` a partir de nada relacionado à nuvem, porque nada relacionado à nuvem toca
essa chave hoje.

### (b) Idempotência — ⛔ MISTA, o achado central da fatia

Não existe `source_local_id` em `financial_transactions`, nem qualquer UNIQUE geral. **Mas existe
um UNIQUE parcial já em produção**, de uma feature que **não é desta fatia** (Etapa 3, CRM):

```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_ft_receivable_from_quote
  ON public.financial_transactions (quote_id)
  WHERE source = 'quote' AND type = 'receivable' AND deleted_at IS NULL;
```

Isso cobre **só** o subconjunto "recebível com `source='quote'` e `type='receivable'`" — nada
protege duplicidade de transações manuais, de serviço, de venda ou recorrentes. Para essas, o
padrão de todas as fatias anteriores (Variante B — `source_local_id` + índice não-parcial
`UNIQUE(workspace_id, source_local_id)`) se aplica normalmente.

**A complicação real:** uma transação local real pode ter `type: "income"`, `source: "quote"` **e**
um `quoteId` preenchido (ver §0.2, query 10) — nesse caso, importá-la exercita **os dois
contratos ao mesmo tempo**: o novo `source_local_id` (idempotência geral do import) **e** o
`ux_ft_receivable_from_quote` já existente (regra de negócio "no máximo 1 recebível vivo por
orçamento"). Se o mesmo orçamento já tiver um recebível criado por
`CreateReceivableDialog.tsx` (fluxo do CRM, já em produção), tentar importar a transação local
correspondente **precisa** cair no mesmo padrão de `financeRepository.createReceivableFromQuote`
— catch de `23505` tratado como "já existe, devolver o existente" — e **nunca**
`upsert(onConflict: "workspace_id,source_local_id")` sozinho, que erraria ao não saber sobre o
segundo índice. Ver F2/F3.

### (c) Leitura server-side — 🟡 parcial

`useSupabaseFinancialSummary.ts` já está em React Query (comentário confirma "A2"), mas só é
consumido por `SupabaseOperationalDashboardCard.tsx` (card operacional em Configurações) — **não**
pela tela principal `Financeiro.tsx`, que segue 100% local. Não é uma leitura "de produto", é uma
leitura de monitoramento.

### (d) Reversibilidade — N/A ainda

Não existe flag de fonte de dado pra finance (nem `useFinanceDataSource`, nem equivalente — ver
§2). Não há o que reverter porque não há cutover de leitura pra reverter. Diferente da Fatia 4
(onde (d) precisou ser reinterpretado porque o cutover já existia); aqui a resposta é mais simples:
o invariante ainda não entrou em jogo.

### (e) Disparo consciente — N/A ainda (verificado, não presumido)

Ver §2 — checagem explícita, motivada pelo achado da Fatia 4, de que não há cutover silencioso
equivalente em finance.

### FK / dependentes — ✅ sem drift, sem dependentes

`client_id`, `quote_id`, `opportunity_id` (todas `ON DELETE SET NULL`) já existem desde a
**criação** da tabela (migration `20260601020000`), não foram adicionadas depois — ao contrário de
`quotes` (que teve B-DRIFT real na Fatia 3, `client_id`/`opportunity_id` ausentes até a migration
Q1). Nenhuma tabela referencia `financial_transactions.id` como pai — é uma tabela-folha.

### Atomicidade pai-filho — ✅ N/A

Sem sub-tabela de itens/parcelas. `RecurringEntry` (`kora.finance.recurring.v1`) é um registro
**local, autônomo** — um template pra gerar transações futuras, não uma linha filha de uma
transação existente. Isso torna o import desta fatia estruturalmente mais simples que
`quotes`/`clients` (que precisaram de RPC atômica pai+filhos) — **um upsert simples por
transação, sem transação multi-tabela, resolve o caso geral.**

### Precisão monetária — 🟡 ajuste

Nenhum dos dois caminhos que gravam `amount` hoje usa `roundMoney`: `useFinance.addTransaction`
(local, linha 233-237) grava `data.amount` cru; `CreateReceivableDialog.handleConfirm` (linha 85-98)
grava o `amount` do estado do form cru. Mesma classe de gap que a Fatia 3 encontrou e corrigiu
(Q5) antes desta fatia existir — aqui ainda não foi corrigido em nenhum dos dois lugares.

### Drift schema-vs-código — ✅ sem drift

Todas as colunas que o código referencia (`client_id`, `quote_id`, `opportunity_id`, `type`,
`status`, `title`, `description`, `amount`, `due_date`, `paid_at`, `source`, `is_demo`, `archived`,
`deleted_at`) já existem na migration original. Contraste positivo com a Fatia 3.

---

## 2. Verificação de cutover silencioso (lição da Fatia 4 — checagem explícita, não presumida)

**Pergunta:** finance tem um `useClientsDataSource`-equivalente que já joga o CRUD principal pra
nuvem sem homologação, como `clients` tinha?

**Resposta: NÃO.** Verificado por leitura de código, não assumido:

- `grep useFinance(` em todo o `src/` retorna 8 consumidores — todos leem/escrevem via o hook
  local (`ClientActivitiesTab`, `ClientProfileDrawer`, `KoraOnboarding`, `DayCenter`,
  `QuoteToReceivableDialog`, `useDayCenterActions`, `useDayCenterData`, `Financeiro.tsx`).
  Nenhum tem branch condicional pra Supabase.
- Não existe nenhum arquivo `useFinanceDataSource.ts` nem padrão equivalente
  (`grep -i "FinanceDataSource"` no `src/` inteiro: zero resultados).
- O único código que escreve em `financial_transactions` (`financeRepository.ts`) é consumido só
  por `CreateReceivableDialog.tsx` (CRM) — que **não lê nem escreve `orbyt.finance.v1`**, opera
  inteiramente sobre dado que já nasce na nuvem (orçamento e cliente já migrados). Não é um
  cutover do CRUD local — é uma feature paralela, nativa da nuvem desde a Etapa 3.

**Achado lateral, registrado por importância (não bloqueante, fora do escopo estrito desta
fatia, mas relevante pro mesmo domínio):** existem **dois** diálogos de "gerar recebível a partir
de orçamento", com comportamento **inconsistente** entre si:

| Diálogo | Módulo | Onde grava |
|---|---|---|
| `QuoteToReceivableDialog.tsx` | Vendas | **local** (`useFinance().addTransaction`) |
| `CreateReceivableDialog.tsx` | CRM | **nuvem** (`financeRepository.createReceivableFromQuote`) |

Um usuário que gera o recebível pela tela de Vendas não vê esse lançamento nos relatórios que
dependem da nuvem (e vice-versa) — mesma classe de confusão que motivou o rigor desta etapa
inteira, só que entre dois módulos do próprio app, não entre local e nuvem "oficialmente". Não
proponho mexer nisso nesta fatia (mudaria comportamento de feature já em uso, fora do runbook de
migração); registro como **F5 catalogado** pra decisão futura do revisor.

---

## 3. Avaliação de risco — vs Fatias 2/3/4 (provisória, sem os números do §0)

| Eixo | Fatia 2 (opportunities) | Fatia 3 (quotes) | Fatia 4 (clients) | **Fatia 6 (finance)** |
|---|---|---|---|---|
| Ponto de partida | greenfield | greenfield (B-DRIFT) | já em produção (CRUD Supabase-first) | **greenfield confirmado** (verificado, §2) |
| Cutover silencioso | não | não | **sim** (achado central) | **não** (verificado) |
| Atomicidade pai-filho | N/A | RPC (achado central) | RPC (achado central) | **N/A — sem filhos** |
| Contrato de dedup pré-existente concorrente | não | não | não | **sim — `ux_ft_receivable_from_quote`, precisa coexistir** |
| Dado real em risco na nuvem hoje | 0 no início | 0 no início | 2 clients reais já ativos | depende do §0 (provavelmente baixo — feature de import nunca existiu) |
| FK/B-DRIFT | não | sim (Q1) | não | **não** |

**Leitura:** tecnicamente o ponto de partida mais simples das 4 fatias (greenfield confirmado, sem
B-DRIFT, sem filhos) — mas com uma peça de design genuinamente nova: coordenar um índice de
idempotência **novo e geral** com um índice de idempotência **parcial e específico** já em
produção, sobre a mesma tabela. Nenhuma fatia anterior teve dois contratos de unicidade
concorrentes sobre a mesma entidade.

---

## 4. Recomendação — PROPOSTA, aguardando aprovação (nenhuma fase liberada)

| # | Item | Classe | Fase | Resumo |
|---|---|---|---|---|
| F1 | Coluna `financial_transactions.source_local_id` (text, nullable) + índice **não-parcial** `UNIQUE (workspace_id, source_local_id)` | Bloqueante | B.2 (migration) | Padrão Q1/Q2/C1 — arbiter de idempotência geral. Coexiste com `ux_ft_receivable_from_quote` (índices diferentes, colunas diferentes, sem conflito de definição). |
| F2 | Desenho explícito do import: transação **sem** `quoteId` → upsert simples por `source_local_id`; transação **com** `quoteId` já mapeado → reusar `financeRepository.findReceivableByQuote`/`createReceivableFromQuote` (catch 23505), **gravando também** `source_local_id` na linha resultante | Bloqueante | B.1 (design) + B.2 | Fecha o achado de (b) — sem isso, importar uma transação quote-linked pode ignorar o contrato da Etapa 3 ou duplicar. |
| F3 | Fan-out de `client_id`/`quote_id`/`opportunity_id` via os 3 import-maps já provados (`kora.clients.supabaseImport.v1`, `kora.quotes.supabaseImport.v1`, `kora.crm.supabaseImport.v1`) | Ajuste | B.1 (código) | Mesmo padrão consolidado nas Fatias 2-4, sem novidade de desenho. |
| F4 | `roundMoney` em `amount` — nos dois caminhos (import novo + `CreateReceivableDialog` existente) | Ajuste | B.1 (código) | Fecha o gap de precisão monetária em ambos, não só no código novo. |
| F5 | Reconciliar `QuoteToReceivableDialog` (local) vs `CreateReceivableDialog` (nuvem) — mesma feature, dois comportamentos | Catalogado | decisão do revisor, fora desta fatia | Achado lateral (§2), não bloqueante pro fechamento de Fatia 6. |
| F6 | `suppliers`/`categories`/`pixSettings`/`recurring`/`cashAccounts` — **fora do escopo** desta fatia | Doc | — | Só `Transaction`/`financial_transactions` está em escopo; registrar explicitamente pra não gerar expectativa de que essas 5 chaves auxiliares migram junto. |
| F7 | `type`/`status`/`source` sem `CHECK` constraint no banco — qualquer string passa | Catalogado | baixo risco | Não bloqueante; registrar para eventual dívida técnica separada. |

**Nenhuma destas fases está liberada.** F1/F2 dependem do resultado do §0 (em particular, se a
query 10/11 mostrar fan-in "molhado", o desenho de F2 deixa de ser hipotético e vira o caminho
crítico da homologação).

---

## 5. Decisão F6 (revisor, 2026-07-21) — medições e reclassificação

| Medida | Valor |
|---|---|
| `financial_transactions` vivas na nuvem | **0** |
| Transações locais demo | **8** |
| Transações locais reais | **0** |
| Fan-in (reais com `quoteId`) | **SECO** — 0, por não haver reais |
| Índice `ux_ft_receivable_from_quote` | `indisvalid = true`, `indisunique = true` |

**Não há dado real em nenhum lado.** Reclassificação: a fatia vira **instalação de infra de
import**, homologada **100% por rodada semeada** — não existe Rodada 2 real porque não existe
dado a migrar. Momento mais barato possível para esta mudança: tabela vazia dos dois lados, sem
risco de tocar dado real durante o design ou a aplicação.

---

## 6. Design — Idempotência: Variante B + regra de coexistência com o índice parcial

**Dois arbiters, dois propósitos, nunca um no lugar do outro:**

| Arbiter | Índice | Propósito | Quando se aplica |
|---|---|---|---|
| **Geral (novo, desta fatia)** | `UNIQUE (workspace_id, source_local_id)`, **não-parcial** | Idempotência do **import** — rodar 2× não duplica nada, de nenhum tipo | **Toda** linha importada, sem exceção |
| **Quote (já existe, Etapa 3)** | `ux_ft_receivable_from_quote` — `UNIQUE (quote_id)` **parcial**, `WHERE source='quote' AND type='receivable' AND deleted_at IS NULL` | Regra de **negócio**: no máximo 1 recebível vivo por orçamento — independe de quem cria (CRM ao vivo ou import) | **Só** quando a linha é `type='receivable' AND source='quote' AND quote_id` resolvido (não nulo) |

**Regra de decisão no momento do import (por linha), sem ambiguidade:**

```
para cada transação local real (não-demo):
  1. resolver quote_id (via kora.quotes.supabaseImport.v1), client_id, opportunity_id
     -> UUID ou null, nunca id local cru (padrão Q4)
  2. montar a linha com source_local_id = `${installId}:${localId}` sempre preenchido

  SE type == 'receivable' E source == 'quote' E quote_id resolvido != null:
     -> NÃO usar upsert(onConflict: "workspace_id,source_local_id") como caminho primário
     -> chamar financeRepository.findReceivableByQuote(workspaceId, quote_id) primeiro
        SE já existe:
           -> backfill: gravar source_local_id nessa linha existente (se ainda vazio),
              para que um 2º import da MESMA transação local reconheça via o arbiter geral também
           -> não cria nova linha (idempotente pela regra de negócio, não pelo source_local_id)
        SE não existe:
           -> financeRepository.createReceivableFromQuote(workspaceId, { ...linha, source_local_id })
           -> mesmo catch de 23505 já existente no repository (corrida perdedora -> busca e
              devolve a existente) — o INSERT já carrega source_local_id, então o backfill do
              caso acima só é necessário para linhas que já existiam ANTES desta fatia

  SENÃO (qualquer outro type/source — manual, expense, service, sale, recurring, ou receivable
         sem quote):
     -> upsert(onConflict: "workspace_id,source_local_id") — caminho geral simples, sem
        precisar saber nada sobre o índice parcial (ele nem se aplica a essas linhas)
```

**Por que isso não é ambíguo:** os dois índices têm colunas e predicados diferentes — nunca
competem pela MESMA operação SQL. A ambiguidade só existiria se o código tentasse usar UM
`upsert(onConflict:...)` genérico pra tudo; o desenho acima resolve isso com um **branch explícito
antes** de decidir qual caminho de escrita usar, não com um único statement "esperto". Consistente
com P8b (nunca inferir arbiter errado num índice parcial).

---

## 7. Design — Mapper (fan-out, precisão monetária, atomicidade)

### Fan-out (padrão Q4 — UUID ou `null`, nunca id local cru)

Reaproveita os **três** import-maps já provados em produção pelas Fatias 2-4 — nenhum novo:

| Campo local | Map | Chave | Fallback se ausente |
|---|---|---|---|
| `clientId` (number) | `kora.clients.supabaseImport.v1` | `String(clientId)` | `null` |
| `quoteId` (string) | `kora.quotes.supabaseImport.v1` | `quoteId` (já é string) | `null` |
| `opportunityId` (number) | `kora.crm.supabaseImport.v1` | `String(opportunityId)` | `null` |

Idêntico ao que `quoteMapper.ts`/`crmOpportunityMapper.ts` já fazem — sem desenho novo aqui.

### Precisão monetária (padrão Q5 — quantização + validação que REPORTA, nunca conserta em silêncio)

- `amount` quantizado a 2 casas (centavos) na entrada da migração:
  `roundMoney(local.amount)` — **reaproveitar** `roundMoney` de
  `src/services/quotes/quoteMoney.ts` (já testado, já em produção) em vez de reimplementar.
  Nome do arquivo é histórico (nasceu em Q5/quotes); catalogado, não bloqueante, mover pra
  `src/lib/money.ts` só quando uma **terceira** entidade precisar (regra dos três — não
  antecipar).
- **Checagem nova, específica de finance, no espírito de Q5:** quando a transação tem `quoteId`
  resolvido, comparar `amount` importado contra o `total` da quote já migrada (`public.quotes`).
  Se divergir **> 1 centavo**, **REPORTAR** ao operador antes do clique de import (mesmo padrão
  do relatório de `quoteMoney.ts` — nunca ajustar o valor sozinho). Não bloqueia o import; só
  torna visível uma inconsistência que hoje passaria despercebida.

### Atomicidade — declarado, não uma RPC

**`financial_transactions` não tem filhos.** Confirmado na Fase A (§1): sem tabela de parcelas,
sem itens; `RecurringEntry` é um registro local autônomo, nunca uma sub-linha de uma transação
específica, e não está em escopo desta fatia (F6, fora do escopo). **Não há precedente de RPC
atômica pai-filho (Fatia 3) a aplicar aqui** — cada transação importada é **uma linha,
independente das outras**. O único lugar onde "duas escritas dependentes" poderiam acontecer é
exatamente o par find-then-create do caminho quote-linked (§6), que já é o padrão existente e
testado do `financeRepository`, não uma invenção desta fatia.

---

## 8. Migrations escritas (não aplicadas) + queries de pré-aplicação

Dois arquivos, seguindo o padrão da Fatia 3 (coluna transacional + índice `CONCURRENTLY` em
arquivo separado, porque `CREATE INDEX CONCURRENTLY` não roda dentro de transação):

- `supabase/migrations/20260721000000_etapa5_fatia6_finance_add_source_local_id.sql`
- `supabase/migrations/20260721000100_etapa5_fatia6_finance_unique_source_local_id.sql`

Queries de pré/pós-aplicação em `docs/database/etapa-5-fatia-6-preaplicacao.sql` (1 query por
marco, mesmo padrão da Fatia 3).

**Nenhum dos dois arquivos foi aplicado.** Escritos para revisão; aplicação depende de "vai"
separado, sob o mesmo runbook de exceção (protocolo §8) se o Code for aplicar, ou pelo operador.

---

## 9. F5 — dois diálogos inconsistentes: avaliação e recomendação

**Confirmado nesta rodada de design (não só suspeitado na Fase A):** o único consumidor de leitura
de `financial_transactions` na nuvem é `useSupabaseFinancialSummary.ts`, e o único consumidor
DESSE hook é `SupabaseOperationalDashboardCard.tsx` — um card de **Configurações** (operacional/
monitoramento). A tela que qualquer usuário realmente olha para ver seu dinheiro,
`Financeiro.tsx`, lê **só** `useFinance()` (100% local). **Logo: hoje, um recebível criado via
`CreateReceivableDialog.tsx` (CRM) é gravado corretamente na nuvem, mas fica invisível na tela de
Finanças que o usuário usa no dia a dia.** Mesma classe do bug de `client_contacts` (C8) —
"escreve onde ninguém lê" — mas com uma diferença importante: aqui o dado **não se perde** (a
escrita é bem-sucedida e persiste), só fica no lugar errado para ser visto. Ainda assim, é dado
**financeiro**: o risco prático é o usuário achar que nada foi criado, tentar de novo pelo
diálogo de Vendas (que grava local) — e agora ter **dois registros do mesmo recebível**, um em
cada lado, sem nenhum dos dois sabendo do outro.

**Três caminhos avaliados:**

| Opção | O que muda | Risco |
|---|---|---|
| (a) Corrigir agora — fazer `Financeiro.tsx` também ler a nuvem | Financeiro passa a mesclar local+nuvem | **Fora de escopo**: isso é o cutover de leitura completo de finance, um trabalho do tamanho da fatia inteira de novo — inflaria "instalar infra de import" pra "migrar a leitura toda". Não recomendado nesta fatia. |
| (b) Redirecionar `CreateReceivableDialog.tsx` pra gravar **local** (mesmo padrão que `QuoteToReceivableDialog.tsx` já usa) — medida interina até finance ter seu cutover de leitura de verdade | Os dois diálogos passam a ter o **mesmo** comportamento (local), visível em Finanças hoje | Perde o backstop de deduplicação do índice parcial **enquanto** grava local (mas `QuoteToReceivableDialog` já vive sem esse backstop hoje, então não é um risco novo — é nivelar pro risco já aceito em produção no outro diálogo) |
| (c) Catalogar como dívida aceita, não mexer | Nada muda | Segue a inconsistência ativa — dado financeiro real continua podendo ficar invisível pro usuário |

**Recomendação: (b).** É a menor mudança que resolve a invisibilidade **hoje**, sem esperar o
cutover completo de leitura de finance (fora de escopo), e sem inventar um risco novo (o padrão
"grava local, sem dedupe" já é o que `QuoteToReceivableDialog` faz em produção agora — só está
sendo estendido pro segundo diálogo, não criado). Quando finance tiver seu cutover real (fatia
futura, fora deste escopo), os dois diálogos voltam a apontar pra nuvem juntos, de uma vez, sob
homologação própria. **Não implementado nesta entrega** — é uma proposta de código de UI simples
(trocar a chamada de `financeRepository.createReceivableFromQuote` por `useFinance().addTransaction`
dentro de `CreateReceivableDialog.tsx`), que dependeria de aprovação e fase de código separada.

**Adendo (revisor, 2026-07-21) — precisão de linguagem, aprovado com esta ressalva:**
**"desativado até o cutover", não "abandonado".** A opção (b) troca **só** o call site dentro de
`CreateReceivableDialog.tsx` — nenhuma linha de `financeRepository.ts` é removida, alterada ou
depreciada. `findReceivableByQuote`/`createReceivableFromQuote` continuam existindo, e **o
contrato que eles implementam (`ux_ft_receivable_from_quote`) permanece vivo e ativamente
exercitado** — não pelo diálogo (temporariamente), mas pelo **próprio import desta fatia**: é
exatamente o caminho que o runbook (§10, caso "coexistência") prova, chamando
`findReceivableByQuote` a partir do mapper de import sempre que uma transação local resolver pra
uma quote com recebível já existente. "Desativar o diálogo" tira **um** chamador do contrato;
não zera os chamadores. Quando o cutover de leitura de finance acontecer (fatia futura), o
diálogo volta a chamar `createReceivableFromQuote` diretamente — o código não precisa ser
reescrito, só o call site do dialog volta a apontar pra onde apontava antes.

---

## 10. Runbook — Rodada única (semeada; sem Rodada 2 real, per §5) — PRONTO PARA EXECUÇÃO

> **Nota de versão:** esta seção substitui a tabela de 5 casos proposta antes da implementação
> (letras e conteúdo redefinidos pelo revisor nesta rodada — não é o mesmo (a)-(e) de antes; não
> apagar a diferença sem nota). **Nada foi executado ainda** — os artefatos abaixo (seed, SQL,
> limpeza) estão prontos para colar, aguardando o "vai" literal do revisor.

Workspace de teste: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. Reaproveita entidades **já reais**
desse workspace (não semeadas por esta fatia): cliente "fabio"
(`50f894e9-c81c-4420-b673-9335ad17a6bf`) e a quote real "xxx"
(`fd9053a2-b55e-47ab-b425-00df7e59264d`, id local `qt-1784521404974`, já mapeada de verdade em
`kora.quotes.supabaseImport.v1` desde a Rodada 2 da Fatia 3 — nenhum seed novo precisa disso).

**Prefixo de identificação:** id local com prefixo `seedF6-` (ex.: `seedF6-a-basica`) **e** título
com prefixo `TESTE-FT-` — dois marcadores redundantes, mesmo espírito de excesso de cautela já
usado nas Fatias 3/4 (não depender de um único sinal pra limpeza).

**Nota de escopo — por que não há um 6º caso de precisão monetária aqui:** a lógica de
quantização e de report de divergência (`inspectFinanceMoney`) já tem 5 casos de teste
automatizados dedicados em `financeMapper.test.ts` (sem quote / bate / diverge / limiar exato de
1 centavo / quote desconhecida) — repetir isso na rodada semeada só provaria a mesma lógica pela
segunda vez, sem testar nada de integração novo. Os 5 casos abaixo focam no que só a integração
real prova: rede, banco, os dois arbiters coexistindo.

### 10.1 Seed (console do navegador, produção) — cobre os 5 casos

```js
// Etapa 5 · Fatia 6 (finance) — SEED da rodada semeada (5 casos). Preserva o que já
// existe em orbyt.finance.v1. Prefixo "seedF6-" no id local + "TESTE-FT-" no título.

// --- mapeamento de apoio (client fan-out) — "fabio" já é real na nuvem, mas não há
// nenhum client LOCAL real hoje (Fatia 4, F6) pra apontar pra ele; criamos o mapeamento
// sintético só pra esta rodada, com uma chave local claramente de teste.
const clientMap = JSON.parse(localStorage["kora.clients.supabaseImport.v1"] || '{"importedMap":{}}');
clientMap.importedMap["960100"] = "50f894e9-c81c-4420-b673-9335ad17a6bf"; // "fabio"
localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify(clientMap));

// --- transações semeadas ---
const existing = JSON.parse(localStorage["orbyt.finance.v1"] || "[]");
const now = new Date().toISOString();
const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);

const seeds = [
  { // (a) básica — sem fan-in nenhum, prova upsert + arbiter geral novo
    id: "seedF6-a-basica", type: "expense", title: "TESTE-FT-a-basica",
    amount: 123.45, category: "Ferramentas e Software", dueDate,
    status: "pending", paymentMethod: "card", recurrence: "none",
    source: "manual", createdAt: now, isDemo: false,
  },
  { // (b) fan-out — clientId mapeado -> deve virar client_id = uuid real (não "960100" cru)
    id: "seedF6-b-fanout", type: "expense", title: "TESTE-FT-b-fanout",
    amount: 77.77, category: "Marketing e Tráfego", dueDate,
    status: "pending", paymentMethod: "pix", recurrence: "none",
    source: "manual", createdAt: now, isDemo: false,
    clientId: 960100,
  },
  { // (c) órfã — clientId presente mas SEM mapeamento -> client_id = null + reporte na UI
    id: "seedF6-c-orfa", type: "expense", title: "TESTE-FT-c-orfa",
    amount: 42, category: "Impostos e Taxas", dueDate,
    status: "pending", paymentMethod: "boleto", recurrence: "none",
    source: "manual", createdAt: now, isDemo: false,
    clientId: 960199, // deliberadamente NÃO mapeado
  },
  { // (d) coexistência — quote-linked, mesma quote real "xxx". amount=50 bate com o
    // total real da quote (evita disparar aviso monetário, foco só na coexistência).
    // REQUER o setup SQL de 10.2 passo 4 ANTES de importar este.
    id: "seedF6-d-coexistencia", type: "income", title: "TESTE-FT-d-coexistencia",
    amount: 50, category: "Serviços", dueDate,
    status: "pending", paymentMethod: "pix", recurrence: "none",
    source: "quote", createdAt: now, isDemo: false,
    quoteId: "qt-1784521404974", // id local da quote real "xxx", já mapeada de verdade
  },
];

localStorage.setItem("orbyt.finance.v1", JSON.stringify([...existing, ...seeds]));
console.log("✅ Seed F6 gravado:", seeds.map(s => s.id));
```

*(Caso (e) — idempotência — não precisa de seed próprio: reimporta o caso (a) já semeado, via
SQL direto, passo 10.2.9.)*

### 10.2 Passos do operador, em ordem

1. Rodar o **seed JS** (10.1) no console, origem de produção.
2. **F5** (recarregar a página) — `useFinance`/`useQuotes` não observam mudança externa no
   `localStorage` (mesma lição já vista nas Fatias 3/4).
3. Abrir **Configurações → Importar lançamentos financeiros locais**.
4. **Setup SQL do caso (d)** — rodar ANTES de selecionar/importar (simula "CRM já gerou um
   recebível pra essa quote"):
   ```sql
   insert into public.financial_transactions
     (workspace_id, client_id, quote_id, type, status, source, title, amount, due_date, is_demo, archived)
   values
     ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', '50f894e9-c81c-4420-b673-9335ad17a6bf',
      'fd9053a2-b55e-47ab-b425-00df7e59264d', 'receivable', 'pending', 'quote',
      'TESTE-FT-preexistente-d', 50, current_date + 15, false, false)
   returning id, quote_id, source_local_id;
   -- guarde o id — esperado: source_local_id IS NULL (criado direto por SQL, não por import)
   ```
5. **Gate 2 (print pré-clique):** print do card mostrando os candidatos **antes** de qualquer
   clique. Esperado: **4 candidatos novos** (a/b/c/d) — só **(c)** com aviso "vínculo não
   encontrado"; **nenhum** com aviso de divergência monetária (o amount de (d) foi escolhido pra
   bater com o total da quote).
6. Selecionar os 4 candidatos → **Importar selecionados**.
7. Print do toast + aba Network — esperado: chamadas a `financial_transactions` incluindo pelo
   menos um `SELECT` (o `findReceivableByQuote` do caso (d), antes de decidir upsert vs backfill).
8. Rodar as **provas SQL 10.3.a-d**.
9. Rodar a **prova de idempotência 10.3.e** (usa o `source_local_id` real gravado no passo 8a).
10. Rodar a **limpeza 10.4** (nuvem + local) — só depois de todas as provas confirmadas.

### 10.3 Provas SQL por caso

```sql
-- (a) básica: sem fan-in nenhum
select id, title, client_id, quote_id, opportunity_id, amount, source_local_id
from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'TESTE-FT-a-basica';
-- esperado: 1 linha; client_id/quote_id/opportunity_id NULL; amount=123.45;
-- source_local_id preenchido (contém "seedF6-a-basica") — GUARDE esse valor pro passo (e).
```

```sql
-- (b) fan-out: client_id vira uuid real, nunca "960100" cru
select id, title, client_id, amount
from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'TESTE-FT-b-fanout';
-- esperado: client_id = '50f894e9-c81c-4420-b673-9335ad17a6bf'
```

```sql
-- (c) órfã: client_id vira null, não "960199" cru, não erro
select id, title, client_id, amount
from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title = 'TESTE-FT-c-orfa';
-- esperado: 1 linha, client_id IS NULL
```

```sql
-- (d) coexistência: 1 única linha viva pra essa quote (não 2 — não duplicou)
select count(*) as linhas_vivas
from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and quote_id = 'fd9053a2-b55e-47ab-b425-00df7e59264d'
  and source = 'quote' and type = 'receivable' and deleted_at is null;
-- esperado: 1

select id, title, source_local_id
from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and quote_id = 'fd9053a2-b55e-47ab-b425-00df7e59264d'
  and source = 'quote' and type = 'receivable' and deleted_at is null;
-- esperado: é a linha do SETUP (título "TESTE-FT-preexistente-d", MESMO id do passo 10.2.4) —
-- NÃO virou "TESTE-FT-d-coexistencia" (o import reconheceu a existente, não criou nova) — e
-- source_local_id agora preenchido (backfill), contém "seedF6-d-coexistencia".
```

```sql
-- (e) idempotência — cole o source_local_id real obtido na prova (a) acima no lugar de
-- <SOURCE_LOCAL_ID_DO_CASO_A>. Chamada DIRETA ao mesmo upsert que o app faz — bypassa a
-- UI de propósito (que já desabilitaria o checkbox de quem virou "imported"), pra provar
-- que o backstop é do BANCO (índice), não só da guarda da tela.
insert into public.financial_transactions
  (workspace_id, source_local_id, type, status, source, title, amount, due_date, is_demo, archived)
values
  ('2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9', '<SOURCE_LOCAL_ID_DO_CASO_A>', 'payable', 'pending',
   'manual', 'TESTE-FT-a-basica-RETRY', 123.45, current_date + 15, false, false)
on conflict (workspace_id, source_local_id) do update set title = excluded.title
returning id, title, source_local_id;
-- esperado: MESMO id da linha (a) original; title virou "...-RETRY" — UPDATE via ON CONFLICT,
-- nunca um INSERT novo.

select count(*) from public.financial_transactions
where workspace_id = '2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and source_local_id = '<SOURCE_LOCAL_ID_DO_CASO_A>';
-- esperado: 1 (nunca 2)
```

**Não há caso de atomicidade parcial/rollback a testar** — ausência de filhos (§7) torna esse tipo
de prova (como o "quota decapitada" da Fatia 3) inaplicável aqui; registrado, não esquecido.

### 10.4 Limpeza — escrita para APROVAÇÃO do revisor ANTES da rodada (nada executado ainda)

**Nuvem** — um único filtro por título cobre os 4 seeds + o setup do caso (d) + o retry do caso
(e), porque todos começam com `TESTE-FT-`:
```sql
delete from public.financial_transactions
where workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and title like 'TESTE-FT-%';
select count(*) from public.financial_transactions
where workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'TESTE-FT-%';
-- esperado: 0
```

**Local:**
```js
const existing = JSON.parse(localStorage["orbyt.finance.v1"] || "[]")
  .filter(t => !String(t.id).startsWith("seedF6-"));
localStorage.setItem("orbyt.finance.v1", JSON.stringify(existing));

const meta = JSON.parse(localStorage["kora.finance.supabaseImport.v1"] || '{"importedMap":{}}');
["seedF6-a-basica", "seedF6-b-fanout", "seedF6-c-orfa", "seedF6-d-coexistencia"].forEach(
  (id) => delete meta.importedMap[id]
);
meta.importedLocalIds = (meta.importedLocalIds || []).filter((id) => !id.startsWith("seedF6-"));
localStorage.setItem("kora.finance.supabaseImport.v1", JSON.stringify(meta));

// remove o mapeamento fake criado só para esta rodada (960100 -> "fabio")
const clientMap = JSON.parse(localStorage["kora.clients.supabaseImport.v1"] || '{"importedMap":{}}');
delete clientMap.importedMap["960100"];
localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify(clientMap));

console.log("✅ Limpeza local F6 ok. F5.");
```

**Este statement de limpeza está aqui para aprovação — não foi executado.** Só roda depois de
todas as provas de 10.3 confirmadas (passo 10.2.10), e só com a rodada em si já aprovada e
executada primeiro (nada disto existe ainda hoje).

**Critério de aceite:** 5/5 casos verdes.

---

**PARADO aqui.** Runbook pronto para execução (seed, passos, provas, limpeza) — **nada foi
executado**: nenhuma transação semeada, nenhum import disparado, nenhuma limpeza rodada. Aguarda
"vai" literal do revisor colado neste chat pelo operador antes de qualquer ação sobre dado (seed
inclusive — semear já é escrever, mesmo em cenário de teste).
