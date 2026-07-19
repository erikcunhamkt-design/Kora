# Etapa 5 · Fatia 3 — `quotes` + `quote_items` (primeira monetária, primeira pai-filho)

> **Escopo:** migrar o par pai-filho `quotes`/`quote_items` `localStorage → Supabase` com o
> molde ["Espelho Reversível"](../architecture/espelho-reversivel.md) — **Variante B no pai**
> (sem UNIQUE natural) + **reposição atômica no filho**. Primeira fatia com **dinheiro** e com
> **duas tabelas numa unidade de import atômica**. Gates operacionais permanentes em
> [`protocolo-homologacao.md`](protocolo-homologacao.md).
>
> **Regra de dados:** o Code **não** dispara import nem aplica migration. O operador exporta,
> aplica e importa, sob os 4 gates do protocolo. Flag de leitura permanece **local (carência)**
> mesmo após a rodada real.

---

## 0. REGISTROS REAIS — medidos pelo operador em 2026-07-19

| Medida | Valor | Fonte |
|---|---|---|
| `quotes` na nuvem | **0** | `select count(*) from public.quotes` |
| `quote_items` na nuvem | **0** | join em `quotes` do workspace |
| quotes **reais** no local (`orbyt.quotes.v1`) | **3** | contagem no navegador de produção do operador |
| recebíveis locais com `quoteId` (`orbyt.finance.v1`) | **0** | fan-in monetário **seco** hoje |
| `quotes.client_id` / `quotes.opportunity_id` em prod | **NÃO existem** (0 linhas) | `information_schema.columns` |

**Consequências:** (1) nuvem vazia → **nada a perder** no remoto; (2) só **3 quotes reais** →
migração de volume pequeno, mas **é dado real** (Rodada 2 com backup + conferência campo a
campo); (3) **B-DRIFT confirmado** → `Q1` é migration aditiva **real**, não "só versionar".

---

## 1. Auditoria por invariante (Fase A)

| Inv. | Ponto | Veredito |
|---|---|---|
| (a) | Não apaga local antes do remoto | ✅ OK |
| (b) | Idempotência | ⛔ **BLOQUEANTE** — sem backstop no banco |
| (c) | Leitura server-side | 🟡 OK, sem paginação (adiado Q7) |
| (d) | Reversibilidade | ✅ OK — local nunca destruído |
| (e) | Disparo consciente | ✅ OK |
| (5) | FK `quote_items→quotes` ON DELETE | ✅ **CASCADE (correto)** |
| (6) | Fan-in monetário / recebível | ⛔ **contrato forward obrigatório** |
| + | Atomicidade pai-filho | ⛔ **BLOQUEANTE** — import não-atômico |
| + | Precisão monetária | 🟡 ajuste (Q5) |
| + | Drift schema-vs-código | ⛔ **BLOQUEANTE (Q1)** — bug latente confirmado |

### (a) Não apaga o local — ✅ OK
`useLocalQuotesImport.ts` só escreve em `kora.quotes.supabaseImport.v1` (`writeMeta` `:65-71`,
`:265`); nunca toca `orbyt.quotes.v1`. Grava o map **depois** do `createQuote` retornar `id`
(`:243`). Nenhum `removeItem`/`clear`/overwrite da chave de quotes.

### (b) Idempotência — ⛔ BLOQUEANTE
`quotesRepository.createQuote` (`:61-69`) é **`.insert()` puro** — sem upsert, sem
`source_local_id`. A dedupe mora **só no localStorage**: `meta.importedMap[local.id]` (`:145`) +
fuzzy em `analyze` (`:154-186`). Limpar o local / outro navegador → map some → reimport
**duplica** (fuzzy é heurístico). ✅ Já tem a guarda A2: `importSelected` recusa `status!=="new"`
(`:215`). **Veredito:** Variante B **no pai** (`source_local_id` + UNIQUE não-parcial + upsert);
o **filho não precisa de chave própria** — idempotência derivada da reposição
(`replaceQuoteItems`) desde que o UUID do pai seja estável.

### (c) Leitura server-side — 🟡 OK com ressalva
`listQuotes` (`:40-48`) / `listQuoteItemsForQuotes` (`:120-133`) server-side, workspace-scoped,
`order created_at`. Ressalva: `listQuotes` faz `.select("*")` **sem paginação** → gargalo em
escala. **Adiado (Q7)**, não bloqueia homologação.

### (d) Reversibilidade — ✅ OK
App lê quotes do local (`useQuotes.ts` → `orbyt.quotes.v1`); o Supabase é o viewer
experimental, separado. `orbyt.quotes.v1` nunca é destruído → rollback sem perda por
construção.

### (e) Disparo consciente — ✅ OK
`LocalQuotesImportCard` (botão do operador). `useEffect(()=>analyze(),[...])` (`:272-274`) roda
`analyze` (read-only); import só via `importSelected` (clique).

### (5) FK ON DELETE — ✅ CASCADE (correto)
`create_quotes_schema.sql:27` — `quote_items.quote_id … ON DELETE CASCADE` (itens não têm vida
sem o pai). `quotes` é referenciada por `financial_transactions`/`projects`/`tasks` com
**`ON DELETE SET NULL`** — deletar quote **não** cascateia recebível/projeto/tarefa; só desliga
o vínculo. App usa soft-delete (`deleted_at`), então o cascade físico raramente dispara.

### (6) Fan-in monetário — ⛔ contrato forward obrigatório (o mais delicado)
`orbyt.finance.v1` `Transaction.quoteId` guarda o **id LOCAL** da quote (`useFinance.ts:33`,
`source:"quote"`). Ao migrar, a quote ganha **UUID novo**; quando o **financeiro migrar**
(fatia futura) ele **tem de traduzir** `quoteId` local→UUID via
`kora.quotes.supabaseImport.v1.importedMap` — senão o recebível migra órfão ou (pior) o id
local cru vai pra coluna `uuid` (bug A1). A constraint `ux_ft_receivable_from_quote` é
**PARCIAL** (`financial_transactions(quote_id) WHERE source='quote' AND type='receivable' AND
deleted_at IS NULL`); o futuro import do financeiro **tem de** deduplicar via
`findReceivableByQuote`/catch-`23505` (`financeRepository.ts:56-59` já faz no create-from-quote)
— **NUNCA** `upsert(onConflict)` contra índice parcial (precedente P8b). Hoje o fan-in está
**seco** (0 recebíveis locais com `quoteId`), mas o contrato é permanente. **Q6** documenta.

### (+) Atomicidade pai-filho — ⛔ BLOQUEANTE
Import faz `createQuote` (INSERT) **e depois** `replaceQuoteItems` (DELETE+INSERT) — duas
chamadas, **sem transação** (`:235,:240`). Falha nos itens após criar a quote → **quote sem
itens na nuvem** e `meta.importedMap` **não** gravado (`catch` antes do `:243`) → no reimport o
fuzzy marca "duplicate" por title+total → **quote decapitada, encalhada**. **Veredito:** import
atômico via **RPC** `import_quote_with_items(...)` (Q3).

### (+) Precisão monetária — 🟡 ajuste (Q5)
`quoteMapper.ts:6-20` passa `subtotal/discount/total` **crus** (floats), sem quantizar a
centavos e sem recomputar do itens. `quote_items.quantity` é `integer NOT NULL` (fracionário
seria rejeitado). **Q5:** quantizar a 2 casas na entrada + validação `total vs Σ(qty×unit)` que
**reporta** (não conserta) divergência > 0.01 + coerção de `quantity` a inteiro com reporte.

### (+) Drift schema-vs-código — ⛔ BLOQUEANTE (Q1), bug latente confirmado
Só o CREATE (`20260531030000`) e o add `approved_at/rejected_at` (`20260601010000`) tocam
`quotes`. **`quotes` NÃO tem `client_id`/`opportunity_id`** (medido: 0 linhas), mas o hook os
seta (`:224-231`) e o repo consulta `.eq("opportunity_id",…)` (`:145-155`). Nunca explodiu só
porque nada foi importado (nuvem=0). **Q1:** migration aditiva das duas colunas (FK
`ON DELETE SET NULL`) + índices.

---

## 2. Avaliação de risco — vs Fatias 1-2 (revisada com os números reais)

| Dimensão | Fatia 1 | Fatia 2 | **Fatia 3** |
|---|---|---|---|
| Variante | A | B (fan-in) | **B no pai + reposição no filho** |
| Tabelas na unidade | 1 | 1 | **2 (atômica)** |
| Dinheiro | não | não | **sim** |
| Bloqueantes | 0 | 2 | **4** (idempot., atomic., drift, contrato-fan-in) |
| Infra migration | nenhuma | coluna+índice | **2 colunas FK + coluna+índice + RPC** |
| Dado real a migrar | ~0 (semeado) | ~0 (semeado) | **3 quotes reais** (nuvem 0) |
| **Risco de DADO** | baixo | baixo | **baixo** (nuvem 0; 3 quotes + backup) |
| **Complexidade de CÓDIGO** | baixa | média | **alta** (migration FK + RPC transacional) |

> **Resumo:** risco de **perda de dado baixo** (nuvem vazia; só 3 quotes reais, com backup).
> Complexidade de **infra alta** (Q1+Q2 migrations + Q3 RPC). É a fatia mais trabalhosa até
> aqui, e a segurança depende de Q1/Q2/Q3 entrarem **antes** de qualquer import.

---

## 3. Recomendação de ajustes (aprovada)

| # | Ajuste | Classe | Fase |
|---|---|---|---|
| Q1 | `quotes.client_id`/`opportunity_id` (`uuid … ON DELETE SET NULL`) + índices | bloqueante | B.2 |
| Q2 | `quotes.source_local_id text` + UNIQUE **não-parcial** `(workspace_id, source_local_id)` | bloqueante | B.2 |
| Q3 | RPC `import_quote_with_items(...)` transacional (upsert pai + reposição filhos) | bloqueante | B.2 |
| Q4 | Fan-out seguro no mapper/hook (map→UUID ou null, nunca cru) + órfã reportada (A4) + testes | ajuste | **B.1** |
| Q5 | Dinheiro a centavos + validação `total vs Σ(itens)` (reporta) + `quantity` inteiro + testes | ajuste | **B.1** |
| Q6 | Estender contrato RE-LINK forward (`espelho-reversivel.md §5`) | doc | B.2 |
| Q7 | Paginação server-side de `listQuotes` | **adiado/catalogado** | — |

---

## 4. Plano de execução aprovado (paradas)

- **B.1 — CÓDIGO** (Q4 + Q5 + testes, **sem migration**). PARA com hashes + gates.
- **B.2 — DESIGN das migrations Q1+Q2 + RPC Q3** (escrever, **NÃO aplicar**); Q6 (doc);
  queries de pré-aplicação. RPC: decidir `SECURITY INVOKER`/`DEFINER` (se DEFINER, checar
  `is_workspace_member` no corpo; `search_path` fixo sempre). PARA. **O operador aplica** no SQL
  Editor (autocommit nos `CONCURRENTLY`), confirma `indisvalid=true` de **cada** índice.
- **B.3 — HOMOLOGAÇÃO em 2 rodadas:**
  - **Rodada 1 (semeada):** 6 casos — quote com itens · ligada a oportunidade migrada · cliente
    não-mapeado (null + reportado) · reimport 2× · `total ≠ Σ(itens)` (reporta) · **falha
    simulada nos itens** (RPC: nada gravado, quote não decapita, reimport conserta).
  - **Rodada 2 (real, só após 6/6 verde):** migrar as **3 quotes reais**, com **backup do JSON
    de `orbyt.quotes.v1` em `backups/` ANTES**, print pré-clique, e conferência campo a campo
    das 3 no Supabase depois (total, itens, vínculos).

---

## 5. Flag / carência

A flag de **leitura** de quotes permanece **local** (carência) mesmo após a Rodada 2 real. A
aposentadoria só será proposta em fatia posterior, após observação. O import é escrita
write-through pontual, não muda a fonte de leitura do app.

---

## 6. Runbook + resultados — **PENDENTE** (preenchido em B.2/B.3)
