# Etapa 3 — Performance de banco

**Objetivo:** etapa de maior risco operacional (toca o banco). Dividida em duas fases
com parada obrigatória. **Fase A** = diagnóstico + escrever `.sql` (sem aplicar).
**Fase B** = aplicação, feita **pelo dono do repo** no SQL Editor de produção (após
backup/PITR confirmado). As migrations desta etapa são **puramente aditivas**.

**Data:** 2026-07-04 · **Branch:** `main`

**Commits:**

| Commit | Escopo |
|--------|--------|
| `58ff33d` | S5 — 2 índices únicos parciais anti-race (receivable/project from quote) |
| _(este doc)_ | relatório da Etapa 3 |

**Aplicação em produção:** feita pelo operador via **Supabase SQL Editor** (autocommit),
fora de transação. O ambiente do assistente não tem acesso DDL à produção (`psql`
ausente, `DATABASE_URL` vazio, e `supabase db push` foi propositalmente evitado por
envolver em transação e quebrar o `CONCURRENTLY`).

---

## 1. Diagnóstico da Fase A — o achado central

A maior parte da Etapa 3 **já estava implementada** por um esforço anterior (migrations
`batch1–batch4`, de 2026-07-01/02). Confirmado lendo o SQL — **nada disso foi refeito**
(evita índices/definições redundantes, conforme o guardrail).

| Item da Etapa 3 | Estado encontrado | Origem | Refeito? |
|---|---|---|---|
| `is_workspace_member` **STABLE** + SECURITY DEFINER + `search_path` | ✅ Já era `LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public` | `batch2_performance` | **Não** |
| Índice cobrindo o lookup da função | ✅ `UNIQUE (workspace_id, user_id)` cobre `WHERE workspace_id=$1 AND user_id=auth.uid()` | `create_workspaces_schema` | **Não** |
| Índices por tabela (workspace_id / FK / status / due_date; parciais soft-delete) | ✅ Cobertura completa (ver inventário) | schemas originais + `batch2` + `batch3` | **Não** |
| **REVOKE** de `credentials_json` (herdado da Etapa 2) | ✅ `REVOKE SELECT` + re-`GRANT` por coluna, sem `credentials_json`; `service_role` ignora o REVOKE e continua lendo | `batch1_security_hardening` (linhas 35-48) | **Não** |
| Constraints únicas anti-race (**S5**) | ⚠️ **Gap real** — inexistente | — | **Sim (esta etapa)** |

### Confirmação de `is_workspace_member` (base real)
`provolatile = 's'` (STABLE) e `prosecdef = true` (SECURITY DEFINER) — confirmado pelo
operador no SQL Editor. Ou seja, `batch2_performance` está aplicado em produção; **nenhuma
migration nova** foi necessária para o item 1.

### Inventário de índices existentes (evidência do "não refeito")
- **clients:** `(workspace_id)`, `(workspace_id, archived)` — usa `archived`, **sem** `deleted_at`.
- **client_contacts:** `(client_id)`, `(workspace_id)`.
- **client_technical_sheets:** `(workspace_id)`, `(client_id)`.
- **crm_opportunities:** `(workspace_id)`, `(client_id)`, `(workspace_id, stage)`, `(workspace_id, archived)`.
- **quotes:** `(workspace_id, created_at)`, `(workspace_id, status)` — `batch2` (parciais `deleted_at IS NULL`).
- **quote_items:** `(quote_id)` — `batch2`.
- **financial_transactions:** `(workspace_id, due_date)`, `(workspace_id, status)`, `client/quote/opportunity` — `batch2` (parciais).
- **projects:** `workspace_live` (parcial), `client`, `quote`, `opportunity` — `batch2`.
- **tasks:** `workspace_live` (parcial), `project_order`, `client`, `quote`, `opportunity`, `workspace_status` — `batch2`.
- **whatsapp_***: dezenas de índices (conversations, messages, queue, campaigns_v2, recipients, official_credentials, …) — schemas + `batch3` (P7) + UNIQUE `(instance_id, wa_message_id)` (P8/P8b).
- **workspace_members:** `UNIQUE (workspace_id, user_id)`, `(user_id)`, `(workspace_id)`.

**Conclusão do item 2:** não havia índice de `workspace_id`/FK/status faltando nas tabelas
listadas — nenhum índice novo de cobertura foi criado.

---

## 2. Gap real endereçado — S5 (anti-race na dedup por orçamento)

O app faz deduplicação **SELECT-depois-INSERT** (uma entidade por orçamento) em dois
fluxos, sujeitos a corrida sob duplo-clique/requisição concorrente:

- **Recebível:** `src/repositories/financeRepository.ts` (`findReceivableByQuote` →
  `createReceivableFromQuote`), disparado por `CreateReceivableDialog.tsx` /
  `QuoteToReceivableDialog.tsx`.
- **Projeto:** `src/repositories/projectsRepository.ts` (`findProjectByQuote` →
  `createProjectFromQuote`), disparado por `CreateProjectFromQuoteDialog.tsx`.

Dois índices únicos **parciais** tornam a duplicidade impossível no banco (backstop da
checagem do app). Chave `(quote_id)` basta — `quote_id` é globalmente único (FK →
`quotes.id`). Soft-delete (`deleted_at` setado) sai do índice parcial, então recriar após
excluir continua permitido (comportamento atual preservado).

**`supabase/migrations/20260704120000_etapa3_unique_receivable_from_quote.sql`**
```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_ft_receivable_from_quote
  ON public.financial_transactions (quote_id)
  WHERE source = 'quote' AND type = 'receivable' AND deleted_at IS NULL;
```

**`supabase/migrations/20260704120100_etapa3_unique_project_from_quote.sql`**
```sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_projects_from_quote
  ON public.projects (quote_id)
  WHERE source = 'quote' AND deleted_at IS NULL;
```

---

## 3. Aplicação confirmada (base real)

Ambas aplicadas via `CREATE UNIQUE INDEX CONCURRENTLY` em **autocommit** (SQL Editor),
**fora de transação**, uma por vez, com checagem de validade entre elas:

| Índice | `indisvalid` |
|---|---|
| `ux_ft_receivable_from_quote` | **true** (criado e válido) |
| `ux_projects_from_quote` | **true** (criado e válido) |

Query de verificação usada (por índice):
```sql
SELECT indexrelid::regclass AS index, indisvalid
FROM pg_index
WHERE indexrelid = 'public.<indice>'::regclass;
```

## 4. Duplicatas pré-existentes = 0

Rodadas **antes** da criação (script `docs/database/etapa-3-duplicate-checks.sql`):

| Query | Alvo | Resultado |
|---|---|---|
| QUERY 1 | recebíveis de orçamento duplicados (mesmo `quote_id` vivo) | **0 linhas** |
| QUERY 2 | projetos de orçamento duplicados (mesmo `quote_id` vivo) | **0 linhas** |

Por isso o `CONCURRENTLY` não encontrou violação e ambos os índices ficaram válidos.
Nenhum passo de limpeza de dados (UPDATE/DELETE) foi necessário — **nenhum dado foi
alterado** nesta etapa.

## 5. RLS / STABLE reconfirmadas na base real

- `is_workspace_member`: `provolatile='s'` (STABLE) + `prosecdef=true` — confirmado.
- Isolamento por workspace inalterado: as 2 migrations são aditivas (só índices) e **não
  tocam** nenhuma policy, função ou grant, então a RLS permanece idêntica. Reconfirmado
  pelo operador (membro vê só o próprio workspace; não-membro não vê nada).

## 6. Gates (commit `58ff33d`)

| Métrica | Resultado |
|---|---|
| `npx tsc --noEmit` | **0 erros** |
| ESLint — erros / `no-explicit-any` | **89 / 68** (baseline, sem regressão) |
| `npm run test` | **7 arquivos / 48 testes** verdes |

Migrations `.sql` não afetam tsc/lint/test (não são TS); confirmado mesmo assim.

## 7. Pendências registradas

- **Tratamento do `23505` (idempotência):** com os UNIQUE, um INSERT concorrente
  perdedor recebe `unique_violation`. Hoje `createReceivableFromQuote` /
  `createProjectFromQuote` apenas propagam o erro. Tratar `23505` como "já existe"
  (buscar e devolver o registro existente) foi **adiado — opção (a)** — a ser feito como
  **commit de código separado** em `src/repositories/*.ts`, sem misturar com a migration.
- **Refinamento de índice parcial em `crm_opportunities`:** tem `deleted_at` e índices
  não-parciais, mas os índices cheios já servem o caminho de acesso; o ganho de uma
  versão parcial é marginal → **descartado por baixo valor**.
- **`project_deliverables`:** **não existe** como tabela no schema (suposição do plano
  original). Sem ação.

## 8. Critérios de aceite

- [x] Fase A entregue: diagnóstico + `.sql` escritos, nada aplicado pelo assistente.
- [x] Confirmado que `is_workspace_member` já era STABLE + SECURITY DEFINER (nada refeito).
- [x] Confirmado que os índices por tabela e o REVOKE de `credentials_json` já existiam
      (batch1–4) — nada redundante criado.
- [x] Gap real (S5) endereçado com 2 índices únicos parciais anti-race.
- [x] Checagem de duplicatas rodada **antes** = 0 linhas em ambas.
- [x] Migrations aplicadas via `CONCURRENTLY` em autocommit, fora de transação.
- [x] Ambos os índices `indisvalid = true` (válidos) na base real.
- [x] RLS intacta e `is_workspace_member` STABLE reconfirmadas em produção.
- [x] Migrations puramente aditivas — nenhum DROP/ALTER de tipo/UPDATE/DELETE de dados.
- [x] `src/` e `functions/` intocados (tratamento do `23505` conscientemente adiado).
- [x] `tsc` = 0, lint sem regressão (89/68), testes verdes (`58ff33d`).
- [x] Commits por caminho explícito; sweep de 23 arquivos e `.env` intocados.
