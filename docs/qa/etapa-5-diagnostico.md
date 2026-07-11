# Etapa 5 · Fase A — Diagnóstico de migração `localStorage → Supabase`

> **Status:** diagnóstico concluído (leitura pura, nenhum dado migrado).
> **Data:** 2026-07-11.
> **Objetivo:** mapear o estado de cada entidade de negócio, definir a ordem segura de
> migração (folhas → raiz) e escolher a **primeira entidade a migrar como "teste de
> fogo"** — a de menor risco, não a central. Este documento é o **molde** que as próximas
> fatias da Etapa 5 vão copiar.

Referência: [`docs/architecture/kora-hub-auditoria-e-plano.md`](../architecture/kora-hub-auditoria-e-plano.md) — gargalo **G1** (`localStorage` como fonte de verdade).

---

## 1. Estado atual por entidade

### Tabela A — Fonte de verdade & prontidão de código

| Entidade | Fonte de verdade **hoje** | Chave localStorage (shape) | Tabela + RLS | Repository | Hook primário | Assistente de import |
|---|---|---|---|---|---|---|
| **workspaces** | 🟢 **Supabase** (nativo, bootstrap no signup) | — | ✅ +RLS | (auth) | `useCurrentWorkspace` | n/a (é a raiz) |
| **clients** | 🟡 **Híbrido por workspace** — `useClientsDataSource`: `workspace ? supabase : local` | `orbyt.clients.v1` (array; **contacts[] e technicalSheet aninhados** por client) | ✅ +RLS, idx(workspace, archived) | ✅ CRUD completo | 2 hooks paralelos (`useClients` local **+** `useClientsDataSource` supa) | ✅ `kora.clients.supabaseImport.v1` |
| **client_contacts** | 🟡 segue clients | **embutido** em `orbyt.clients.v1` (`client.contacts[]`) | ✅ +RLS, idx(client, workspace) | ✅ (dentro de clientsRepository) | embutido | atômico junto do client |
| **client_technical_sheets** | 🟢 **Supabase** (dataSource por-cliente, default supa; experimental opt-out) | **embutido** em `orbyt.clients.v1` (`client.technicalSheet{branding,persona,editorialLine,typography,socialLinks,briefing,assets[]}`) | ✅ +RLS, idx, **`UNIQUE(client_id)`** | ✅ get/**upsert(onConflict)**/delete | `useSupabaseTechnicalSheet` (React Query) | ✅ `kora.technicalSheets.supabaseImport.v1` |
| **opportunities** (leads) | 🔴 **Local** (`useLeads` sempre local); UI roteia por `getCrmDataSource()` (default supa) só em telas específicas | `orbyt.leads.v1` (array plano) | ✅ +RLS +soft-delete, idx(stage, client, archived) | ✅ CRUD completo | `useLeads` (local) / `useSupabaseOpportunities` (opt-in) | ✅ `kora.crm.supabaseImport.v1` |
| **quotes** | 🔴 **Local** (`useQuotes` sempre local); Supabase só em cards específicos | `orbyt.quotes.v1` (array; **items[] aninhados**) | ✅ +RLS +soft-delete +approved/rejected, idx | ✅ CRUD completo | `useQuotes` (local) / `useSupabaseQuotes` (opt-in) | ✅ `kora.quotes.supabaseImport.v1` |
| **quote_items** | 🔴 segue quotes | **embutido** em `orbyt.quotes.v1` (`quote.items[]`) | ✅ +RLS (subquery), idx(quote_id) | ✅ (dentro de quotesRepository) | embutido | atômico junto do quote |
| **financial_transactions** | 🔴 **Local** (`useFinance` sempre local); Supabase **read-only** (só resumo de recebíveis de quote) | `orbyt.finance.v1` (+ 5 chaves auxiliares `kora.finance.*`) | ✅ +RLS +soft-delete, idx, **`UNIQUE` parcial recebível-de-quote** | 🟠 **parcial** (só recebível-de-quote) | `useFinance` (local) | ❌ **nenhum** |
| **projects** | 🔴 **Local** (`useProjects` sempre local); Supabase **read-only** (resumo) | `orbyt.projects.v1` (array; `deliverables[]` opcional) | ✅ +RLS +soft-delete, idx, **`UNIQUE` parcial projeto-de-quote** | 🟠 **parcial** (só projeto-de-quote) | `useProjects` (local) | ❌ **nenhum** |
| **tasks** | 🔴 **Local** (`useTasks` sempre local); Supabase só base-tasks de projeto | `orbyt.tasks.v1` (array; `subtasks[]`, `comments[]` aninhados) | ✅ +RLS +soft-delete, idx(status, project, client) | 🟠 **parcial** (só base-tasks) | `useTasks` (local) | ❌ **nenhum** |

> **Prontidão do repositório:** ✅ CRUD completo · 🟠 parcial (só o caminho quote→derivados) · ❌ ausente.

### Tabela B — Dependências, volume e chave de idempotência

| Entidade | FK **saída** (referencia) | FK **entrada** (quem depende dela) | Volume/Complexidade | Chave de dedupe/idempotência | DB pronto p/ migrar? |
|---|---|---|---|---|---|
| **workspaces** | profiles | **tudo** | raiz | — | ✅ (já é fonte) |
| **clients** | workspace | contacts, sheets, opportunities, finance, projects, tasks (**6**) | médio (com filhos aninhados) | ⚠️ **sem UNIQUE** → import map | 🟠 falta índice de paginação + definir dedupe |
| **client_contacts** | client (CASCADE), workspace | — (folha) | baixo (array por client) | ⚠️ sem UNIQUE → natural key | 🟠 definir dedupe |
| **client_technical_sheets** | client (CASCADE), workspace | — (**folha**) | **baixo** (1 linha/cliente, JSONB) | ✅ **`UNIQUE(client_id)`** | ✅ **100% pronto** |
| **opportunities** | client (SET NULL), workspace | finance, projects, tasks (SET NULL) | médio | ⚠️ sem UNIQUE → import map | 🟠 definir dedupe |
| **quotes** | workspace (**sem** client_id — cliente é texto) | quote_items, finance, projects, tasks, opportunities | **alto** (pai+filho) | ⚠️ dedupe heurística no import | 🟠 definir dedupe |
| **quote_items** | quote (CASCADE) | — (folha, acoplada) | acoplada ao pai | via replaceQuoteItems | ✅ (com quotes) |
| **financial_transactions** | client, quote, opportunity (SET NULL) | — (folha) | **alto risco (dinheiro)** | ✅ parcial (recebível-de-quote) | 🟠 falta CRUD geral + assistente |
| **projects** | client, quote, opportunity (SET NULL) | tasks (CASCADE) | médio | ✅ parcial (projeto-de-quote) | 🟠 falta CRUD geral + assistente |
| **tasks** | project (CASCADE), client, quote, opportunity (SET NULL) | — (folha) | médio (**4 FKs de saída**) | ⚠️ sem UNIQUE geral | 🟠 falta CRUD geral + assistente |

---

## 2. Grafo de dependências (ordem segura: pais → filhos)

```
workspaces  🟢 já em Supabase (raiz — não migra)
    │
    ├── clients ──────────────┬── client_contacts        (folha)
    │   (base, fan-in 6)      ├── client_technical_sheets (folha) ★ UNIQUE(client_id)
    │                         └── opportunities ─┐
    │                                            │
    ├── quotes ── quote_items (folha, acoplada)  │  (quotes NÃO referencia clients)
    │      │                                     │
    │      ├─────────────┬───────────────────────┤
    │      ▼             ▼                        ▼
    └── financial_transactions   projects ── tasks (folha)
        (folha, $$$)             │
                                 └── tasks (project CASCADE)
```

**Ordem topológica segura (uma fatia por vez):**

1. `workspaces` ✅ (já é fonte)
2. **`client_technical_sheets`** ★ ← *teste de fogo* (folha, depende só de clients)
3. `clients` + `client_contacts` (a base — estabilizar o híbrido)
4. `opportunities`
5. `quotes` → `quote_items`
6. `financial_transactions`, `projects`
7. `tasks`

> **Nota estrutural:** `quotes` é o único que **não tem FK para `clients`** (guarda
> `client_name`/`client_email` como texto). É independente de clients no banco, mas tem
> `quote_items` (pai-filho) e alto fan-in → não é candidato a primeiro.

---

## 3. Recomendação — primeira entidade (teste de fogo)

### ✅ Começar por: **`client_technical_sheets`** (ficha técnica)

| Critério | Por quê ela ganha |
|---|---|
| **Menor volume/complexidade** | Exatamente **1 linha por cliente**, blobs JSONB, **sem linhas-filhas** para cascatear. |
| **Zero fan-in** | Nada referencia a ficha → migrar (ou reverter) **não estraga nenhuma outra entidade**. |
| **Idempotência garantida pelo banco** | **`UNIQUE(client_id)` + `upsert(onConflict:"client_id")`** já implementados. Rodar 2× não duplica — reforço no DB, não no app. |
| **Tabela + RLS + índices prontos** | **Não precisa de migration aditiva.** Única folha com schema 100% pronto. |
| **Scaffolding completo já existe** | repository (get/upsert/delete), hook de leitura Supabase (React Query), **seletor de dataSource por-cliente reversível** (`kora.technicalSheets.dataSource.v1`, default supa), kill-switch experimental (opt-out) e **assistente de import disparado pelo usuário** que sobe em lote, deduplica, grava o import-map e **não apaga o local**. Já é a **implementação de referência** dos 5 invariantes. |
| **Blast radius baixo** | Branding/persona/briefing — **não é dinheiro nem identidade do cliente**. |
| **Leitura server-side trivial** | Sempre *point-read* por `client_id` (indexado, `maybeSingle`) — nunca "carrega tudo e filtra". |

**Enquadramento:** como o caminho já está ~90% pronto, a Fase B é **auditar contra os 5
invariantes → homologar o ciclo local→nuvem→local → cristalizar o molde → (depois)
aposentar a flag**. Prova o processo no menor risco e entrega o molde reutilizável.

**Runner-up:** `opportunities` (repo CRUD completo + import hook + seletor `getCrmDataSource`), mas tem fan-in e depende de clients — mais arriscado.

### ❌ NÃO começar por

- **`clients`** — é a **base** (6 dependem dela) e o híbrido mais emaranhado (dois hooks paralelos; contatos aninhados). Errar aqui estraga tudo a jusante. É a última a estabilizar.
- **`financial_transactions`** — é **dinheiro**. Migração torta = recebível errado. Repo parcial, sem assistente.
- **`quotes`/`quote_items`** — pai-filho, monetário, cliente denormalizado.
- **`tasks`** — saída mais emaranhada (4 FKs ainda locais), repo parcial, sem assistente.

---

## 4. Padrão reutilizável — **"Espelho Reversível"** (por entidade)

Mesmo *blueprint* para toda fatia, com a ficha técnica como implementação de referência.
Sete peças por entidade `E`:

1. **Repository = contrato único** (`ERepository`): CRUD server-side com **paginação/filtro/ordenação no Postgres** — `list({ workspaceId, filters, page, pageSize, orderBy })` → `{ rows, total }`; sempre `workspace_id`-scoped, `deleted_at IS NULL`, ordenado por coluna **indexada**. O hook depende só desta interface.
2. **Chave de idempotência** — preferir **UNIQUE no banco** (estilo Etapa 3) + `upsert(onConflict)`. Onde não existe, definir a **chave natural de dedupe** + persistir **import-map** `localId → uuid` em `kora.<E>.supabaseImport.v1`; re-import consulta map + chave natural **antes** de inserir.
3. **Assistente de migração disparado pelo usuário** (painel em Configurações, **nunca** no load): lista candidatos com **status por registro** (pronto / já-migrado / bloqueado-por-dependência / sem-dado); sobe **em lotes** com progresso + contagem; grava o import-map no sucesso; **jamais apaga o local**; confirma **"N de M migrados"**. ⟶ *(e)*
4. **Seletor de dataSource reversível** (`kora.<E>.dataSource.v1`, tipado, default seguro): alterna a **leitura** entre cache local e Supabase, com kill-switch (flag experimental) que força local. Dado local **intacto** → voltar atrás é sem perda. ⟶ *(d)*
5. **Leitura = server-side**: com `dataSource=supabase`, o hook lê pelo repository **paginando/filtrando no Postgres** (nunca "carrega tudo e filtra no cliente"). localStorage vira **cache write-through**. ⟶ *(c)*
6. **Escrita = write-through**: grava **primeiro no Supabase** (fonte de verdade); no sucesso, atualiza o espelho local. Em falha, propaga erro — nunca diverge em silêncio. ⟶ *(a)*
7. **Checklist de cutover por entidade**: homologar ida-e-volta local→nuvem→local · **zero perda** (contagem + amostra) · idempotência (import 2× → mesmas contagens) · reversibilidade (flipar dataSource → local intacto) · `EXPLAIN` da leitura paginada usando índice. **Só então** aposentar a flag experimental (mantendo o seletor num período de carência).

**Invariantes → peças:** (a) 3+6 · (b) 2 · (c) 1+5 · (d) 4 · (e) 3.

---

## 5. Pré-requisitos de banco — entidade recomendada

**`client_technical_sheets` — banco 100% pronto. Nenhuma migration aditiva necessária:**

| Item | Estado |
|---|---|
| Tabela `client_technical_sheets` | ✅ (`20260530020000_...`) |
| RLS (4 policies workspace-scoped via `is_workspace_member`) | ✅ |
| **Idempotência `UNIQUE(client_id)`** | ✅ (o `upsert(onConflict:"client_id")` a usa) |
| Índices `idx_..._workspace`, `idx_..._client` | ✅ (leitura é point-read por `client_id`) |
| Trigger `updated_at` | ✅ |

⚠️ **Único pré-requisito é de DADO, não de schema:** a ficha tem `client_id NOT NULL` → só
migra para clientes **já existentes no Supabase**. Já tratado: o assistente reusa o
import-map de clientes (`kora.clients.supabaseImport.v1`) e marca `"sem_cliente"` quando o
cliente não subiu. Como `useClientsDataSource` grava clientes no Supabase sempre que há
workspace, na prática a maioria já está lá.

> Contraste: toda outra folha (contacts, opportunities, finance, projects, tasks) exigiria
> antes **definir a chave de dedupe** e, em vários casos, **construir CRUD geral +
> assistente de import**.
