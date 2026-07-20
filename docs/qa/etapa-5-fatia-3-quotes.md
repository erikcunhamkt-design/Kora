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

## 6. B.2 — migrations + RPC (escritos e **APLICADOS** em 2026-07-19)

| Arquivo | Conteúdo |
|---|---|
| `20260719001000_etapa5_fatia3_quotes_add_fk_columns.sql` | Q1 (1/2): `quotes.client_id`/`opportunity_id` (`uuid … ON DELETE SET NULL`), transacional |
| `20260719001100_etapa5_fatia3_quotes_fk_indexes.sql` | Q1 (2/2): índices parciais `CONCURRENTLY` dos 2 FKs |
| `20260719001200_etapa5_fatia3_quotes_source_local_id.sql` | Q2 (1/2): `quotes.source_local_id text`, transacional |
| `20260719001300_etapa5_fatia3_quotes_unique_source_local_id.sql` | Q2 (2/2): UNIQUE **não-parcial** `(workspace_id, source_local_id)` `CONCURRENTLY` |
| `20260719001350_etapa5_fatia3_quote_items_quantity_numeric.sql` | Q5b: `quote_items.quantity` `integer` → `numeric` (promovida — ver seção Q5b) |
| `20260719001400_etapa5_fatia3_import_quote_with_items_rpc.sql` | Q3: RPC `import_quote_with_items` — upsert do pai + reposição atômica dos filhos (guarda de NULL + `search_path=public,pg_temp` + cast `::numeric` de Q5b) |
| `docs/database/etapa-5-fatia-3-preaplicacao.sql` | 7 queries de checagem (baseline → pós-cada-passo) |

**Ordem de aplicação (6 arquivos):** `20260719001000` → `001100` → `001200` → `001300` →
`001350` (Q5b) → `001400` (RPC, por último — depende de todos os anteriores).

**Aplicação real — 2026-07-19, via `psql` (emenda [`protocolo-homologacao.md` §8](protocolo-homologacao.md#8-emenda-2026-07-19--aplicação-de-ddl-pelo-code-sob-runbook-aprovado)):**
Code aplicou os 6 arquivos, um por vez, com checagem de marco entre cada um. **6/6 marcos
verdes**, sem falha de `CONCURRENTLY`, sem retry.

| Marco | Resultado |
|---|---|
| Baseline | `quotes`=0, `quote_items`=0, colunas ausentes, `quantity`=integer, RPC ausente |
| 1 · `001000` | `client_id`/`opportunity_id` existem, 0 preenchidos |
| 2 · `001100` | `idx_quotes_client`/`idx_quotes_opportunity` `indisvalid=t` |
| 3 · `001200` | `source_local_id` existe, 0 preenchidos |
| 4 · `001300` | `ux_quotes_source_local` `indisvalid=t`, `indisunique=t` |
| 5 · `001350` | `quantity` → `numeric` confirmado |
| 6 · `001400` | RPC existe, `prosecdef=f` (INVOKER), `search_path=public, pg_temp` |

**Pendência atualizada:** `quotesRepository`/`useLocalQuotesImport` ainda **não chamam** o RPC —
código puro, zero risco de dado, é o próximo passo (início da B.3).
**Ação do operador (checklist de sign-off, emenda §8):** rotacionar a senha do banco usada
nesta rodada.

**Decisão de segurança do RPC (Q3): `SECURITY INVOKER`.** O chamador já tem INSERT/UPDATE/
DELETE em `quotes`/`quote_items` do próprio workspace via as policies RLS existentes; o RPC
só resolve **atomicidade** (uma chamada = uma transação PostgREST), não pede privilégio
extra. Rodando como o chamador, a RLS de `quotes_insert`/`quotes_update`/`quote_items_*` se
aplica automaticamente ao `ON CONFLICT DO UPDATE` e ao delete/insert dos itens — um chamador
tentando importar para workspace alheio recebe "row violates row-level security policy" e a
chamada inteira aborta. `SECURITY DEFINER` bypassaria essa RLS e exigiria reimplementar a
checagem manualmente (segunda fonte de verdade, pode divergir das policies reais). Fixado
`SET search_path = public, pg_temp` em qualquer caso (`pg_temp` explícito por último —
neutraliza a busca implícita em `pg_temp` antes do `search_path` declarado, defesa em
profundidade; revisão). Justificativa completa no cabeçalho da migration `20260719001400`.

**Correção de revisão aplicada ao RPC (commits `dbb4145`/`8834140`):** guarda de NULL
(`p_workspace_id`/`p_source_local_id`) logo após o `BEGIN` — sem ela, um `source_local_id`
NULL nunca colidiria contra `ux_quotes_source_local` (NULLs distintos), e cada chamada mal-
formada criaria uma quote nova em vez de falhar; `RAISE EXCEPTION` explícito fecha essa
lacuna.

**Q6:** contrato RE-LINK forward estendido em [`espelho-reversivel.md §5`](../architecture/espelho-reversivel.md#5-variantes-do-molde-por-tipo-de-entidade)
— caso especial do fan-in contra o UNIQUE **parcial** `ux_ft_receivable_from_quote`: o futuro
import do financeiro deve reaproveitar `findReceivableByQuote`/catch-`23505`
(`financeRepository.ts:42-66`), nunca `upsert(onConflict)` contra índice parcial.

**Pendência explícita para depois do B.2 aplicado:** o `quotesRepository`/`useLocalQuotesImport`
ainda **não chamam** o RPC — isso é código puro (zero risco de dado) e será a primeira coisa da
B.3, depois que as migrations estiverem aplicadas e confirmadas.

## Q5b — decisão: `quantity` integer → numeric

> **Status: DECIDIDA (2026-07-19). Decisão A — PROMOVER.**

O Q5 (B.1) tratava quantidade fracionária local **arredondando para inteiro** na entrada
(`coerceQuantity`) + **reportando** a divergência no card — nunca perdia o dado
silenciosamente, mas achatava a fração. A decisão foi alargar `quote_items.quantity` de
`integer` para `numeric`, preservando a fração sem arredondar em nenhuma camada.

**Resultado do grep** (console do navegador, origem de produção, sobre as 3 quotes reais em
`orbyt.quotes.v1`): **5 itens verificados, 0 fracionários.**

**Veredito final: decisão de PRODUTO, não de dado.** O grep **não mandou** promover — hoje
nenhum item real é fracionário. A equipe decidiu alargar o schema mesmo assim (custo zero,
`quote_items` vazia em produção) para não reabrir esta discussão quando cobrança por hora
fracionária (ex.: "1,5h") aparecer. Registrado explicitamente para não ser lido, no futuro,
como "o dado provou que precisava" — não provou; foi antecipação deliberada.

**Executado (commits `6de59c6` · `8834140`):**
- Migration promovida: [`20260719001350_etapa5_fatia3_quote_items_quantity_numeric.sql`](../../supabase/migrations/20260719001350_etapa5_fatia3_quote_items_quantity_numeric.sql)
  (candidata original removida). Posicionada entre Q2 e Q3 — não depende de Q1/Q2 (tabela
  diferente), mas precede Q3 (RPC), cujo cast assume a coluna já numeric.
- RPC: cast `(item->>'quantity')::integer` → `::numeric`.
- Mapper: `coerceQuantity` renomeada para `roundQuantity` (quantiza a 3 casas em vez de
  arredondar a inteiro); `mapLocalQuoteItemToSupabaseItem` usa a nova função.
- Testes atualizados/adicionados cobrindo fração preservada, quantização a 3 casas e
  regressão de quantidade inteira. Suíte 118/118, `tsc` 0, lint sem regressão.

**Nota lateral registrada, fora de escopo desta decisão:** o relatório `fractionalQuantities`
(`QuoteMoneyReport`, `LocalQuotesImportCard.tsx`) continua sinalizando quantidade fracionária
no card de import como um aviso — semântica que ficou **desatualizada** (fracionário deixou de
ser lossy). Não foi tocado nesta rodada por não estar no pedido explícito; fica como observação
para uma fatia/ajuste futuro caso o operador queira recalibrar a UI.

---

## 7. Runbook + resultados — **PENDENTE** (preenchido em B.3)
