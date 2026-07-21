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

---

## 10. Runbook proposto — Rodada única (semeada; sem Rodada 2 real, per §5)

Workspace de teste: `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`. Reaproveita entidades já reais desse
workspace: cliente "fabio" (`50f894e9-c81c-4420-b673-9335ad17a6bf`), quote "xxx"
(`fd9053a2-b55e-47ab-b425-00df7e59264d`, `source_local_id`
`e307969a-619b-4891-bfbf-9da596203be4:qt-1784521404974`). Sem oportunidade real confirmada no
workspace ainda — caso de fan-out de `opportunityId` fica condicional, mesmo padrão adiável da
Fatia 3 (9.1).

**Prefixo de limpeza:** todo título semeado começa com `TESTE-FT-`, para a limpeza final poder
filtrar com segurança (`WHERE title LIKE 'TESTE-FT-%'`), mesmo padrão `TESTE-QUOTE-*` da Fatia 3.

| Caso | O que prova | Como |
|---|---|---|
| **(a) idempotência via arbiter novo** | Rodar o import 2× com o mesmo `source_local_id` → mesma linha, `UPDATE` via `ON CONFLICT`, nunca duplicata | Seed `TESTE-FT-idempotencia` (manual/expense, sem `quoteId`) → importar → importar de novo (chamada dupla direta ao upsert, mesmo padrão de prova da Fatia 3) → conferir 1 linha só, mesmo `id` |
| **(b) fan-out dos 3 maps** | `client_id`/`quote_id`/`opportunity_id` viram UUID real ou `null`, nunca id cru | Seed `TESTE-FT-fanout` com `clientId` apontando pro local do "fabio" e `quoteId` apontando pro local da quote "xxx" → importar → conferir `client_id`/`quote_id` = UUIDs reais na linha |
| **(c) coexistência com o índice parcial** | Import de uma transação quote-linked **reconhece** um recebível já existente pra essa quote em vez de duplicar | Setup: criar via SQL um recebível pré-existente pra `quote_id = fd9053a2-...` (simula "CRM já criou um"). Depois: seed `TESTE-FT-coexistencia` local com o mesmo `quoteId` da quote "xxx" → importar → conferir **1 única linha viva** pra esse `quote_id` (não 2), e que a linha existente recebeu o `source_local_id` da transação local (backfill) |
| **(d) precisão monetária** | `amount` quantizado a centavos; divergência vs `quotes.total` (quando quote-linked) é reportada, não corrigida em silêncio | Seed `TESTE-FT-precisao` com `amount` tipo `99.995` (artefato de float) e, separadamente, um `quoteId` cujo `amount` diverge > R$0,01 do `quotes.total` correspondente → conferir `amount` gravado com 2 casas E um aviso reportado pro segundo caso |
| **(e) tipo sem fan-in** (controle) | Transação comum (manual, sem `quoteId`) usa só o arbiter geral, nunca toca o índice parcial | Seed `TESTE-FT-manual` (`type=expense`, `source=manual`) → importar → confirmar via `EXPLAIN` que a leitura de idempotência usa o índice novo, não o de quote |

**Não há caso de atomicidade parcial/rollback a testar** — ausência de filhos (§7) torna esse tipo
de prova (como o "quota decapitada" da Fatia 3) inaplicável aqui; registrado, não esquecido.

**Limpeza do cenário semeado (SQL, ao final):**
```sql
delete from public.financial_transactions
where workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9'
  and title like 'TESTE-FT-%';
select count(*) from public.financial_transactions
where workspace_id='2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9' and title like 'TESTE-FT-%';
-- esperado: 0
```

**Critério de aceite:** 5/5 casos verdes (b/c ficam condicionados aos maps reais disponíveis no
workspace — se não houver oportunidade real, essa parte de (b) fica documentada como adiada,
mesmo padrão da Fatia 3).

---

**PARADO aqui.** Design (§6-§10) escrito para revisão — nenhuma migration foi aplicada, nenhuma
rodada de homologação executou, nenhum código de import/mapper foi implementado ainda (isso seria
uma fase de código separada, após aprovação deste design). Sem "vai" literal do revisor colado
neste chat pelo operador, nada disso executa.
