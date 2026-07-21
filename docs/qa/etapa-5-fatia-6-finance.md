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

**PARADO aqui.** Sem "vai" literal do revisor colado neste chat pelo operador, nenhuma fase B
começa, nenhuma rodada de homologação executa, nenhuma migration é escrita ou aplicada.
