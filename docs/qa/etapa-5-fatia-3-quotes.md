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

**Pendência resolvida (B.3 passo 1, commits `e082c5f`·`0bf9141`·`13805b7`·`a7b5f52`):**
`quotesRepository`/`useLocalQuotesImport` agora chamam `import_quote_with_items` — ver seção 8.
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

**Nota lateral — resolvida em B.3 passo 1 (commit `a7b5f52`):** o aviso de quantidade
fracionária foi **removido** do card (deixou de ser algo que exige conferência do operador).
Ver seção 8 para a justificativa completa.

---

## 8. B.3 · Passo 1 — import ligado ao RPC (código puro, zero risco de dado)

| Commit | Camada |
|---|---|
| `e082c5f` | Repository: `quotesRepository.importQuoteWithItems` (chama o RPC) + `SupabaseQuote`/`ImportQuoteWithItemsInput` |
| `0bf9141` | Mapper: `SupabaseQuoteImportPayload` tipado para casar estruturalmente com o input do RPC |
| `13805b7` | Hook: `importSelected` chama o RPC único; `source_local_id` via `buildSourceLocalId(getInstallId(), local.id)`; persist incremental do `importedMap` (mesma disciplina da Fatia 2 — A5) |
| `a7b5f52` | UI: remove aviso obsoleto de fração + adiciona `toast.warning` de falha parcial |

**Gates:** `tsc` 0 · suíte **120/120** (subiu de 118) · lint 89/68 sem regressão.

**Decisão registrada — item 3 (aviso de quantidade fracionária): REMOVIDO, não neutralizado.**
Justificativa: desde a promoção de `quote_items.quantity` a `numeric` (Q5b), fração é
preservada sem perda — o aviso não representa mais uma decisão ou conferência que o operador
precise fazer. Um indicador "sem ação necessária" dilui o sinal dos avisos que **continuam**
relevantes (cliente órfão, total ≠ Σ itens). `fractionalQuantities` continua computado em
`QuoteMoneyReport` (`quoteMoney.ts`) — só parou de ser **exibido** nesta tela; pode voltar a
ser usado (ex. um dashboard interno) sem custo de recomputação.

**Disciplina de import-map (mesma da Fatia 2):** gravado **somente após sucesso** do RPC;
erro → nada gravado, candidato marcado como falho. Persist movido para **dentro do loop**
(por item) em vez de uma vez só no fim — evita perder o rastro de sucessos anteriores se o
lote for interrompido no meio (o reimport seria seguro de qualquer forma, via o `UNIQUE` do
RPC, mas persistir incremental evita reimportar à toa).

---

## 9. Runbook de homologação (B.3 · Passo 2) — **PROPOSTO, aguardando aprovação**

> **Nenhuma rodada executa sem aprovação explícita.** Workspace de teste:
> `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9` (mesmo das Fatias 1-2).

### 9.1 Rodada 1 — semeada (5 casos + idempotência; caso "b" adiado)

**Descoberta rodada em 2026-07-19:** o workspace de teste tem clientes (`fabio` =
`50f894e9-c81c-4420-b673-9335ad17a6bf`, `tttt` = `8e82500a-3d12-4a84-bc74-c74c91b86487`) mas
**0 oportunidades** em `crm_opportunities`. **Decisão:** caso (b) — "ligada a oportunidade
migrada" — fica **fora** desta rodada (não bloqueante para os outros 5); o snippet abaixo já
inclui essa lógica condicional (`OPP_UUID = null` → caso b não é gerado). Se depois quiser
cobrir o caso (b), crie uma oportunidade pelo CRM, pegue o `id`, sete `OPP_UUID` e rode o seed
de novo (é idempotente — soma ao array existente).

**Seed (console do navegador, origem de produção)** — preserva o que já existe em
`orbyt.quotes.v1`; `CLIENT_UUID` já preenchido com o cliente real encontrado:

```js
const CLIENT_UUID = "50f894e9-c81c-4420-b673-9335ad17a6bf"; // "fabio"
const OPP_UUID = null; // nenhuma oportunidade no workspace ainda — caso (b) fica de fora

const clientMap = JSON.parse(localStorage["kora.clients.supabaseImport.v1"] || '{"importedMap":{}}');
clientMap.importedMap["960001"] = CLIENT_UUID;
localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify(clientMap));

if (OPP_UUID) {
  const oppMap = JSON.parse(localStorage["kora.crm.supabaseImport.v1"] || '{"importedMap":{}}');
  oppMap.importedMap["960101"] = OPP_UUID;
  localStorage.setItem("kora.crm.supabaseImport.v1", JSON.stringify(oppMap));
}

const base = { paymentCondition: "", deliveryDeadline: "", validityDays: 0, createdAt: "2026-07-19", isDemo: false, description: "" };
const testQuotes = [
  // (a) básica, com itens, cliente mapeado — prova zero perda
  { ...base, id: "960001", title: "TESTE-QUOTE-A-basica", clientName: "Cliente Pronto", clientEmail: "pronto@teste.com",
    clientId: 960001, items: [{ id: "i1", name: "Item 1", quantity: 2, unitPrice: 50 }, { id: "i2", name: "Item 2", quantity: 1, unitPrice: 30 }],
    subtotal: 130, discount: 0, total: 130, status: "enviado" },
  // (c) cliente NÃO-mapeado — órfã, reportada, importa com client_id null
  { ...base, id: "960003", title: "TESTE-QUOTE-C-orfao", clientName: "Cliente Orfao", clientEmail: "orfao@teste.com",
    clientId: 960999, items: [{ id: "i4", name: "Item Orfao", quantity: 1, unitPrice: 80 }],
    subtotal: 80, discount: 0, total: 80, status: "enviado" },
  // (e) total != Σ itens (divergência proposital: soma=100, total local=85) — prova de precisão
  { ...base, id: "960004", title: "TESTE-QUOTE-E-divergente", clientName: "Cliente Pronto", clientEmail: "pronto@teste.com",
    clientId: 960001, items: [{ id: "i5", name: "Item Div", quantity: 2, unitPrice: 50 }],
    subtotal: 100, discount: 0, total: 85, status: "enviado" },
  // (f) FALHA SIMULADA — item com name NULL (viola NOT NULL de quote_items.name no Postgres)
  { ...base, id: "960005", title: "TESTE-QUOTE-F-falha", clientName: "Cliente Pronto", clientEmail: "pronto@teste.com",
    clientId: 960001, items: [{ id: "i6", name: null, quantity: 1, unitPrice: 10 }],
    subtotal: 10, discount: 0, total: 10, status: "enviado" },
  // (b) OPCIONAL — só entra se OPP_UUID estiver preenchido acima
  ...(OPP_UUID ? [{ ...base, id: "960002", title: "TESTE-QUOTE-B-opp", clientName: "Cliente Pronto", clientEmail: "pronto@teste.com",
    clientId: 960001, leadId: "960101", items: [{ id: "i3", name: "Item Opp", quantity: 1, unitPrice: 200 }],
    subtotal: 200, discount: 0, total: 200, status: "enviado" }] : []),
];
const existing = JSON.parse(localStorage["orbyt.quotes.v1"] || "[]");
localStorage.setItem("orbyt.quotes.v1", JSON.stringify([...existing, ...testQuotes]));
console.log(`✅ Seed ok (${testQuotes.length} quotes). F5 e abra Configurações → "Importar orçamentos locais".`);
```

**Como a falha (caso f) é induzida — importante, não é mock:** o item da quote
`TESTE-QUOTE-F-falha` tem `name: null`. `quote_items.name` é `text NOT NULL` no schema
(`create_quotes_schema.sql:29`). A UI local não valida isso (a seed grava direto no
`localStorage`, sem passar pelo formulário); o mapper (`mapLocalQuoteItemToSupabaseItem`)
não sanitiza `name` (passa `item.name` verbatim). O RPC recebe `"name": null` no jsonb de
itens; `item->>'name'` vira `NULL` no SQL; o `INSERT` em `quote_items` viola a constraint
`NOT NULL` → **exceção real do Postgres**, não uma falha simulada em JS. Como a exceção
acontece **dentro** da mesma chamada de função que já fez o upsert do pai, TUDO reverte
(prova de atomicidade genuína — não um teste que confia em mock).

**Passos (operador):**
1. Gate 1 (export manual) — mesmo com `quotes`/`quote_items` vazias hoje, exportar e
   confirmar por escrito (nada a perder, mas o gate é cumprido pela constatação).
2. Rodar o seed acima.
3. Abrir o card **"Importar orçamentos locais"** → conferir os 4 candidatos "new" (A, C, E, F)
   → **Gate 2 (print pré-clique)**: mandar o print com os candidatos visíveis, incluindo o
   marcador "· sem cliente vinculado" em C e "· total ≠ Σ itens (Δ R$ 15,00)" em E.
4. Selecionar **todos os 4** → "Importar selecionados".
5. Esperado na UI: toast de sucesso para 3 (A, C, E) + `toast.warning` "1 orçamento(s)
   falharam ao importar" (F).

**Provas (SQL, `<WS>` = `2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9`):**

```sql
-- (a) zero perda — campo a campo
select id, client_id, opportunity_id, client_name, client_email, title, subtotal, discount, total, status, source_local_id
from public.quotes where workspace_id='<WS>' and title='TESTE-QUOTE-A-basica';
select name, quantity, unit_price from public.quote_items
where quote_id = (select id from public.quotes where workspace_id='<WS>' and title='TESTE-QUOTE-A-basica');
-- esperado: client_id = CLIENT_UUID; subtotal=130, discount=0, total=130; 2 itens batendo com o local.

-- (b) OPCIONAL — só roda se OPP_UUID foi preenchido e o seed re-rodado com o caso B
select opportunity_id from public.quotes where workspace_id='<WS>' and title='TESTE-QUOTE-B-opp';
-- esperado: = OPP_UUID (não null).

-- (c) órfã: client_id NULL, linha existe (nunca id local 960999 cru, nunca descartada)
select client_id, client_name from public.quotes where workspace_id='<WS>' and title='TESTE-QUOTE-C-orfao';
-- esperado: client_id IS NULL; client_name = 'Cliente Orfao' (preservado).

-- (e) precisão: total local preservado, NÃO recalculado
select subtotal, discount, total from public.quotes where workspace_id='<WS>' and title='TESTE-QUOTE-E-divergente';
-- esperado: total = 85 (não 100 — o sistema reporta, nunca "conserta" em silêncio).

-- (f) falha simulada: ZERO rastro (prova o rollback do pai junto com os filhos)
select count(*) from public.quotes where workspace_id='<WS>' and title='TESTE-QUOTE-F-falha';
select count(*) from public.quote_items qi join public.quotes q on q.id=qi.quote_id
where q.workspace_id='<WS>' and q.title='TESTE-QUOTE-F-falha';
-- esperado: 0 e 0 — nem a quote nem os itens existem; upsert do pai foi revertido junto.
```

**Idempotência (prova de nível de banco, não só da guarda client-side)** — a UI já impede
reimportar pelo `importedMap` + fuzzy match; para provar o **arbiter no banco** (o que
realmente impede duplicata se algo tentasse de novo), chamar o RPC diretamente 2ª vez com o
**mesmo** `source_local_id` do caso (a):

```js
// no console: pegue o installId usado no seed
console.log(localStorage["kora.install.id.v1"]);
```
```sql
-- troque <INSTALL_ID> pelo valor acima; observe o title mudando para RETRY
select (import_quote_with_items(
  '<WS>'::uuid, '<INSTALL_ID>:960001', '<CLIENT_UUID>'::uuid, null,
  'Cliente Pronto', 'pronto@teste.com', 'TESTE-QUOTE-A-basica-RETRY', '',
  130, 0, 130, 'enviado', false,
  '[{"name":"Item 1","quantity":2,"unit_price":50},{"name":"Item 2","quantity":1,"unit_price":30}]'::jsonb
)).*;
select count(*) from public.quotes where workspace_id='<WS>' and source_local_id = '<INSTALL_ID>:960001';
select title from public.quotes where workspace_id='<WS>' and source_local_id = '<INSTALL_ID>:960001';
-- esperado: count = 1 (não 2 — UPDATE, não duplicata); title = '...-RETRY' (confirma que
-- foi a MESMA linha atualizada, não uma nova).
```

**Reimport conserta (caso f, depois da prova de falha):**
```js
const quotes = JSON.parse(localStorage["orbyt.quotes.v1"]);
const q = quotes.find(x => x.id === "960005");
q.items[0].name = "Item Falha Corrigido";
localStorage.setItem("orbyt.quotes.v1", JSON.stringify(quotes));
console.log("✅ corrigido. F5 e reimporte 'TESTE-QUOTE-F-falha' (deve continuar 'new').");
```
Reimportar → esperado: sucesso; `select count(*) ... title='TESTE-QUOTE-F-falha'` agora = 1,
com 1 item.

### 9.2 Rodada 2 — real (3 quotes reais), só após 5/5 verde na Rodada 1

1. **Gate 1 (export manual)** de `quotes`+`quote_items`.
2. **Backup do JSON local ANTES** (console): `copy(localStorage["orbyt.quotes.v1"])` →
   colar em `backups/etapa-5-fatia-3-quotes/orbyt-quotes-pre-import.json`.
3. **Gate 2 (print pré-clique)** do card mostrando as 3 quotes reais.
4. Importar as 3.
5. **Conferência campo a campo DEPOIS**: comparar cada uma das 3 (cliente, título,
   subtotal/discount/total, status, itens) entre o backup do JSON e as linhas no Supabase.
6. Confirmar que a leitura do app **continua vindo do local** (flag em carência) — nada muda
   visualmente para o usuário; a Rodada 2 é só escrita de import.

### 9.3 Critério de aceite

- [ ] Rodada 1: 5/5 casos verdes (a, c, d-idempotência, e, f). Caso (b) adiado — ver 9.1.
- [ ] Rodada 2: 3/3 quotes reais migradas, zero perda, backup salvo antes.
- [ ] Limpeza do cenário semeado (Rodada 1) — local + SQL `delete`.
- [ ] Flag de leitura de quotes permanece **local** (carência) após a Rodada 2.
- [ ] Ação de sign-off pendente (emenda §8 do protocolo): rotacionar a senha do banco.

---

## 10. Runbook + resultados — **PENDENTE** (preenchido após execução da Rodada 1/2)
