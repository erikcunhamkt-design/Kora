# Etapa 5 · G94 — catálogo comercial (serviços, produtos, categorias, planos) + Biblioteca de Materiais — pacote do operador (§8-b)

> **[Status 2026-10-18 — varredura G29 do mapa do estado real]** O código do catálogo não é só CT1–CT4: inclui **CT5** (`cdd8de7`) e a **Biblioteca M1–M3** (`939afa3`, que **lê e escreve `clients.library_assets` com degradação** — `LibraryUnavailableError`; sem a coluna cai no armazenamento local M0 com aviso). As frases "nenhum código lê/escreve a coluna", "M1–M4 ainda não escrevem nela" e o rollback "hoje nada" estão **superadas**; a coluna continua **não aplicada**. O SELECT 3.5 (esperado 0 linhas **antes** do import) segue válido como pré-prova.

> **Nada aplicado.** Este doc junta tudo que depende de ação do operador contra o banco de produção
> para o **catálogo na nuvem** ficar VIVO: 4 tabelas novas, índices únicos do import, a FK
> `quote_items.service_id → services` e a coluna `clients.library_assets` (Biblioteca de Materiais).
> O código (CT1/CT2/CT3/CT4) já está escrito para **degradar sem as tabelas** (§6): enquanto este pacote
> não for aplicado, o app segue 100% no `localStorage`, o card de import mostra "Schema pendente
> (pacote §8-b)" e a tela de catálogo cai no local. Molde de formato:
> [`etapa-9-bot-pacote-operador-8b.md`](etapa-9-bot-pacote-operador-8b.md).
>
> **Origem do SQL:** drafts §6.1–§6.8 de [`etapa-5-flip-catalogo-materiais-fase-a.md`](../architecture/etapa-5-flip-catalogo-materiais-fase-a.md),
> com **uma única diferença de forma** (não de semântica): policies, triggers e constraints dos drafts não
> são idempotentes (`CREATE POLICY`/`CREATE TRIGGER`/`ADD CONSTRAINT` falham se já existem), então aqui vão em blocos
> `DO $$ … IF NOT EXISTS … $$` — **não** `DROP … IF EXISTS`, para uma reaplicação nunca sobrescrever uma policy
> que o operador tenha endurecido (variante admin, §2.2).
> Colunas, tipos, defaults, CHECKs e nomes de constraint/índice/policy são os dos drafts. **Exceção:** o §2.4 (`clients.library_assets`, draft 6.8) é **verbatim** — sem envoltório `DO` (re-execução do `ADD CONSTRAINT` dá "already exists", esperado; ver a nota do §2.4).
>
> **Gate de aplicação — vale pra tudo aqui:**
> 1. Code não roda DDL/DML contra produção (protocolo §0/§6/§8-b) — tudo abaixo é do operador (SQL Editor/CLI).
> 2. **Ordem obrigatória:** §2.1 → §2.2 → §2.3 → §2.4 (cada passo depende do anterior; a FK precisa de `services`).
> 3. Cada passo tem sua verificação — **parar no primeiro vermelho** (§3.5).
> 4. **Nenhuma flag muda com a aplicação.** O padrão do app continua LOCAL; o flip é a fatia CT7 (rodada própria, com Fase D).

---

## 0. Resumo e ordem

| # | Passo | Quem | Onde |
|---|---|---|---|
| 1 | Verificação prévia (SELECTs read-only) | operador | §1 |
| 2.1 | 4 tabelas + RLS (member) + triggers `updated_at` — numa execução | operador | §2.1 |
| 2.2 | Variante opcional: escrita só admin (decisão Q2) | operador (só se quiser) | §2.2 |
| 2.3 | 4 índices únicos do import (`CONCURRENTLY`, **um por execução**, autocommit) | operador | §2.3 |
| 2.4 | `clients.library_assets` (+ CHECK + VALIDATE) | operador | §2.4 |
| 2.5 | FK `quote_items.service_id → services` (`NOT VALID` + `VALIDATE`) — **opcional** | operador | §2.5 |
| 3 | SELECTs de prova | operador | §3 |
| 4 | Espelho em `supabase/migrations/` + `migration repair`, `gen types` | operador (comandos) + **lane** | §5 |
| 5 | Import assistido na UI (Configurações → Dados) | operador | §4 |

**Por que a ordem importa:**
- O índice único `(workspace_id, source_local_id)` é o **arbiter do upsert** do import (G56). Sem ele o
  `upsert(onConflict: "workspace_id,source_local_id")` falha com 42P10 ("no unique or exclusion constraint matching") —
  o import **não** duplica linhas, simplesmente erra. Por isso §2.3 vem **antes** do import (§4), e depois das tabelas.
- A FK de §2.5 referencia `services(id)`: só existe depois de §2.1.
- `library_assets` (§2.4) é independente do catálogo (coluna nova em `clients`), mas fica no mesmo pacote para a sessão §8-b ser uma só.

**Migrations são aditivas e inertes pro código antigo:** tabelas novas que nenhum caminho antigo lê/escreve; coluna
nova com default; FK `ON DELETE SET NULL` (nunca apaga orçamento). Aplicar antes de qualquer deploy é seguro.

---

## 1. Verificação prévia (read-only)

### 1.1 As 4 tabelas ainda não existem (esperado: **0 linhas**)

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('service_categories', 'services', 'products', 'commercial_plans');
-- Esperado: 0 linhas. Se vier QUALQUER linha, PARAR: já existe uma tabela com esse nome
-- (de outra origem?) e o `CREATE TABLE IF NOT EXISTS` de §2.1 a PULARIA sem avisar,
-- deixando o schema diferente do que o código espera. Rodar §1.1-b e reportar.
```

```sql
-- 1.1-b (só se 1.1 trouxe linhas): colunas da tabela que já existe
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('service_categories', 'services', 'products', 'commercial_plans')
ORDER BY table_name, ordinal_position;
```

### 1.2 As funções que os drafts usam existem (esperado: **2 linhas**; **3** se for usar a variante admin)

```sql
SELECT proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('is_workspace_member', 'update_updated_at_column', 'is_workspace_admin')
ORDER BY proname;
-- Esperado: is_workspace_admin (só necessário em §2.2), is_workspace_member, update_updated_at_column.
-- Faltou is_workspace_member ou update_updated_at_column ⇒ PARAR (o schema base não foi aplicado).
```

### 1.3 `quote_items.service_id` hoje (decide se §2.5 pode validar; esperado: **0**)

```sql
SELECT count(*) AS itens_com_service_id
FROM public.quote_items
WHERE service_id IS NOT NULL;
-- Esperado: 0 (a coluna é uuid sem FK, e o id local do catálogo — "svc-…" — nunca coube num uuid; o import
-- de orçamentos grava NULL). Se > 0, esses valores são órfãos (services ainda não existe): o
-- VALIDATE de §2.5 FALHARIA. Nesse caso, faça §2.5 só com o `ADD … NOT VALID` (a FK passa a valer para novas
-- linhas) e reporte a contagem; NÃO limpe os dados por conta própria.
```

### 1.4 `clients.library_assets` ainda não existe (esperado: **0 linhas**)

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'library_assets';
-- Esperado: 0 linhas. Se vier 1, alguém já aplicou — §2.4 é idempotente, pode seguir (registre).
```

### 1.5 Quantos clientes/workspaces (contexto do lock de §2.4; sem decisão)

```sql
SELECT (SELECT count(*) FROM public.clients)    AS clientes,
       (SELECT count(*) FROM public.workspaces) AS workspaces;
```

---

## 2. As migrations (drafts da Fase A §6; idempotentes)

### 2.1 Tabelas + RLS + triggers (draft 6.1–6.5) — **uma execução**

Rodar inteiro no SQL Editor. `CREATE TABLE IF NOT EXISTS` + blocos `DO` ⇒ reaplicar é no-op (só `NOTICE`).
Vocabulário **literal local** (G40/G49): `billing_type` guarda `'único'` **com acento**; o CHECK é preventivo.
`price`/`cost` em `NUMERIC(12,2)`. `commercial_plans.items` guarda **uuid já traduzido** (o import descarta item sem tradução — nunca grava id local).

```sql
-- G94 · catálogo comercial — tabelas (Fase A §6.1–§6.4)
CREATE TABLE IF NOT EXISTS public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8B5CF6',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  category TEXT,                                   -- rótulo legado (Service.category) — G37: não perder o campo
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  billing_type TEXT NOT NULL DEFAULT 'único',
  delivery_days INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] NOT NULL DEFAULT '{}',
  available_in_quotes BOOLEAN NOT NULL DEFAULT true,
  show_in_public_catalog BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT services_billing_type_known_chk
    CHECK (billing_type IN ('único','mensal','recorrente','personalizado','pacote')),
  CONSTRAINT services_price_nonneg_chk CHECK (price >= 0),
  CONSTRAINT services_delivery_days_nonneg_chk CHECK (delivery_days >= 0)
);

CREATE TABLE IF NOT EXISTS public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2),
  stock INTEGER,
  type TEXT NOT NULL DEFAULT 'digital',
  status TEXT NOT NULL DEFAULT 'active',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_type_known_chk CHECK (type IN ('digital','physical','addon','template','consulting')),
  CONSTRAINT products_status_known_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT products_price_nonneg_chk CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS public.commercial_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{refId (uuid já traduzido), kind, name}] — NUNCA id local
  highlight BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  is_demo BOOLEAN NOT NULL DEFAULT false,
  source_local_id TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT plans_billing_cycle_known_chk CHECK (billing_cycle IN ('one_time','monthly','quarterly','yearly')),
  CONSTRAINT plans_status_known_chk CHECK (status IN ('active','inactive')),
  CONSTRAINT plans_items_array_chk CHECK (jsonb_typeof(items) = 'array')
);

-- G94 · RLS (Fase A §6.5) — as 4 tabelas, molde de tasks: leitura e escrita por MEMBRO do workspace.
-- Cada policy só é criada se ainda não existir (não sobrescreve variante endurecida de §2.2).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('service_categories', 'service categories'),
      ('services',           'services'),
      ('products',           'products'),
      ('commercial_plans',   'commercial plans')
    ) AS v(tbl, label)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tbl);

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl
                   AND policyname = 'Users can select ' || r.label || ' in their workspaces') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_workspace_member(workspace_id))',
        'Users can select ' || r.label || ' in their workspaces', r.tbl);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl
                   AND policyname = 'Users can insert ' || r.label || ' in their workspaces') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_workspace_member(workspace_id))',
        'Users can insert ' || r.label || ' in their workspaces', r.tbl);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl
                   AND policyname = 'Users can update ' || r.label || ' in their workspaces') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id))',
        'Users can update ' || r.label || ' in their workspaces', r.tbl);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = r.tbl
                   AND policyname = 'Users can delete ' || r.label || ' in their workspaces') THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_workspace_member(workspace_id))',
        'Users can delete ' || r.label || ' in their workspaces', r.tbl);
    END IF;
  END LOOP;
END
$$;

-- G94 · triggers de updated_at (Fase A §6.5) — mesma função do trigger de tasks/clients
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['service_categories', 'services', 'products', 'commercial_plans'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger
                   WHERE tgrelid = ('public.' || t)::regclass AND tgname = 'update_' || t || '_updated_at') THEN
      EXECUTE format(
        'CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
        'update_' || t || '_updated_at', t);
    END IF;
  END LOOP;
END
$$;
```

### 2.2 (OPCIONAL) Variante admin — escrita só para admin/owner (decisão **Q2**)

A decisão adotada é **escrita por membro** (§2.1). **Pule este passo** a menos que o operador queira restringir.
Se quiser: depois de §2.1, trocar as 3 policies de escrita de **cada** tabela por `public.is_workspace_admin(workspace_id)`
(precedente já em uso: `20260830000800_g71_workspace_ai_credentials_admin_rls.sql`); a leitura (SELECT) permanece member
(o bot lê por service role). Exemplo para `services` — repetir para as outras 3 tabelas:

```sql
DROP POLICY IF EXISTS "Users can insert services in their workspaces" ON public.services;
DROP POLICY IF EXISTS "Users can update services in their workspaces" ON public.services;
DROP POLICY IF EXISTS "Users can delete services in their workspaces" ON public.services;
CREATE POLICY "Users can insert services in their workspaces" ON public.services
  FOR INSERT TO authenticated WITH CHECK (public.is_workspace_admin(workspace_id));
CREATE POLICY "Users can update services in their workspaces" ON public.services
  FOR UPDATE TO authenticated USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));
CREATE POLICY "Users can delete services in their workspaces" ON public.services
  FOR DELETE TO authenticated USING (public.is_workspace_admin(workspace_id));
```

> **Consequência no app** se este passo for aplicado: membros não-admin **leem** o catálogo da nuvem mas as escritas
> são recusadas pelo banco (RLS) — a tela mostra o erro legível da escrita, sem fingir sucesso. Reaplicar §2.1 depois
> **não** desfaz isto (os blocos `DO` só criam o que falta).

### 2.3 Índices únicos do import (draft 6.6) — **CADA `CREATE INDEX` EM UMA EXECUÇÃO, autocommit**

`CREATE INDEX CONCURRENTLY` **não pode** rodar dentro de transação: colar **um** comando por vez no SQL Editor
(não os 4 juntos). É o arbiter do `upsert(onConflict: "workspace_id,source_local_id")` do import (G56) —
**não-parcial de propósito** (um índice parcial não serve de arbiter; `NULL` nunca colide com `NULL`, então linhas
nativas com `source_local_id` nulo convivem). Tabelas vazias neste ponto ⇒ nenhuma duplicata possível.

```sql
-- execução 1
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_service_categories_source_local
  ON public.service_categories (workspace_id, source_local_id);
```
```sql
-- execução 2
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_services_source_local
  ON public.services (workspace_id, source_local_id);
```
```sql
-- execução 3
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_products_source_local
  ON public.products (workspace_id, source_local_id);
```
```sql
-- execução 4
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_commercial_plans_source_local
  ON public.commercial_plans (workspace_id, source_local_id);
```

> **Se um `CONCURRENTLY` falhar/for cancelado**, o Postgres deixa um índice **INVÁLIDO** (`indisvalid = false`) e o
> `IF NOT EXISTS` de uma nova tentativa o **pula** por já existir o nome. §3.3 verifica `indisvalid`; se vier `false`:
> `DROP INDEX CONCURRENTLY IF EXISTS public.<nome>;` e rodar de novo a execução correspondente.

### 2.4 `clients.library_assets` — Biblioteca de Materiais (draft 6.8, opção (a) do G75)

Coluna JSONB em `clients` (a UI já trabalha por "substitui a lista inteira"); sem Storage nesta trilha (Q5).
`ADD COLUMN … NOT NULL DEFAULT '[]'` com default constante é **só metadado** no Postgres ≥ 11 (sem reescrever a tabela,
lock instantâneo). O CHECK limita a 200 itens; entra `NOT VALID` e é validado em seguida (nenhuma linha existente
tem a coluna preenchida, então a validação é trivial).

**SQL VERBATIM do draft 6.8 da Fase A** (as duas instruções do draft, sem envoltório `DO`):

```sql
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS library_assets JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.clients
  ADD CONSTRAINT clients_library_assets_array_chk
  CHECK (jsonb_typeof(library_assets) = 'array' AND jsonb_array_length(library_assets) <= 200) NOT VALID;
```

Depois (execução separada — o draft deixa isto como o comentário "VALIDATE depois"), **somente depois de rodar as provas 1–3 da lane E (§3.5, "Prova 6.8") e confirmar `0` na prova 3** (nenhuma linha viola o CHECK). Este é o **único** `VALIDATE` do pacote:

```sql
ALTER TABLE public.clients VALIDATE CONSTRAINT clients_library_assets_array_chk;
```

> **Reaplicação:** `ADD COLUMN IF NOT EXISTS` é no-op; o `ADD CONSTRAINT` **não** é idempotente — numa 2ª execução dá *"constraint … already exists"*, o que é **esperado e inofensivo** (a constraint já está lá — confira em §3.5). **Não** improvisar `DROP CONSTRAINT`. O `VALIDATE` pode ser repetido sem erro.

> **Atenção:** a coluna existir **não** liga a Biblioteca na nuvem. O código (whitelist de `clients`, mapper, leitura/
> escrita e import da Biblioteca) é a trilha **M1–M4** — rodada própria. Até lá a Biblioteca segue no store local por
> uuid do M0 (G97). Aplicar esta coluna agora é inerte.

### 2.5 FK `quote_items.service_id → services(id)` (draft 6.7) — **OPCIONAL** (só depois de §2.1)

Hoje `quote_items.service_id` é um `uuid` solto, sem FK (morto nos dois sentidos — Fase A §3.4/D). A FK faz o banco
recusar um `service_id` que não exista em `services` e, com `ON DELETE SET NULL`, **nunca apaga item de orçamento**.
A escrita de orçamento que **manda** `service_id` é a fatia **CT5** (rodada própria, lane de Orçamentos — **não** neste pacote);
se o operador preferir `service_id` sem FK por ora, **este passo é dispensável** (a escrita passará a mandar uuid válido de qualquer jeito).
Pré-condição: §1.3 = 0 (para o `VALIDATE`).

```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.quote_items'::regclass AND conname = 'quote_items_service_id_fkey') THEN
    ALTER TABLE public.quote_items
      ADD CONSTRAINT quote_items_service_id_fkey FOREIGN KEY (service_id)
      REFERENCES public.services(id) ON DELETE SET NULL NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.quote_items VALIDATE CONSTRAINT quote_items_service_id_fkey;
```

---

## 3. SELECTs de prova (depois de §2)

### 3.1 As 4 tabelas existem, com as colunas certas (esperado: **4 linhas** em a; contagens abaixo em b)

```sql
-- a) existência
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('service_categories', 'services', 'products', 'commercial_plans')
ORDER BY table_name;
-- Esperado: commercial_plans, products, service_categories, services

-- b) nº de colunas por tabela
SELECT table_name, count(*) AS colunas
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('service_categories', 'services', 'products', 'commercial_plans')
GROUP BY table_name ORDER BY table_name;
-- Esperado: commercial_plans = 14 | products = 15 | service_categories = 9 | services = 19
```

```sql
-- c) tipos que o código depende (price/cost numéricos, items jsonb, tags array)
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'services'         AND column_name IN ('price', 'tags', 'billing_type', 'delivery_days'))
    OR (table_name = 'products'         AND column_name IN ('price', 'cost', 'stock'))
    OR (table_name = 'commercial_plans' AND column_name IN ('price', 'items')))
ORDER BY table_name, column_name;
-- Esperado: price/cost = numeric; stock/delivery_days = integer; items = jsonb; tags = ARRAY; billing_type = text
```

### 3.2 RLS ligada, 4 policies por tabela, triggers, GRANTs (esperado: **4 / 16 / 4 / authenticated**)

```sql
SELECT relname, relrowsecurity AS rls_ligada
FROM pg_class
WHERE oid IN ('public.service_categories'::regclass, 'public.services'::regclass,
              'public.products'::regclass, 'public.commercial_plans'::regclass)
ORDER BY relname;
-- Esperado: 4 linhas, todas rls_ligada = true

SELECT tablename, count(*) AS policies
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('service_categories', 'services', 'products', 'commercial_plans')
GROUP BY tablename ORDER BY tablename;
-- Esperado: 4 policies em cada (select/insert/update/delete) — 16 no total

SELECT c.relname AS tabela, t.tgname AS trigger
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
WHERE NOT t.tgisinternal
  AND c.oid IN ('public.service_categories'::regclass, 'public.services'::regclass,
                'public.products'::regclass, 'public.commercial_plans'::regclass)
ORDER BY c.relname;
-- Esperado: 4 linhas (update_<tabela>_updated_at)

SELECT table_name, grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee = 'authenticated'
  AND table_name IN ('service_categories', 'services', 'products', 'commercial_plans')
GROUP BY table_name, grantee ORDER BY table_name;
-- Esperado: 4 linhas com DELETE,INSERT,SELECT,UPDATE (…) para authenticated. Se vier vazio, o default privilege
-- do projeto não cobriu as tabelas novas: o RLS sozinho NÃO basta — reportar (o app falharia com 42501).
```

### 3.3 Índices únicos válidos e NÃO-parciais (esperado: **4 linhas, todas indisvalid = true, parcial = false**)

```sql
SELECT i.indexrelid::regclass AS indice,
       i.indisunique          AS unico,
       i.indisvalid           AS indisvalid,
       (i.indpred IS NOT NULL) AS parcial
FROM pg_index i
WHERE i.indrelid IN ('public.service_categories'::regclass, 'public.services'::regclass,
                     'public.products'::regclass, 'public.commercial_plans'::regclass)
  AND i.indexrelid::regclass::text IN ('ux_service_categories_source_local', 'ux_services_source_local',
                                        'ux_products_source_local', 'ux_commercial_plans_source_local')
ORDER BY i.indexrelid::regclass::text;
-- Esperado: 4 linhas; unico = true, indisvalid = true, parcial = false em todas.
```

### 3.4 CHECKs do vocabulário (incluindo o ACENTO de "único") (esperado abaixo)

```sql
SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conname IN ('services_billing_type_known_chk', 'products_type_known_chk', 'products_status_known_chk',
                  'plans_billing_cycle_known_chk', 'plans_status_known_chk', 'plans_items_array_chk')
ORDER BY conname;
-- Esperado: 6 linhas. `services_billing_type_known_chk` lista 'único' COM acento (não 'unico'),
-- 'mensal', 'recorrente', 'personalizado', 'pacote'.

SELECT pg_get_constraintdef(oid) LIKE '%único%' AS tem_unico_com_acento
FROM pg_constraint WHERE conname = 'services_billing_type_known_chk';
-- Esperado: true. Se vier false o SQL foi colado sem UTF-8 (acento perdido): PARAR e reportar — o app
-- grava 'único' literal e o CHECK recusaria todo serviço "único".
```

```sql
-- (OPCIONAL) prova de escrita, 100% revertida: 'único' passa, 'unico' é recusado. Cada bloco termina em ROLLBACK.
BEGIN;
INSERT INTO public.services (workspace_id, name, billing_type)
SELECT id, 'prova-8b', 'único' FROM public.workspaces LIMIT 1;      -- Esperado: INSERT 0 1
ROLLBACK;

BEGIN;
INSERT INTO public.services (workspace_id, name, billing_type)
SELECT id, 'prova-8b', 'unico' FROM public.workspaces LIMIT 1;      -- Esperado: ERRO 23514 (services_billing_type_known_chk)
ROLLBACK;
```

### 3.5 `library_assets` e FK (esperado abaixo) + **regra de parada**

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'library_assets';
-- Esperado: library_assets | jsonb | NO | '[]'::jsonb

SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN ('clients_library_assets_array_chk', 'quote_items_service_id_fkey')
ORDER BY conname;
-- Esperado: clients_library_assets_array_chk = true; quote_items_service_id_fkey = true (se §2.5 foi aplicado;
-- ausente se foi pulado — registre qual dos dois casos).

SELECT count(*) AS clientes_com_biblioteca_na_nuvem
FROM public.clients WHERE jsonb_array_length(library_assets) > 0;
-- Esperado: 0 logo após §2.4 (a Biblioteca ainda não é escrita na nuvem — M1–M4).

SELECT confdeltype FROM pg_constraint WHERE conname = 'quote_items_service_id_fkey';
-- Esperado (se §2.5): 'n' (SET NULL)

SELECT (SELECT count(*) FROM public.service_categories) AS categorias,
       (SELECT count(*) FROM public.services)           AS servicos,
       (SELECT count(*) FROM public.products)           AS produtos,
       (SELECT count(*) FROM public.commercial_plans)   AS planos;
-- Esperado logo após §2 (ANTES do import de §4): 0 / 0 / 0 / 0.
```

#### Prova 6.8 — lane E (verbatim, numerada) — `clients.library_assets`

Estas são as provas que a lane E mandou para o 6.8, **sem alteração** (a numeração 1–4 é a dela). **Quando rodar:** as provas **1–3** entram **entre** o `ADD CONSTRAINT … NOT VALID` e o `VALIDATE` do §2.4 — a **3** é a pré-condição do `VALIDATE`. A prova **4** é o próprio `VALIDATE` e **não se repete aqui**: ele existe **uma vez só, no passo de aplicação (§2.4)**. (Os SELECTs acima, `convalidated = true` etc., são a prova **depois** do `VALIDATE` — complementares, não duplicam.)

```sql
-- 1) coluna existe, tipo/default certos
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'library_assets';
-- 2) CHECK existe
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.clients'::regclass AND conname = 'clients_library_assets_array_chk';
-- 3) nenhuma linha viola o CHECK antes do VALIDATE (esperado: 0)
SELECT count(*) FROM public.clients
WHERE NOT (jsonb_typeof(library_assets) = 'array' AND jsonb_array_length(library_assets) <= 200);
-- 4) VALIDATE: só depois de confirmar 0 na query 3 — executado UMA vez, no §2.4 (não repetido aqui).
```

**Esperado:** (1) `library_assets | jsonb | '[]'::jsonb | NO`; (2) 1 linha, `CHECK (((jsonb_typeof(library_assets) = 'array'::text) AND (jsonb_array_length(library_assets) <= 200)))` (o Postgres pode reformatar o texto; o que vale é a lógica: array **e** ≤ 200); (3) **0**.

**Regra de parada:** §3.1 com ≠ 4 tabelas ou contagem de colunas diferente; §3.2 com ≠ 4 RLS ligadas / ≠ 16 policies / GRANT
vazio; §3.3 com ≠ 4 índices ou qualquer `indisvalid = false`/`parcial = true`; §3.4 com `tem_unico_com_acento = false`;
§3.5 com `convalidated = false` ou contagens > 0 antes do import → **parar e reportar**; não seguir pra §4. **Prova 3 da lane E ≠ 0 → NÃO rodar o `VALIDATE` do §2.4** (há linha violando o CHECK): reportar.

---

## 4. Depois do SQL: import assistido pelo operador na UI

Pré-requisito: §3 todo verde. O import é **aditivo, idempotente (G56) e feito por quem tem os dados** — o catálogo
que existe só no `localStorage` do navegador **do operador** (não há como outro membro/dispositivo importá-lo).

1. Abrir o app **no mesmo navegador onde o catálogo foi cadastrado**, logado no workspace de produção.
2. **Configurações → Dados → "Importar catálogo comercial" → "Abrir importador".** O diálogo faz a sonda das 4 tabelas.
   - Se aparecer o alerta âmbar **"Schema pendente (pacote §8-b) — importação desabilitada"**, o §2 não está completo
     (o alerta lista as tabelas ausentes) — voltar ao §3.
3. Conferir as 4 seções, **nesta ordem obrigatória**: Etapa 1 Categorias → Etapa 2 Serviços → Etapa 3 Produtos → Etapa 4 Planos.
   Itens de demonstração **não aparecem** (nunca importam). Um serviço/produto/plano que depende de outro ainda não
   importado só habilita junto da dependência.
4. **"Selecionar todas as novas" → "Importar selecionados".** Ler o **relatório**: contagem por etapa e, se houver,
   **itens de plano DESCARTADOS** (serviço/produto sem correspondente — demo ou inexistente). O descarte é honesto e
   definitivo para aquele item; ajuste o plano no app depois, se quiser.
5. Reabrir o importador: tudo deve aparecer **"já importada"** e **"Importar selecionados" fica desabilitado** (2ª rodada = 0 novos).
6. Prova no banco (read-only):

```sql
SELECT (SELECT count(*) FROM public.service_categories WHERE is_demo = false) AS categorias,
       (SELECT count(*) FROM public.services           WHERE is_demo = false) AS servicos,
       (SELECT count(*) FROM public.products           WHERE is_demo = false) AS produtos,
       (SELECT count(*) FROM public.commercial_plans   WHERE is_demo = false) AS planos;
-- Esperado: bate com o que o relatório de §4.4 disse que criou.

SELECT count(*) AS itens_de_plano_com_id_local
FROM public.commercial_plans p, jsonb_array_elements(p.items) AS it
WHERE (it ->> 'refId') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
-- Esperado: 0 (nenhum item de plano com refId que não seja uuid — G67).

SELECT count(*) AS duplicatas
FROM (SELECT workspace_id, source_local_id FROM public.services
      WHERE source_local_id IS NOT NULL GROUP BY 1, 2 HAVING count(*) > 1) d;
-- Esperado: 0 (idem para as outras 3 tabelas; a UNIQUE impede, é só confirmação).
```

> **Limitação conhecida (documentada):** produtos e planos importados **perdem o `createdAt`/`updatedAt` originais**
> (a nuvem grava os timestamps do servidor). Serviços e categorias locais não os têm.
> **Importante:** os dados do `localStorage` **não são apagados** pelo import — ficam como estão (rede de segurança até o flip, CT7).

### 4.1 Testar a leitura/escrita na nuvem (CT4) num navegador de teste — **sem flip**

O padrão continua LOCAL para todos. Para **um** navegador de teste ver o catálogo da nuvem: Configurações → Dados →
cards **"Catálogo comercial · fonte de dados"** e **"Catálogo comercial · escrita na nuvem"** (padrão dos outros domínios; só o valor **explícito** "Supabase"
seleciona a nuvem). Detalhes e comportamento esperado em
[`etapa-5-g94-ct4-fase-b.md`](etapa-5-g94-ct4-fase-b.md). **Não** habilitar para os demais usuários — o flip do
domínio é o CT7.

---

## 5. Depois da aplicação

### 5.1 Espelho em `supabase/migrations/` (lane escreve, operador registra)

As migrations hoje vivem **só neste doc** (e nos drafts da Fase A). Depois de aplicadas, o repo precisa refletir o
banco (mesmo padrão de [`migrations-espelho-8b.md`](migrations-espelho-8b.md)): uma lane promove os blocos a arquivos
com a **série real de aplicação** (a data da sessão §8-b — o operador informa), **um arquivo por execução**, com os
`CONCURRENTLY` em arquivos separados:

| Arquivo (nome-base; prefixo = versão informada) | Conteúdo |
|---|---|
| `<V1>_etapa5_g94_catalogo_schema.sql` | §2.1 (tabelas + RLS + triggers) |
| `<V2>_etapa5_g94_service_categories_unique_source_local_id.sql` | §2.3 execução 1 |
| `<V3>_etapa5_g94_services_unique_source_local_id.sql` | §2.3 execução 2 |
| `<V4>_etapa5_g94_products_unique_source_local_id.sql` | §2.3 execução 3 |
| `<V5>_etapa5_g94_commercial_plans_unique_source_local_id.sql` | §2.3 execução 4 |
| `<V6>_etapa5_g94_clients_library_assets.sql` | §2.4 |
| `<V7>_etapa5_g94_quote_items_service_id_fkey.sql` | §2.5 (só se aplicado) |

E o operador registra no histórico do CLI **sem rodar o SQL de novo**:

```bash
supabase migration repair --status applied <V1>
supabase migration repair --status applied <V2>
supabase migration repair --status applied <V3>
supabase migration repair --status applied <V4>
supabase migration repair --status applied <V5>
supabase migration repair --status applied <V6>
supabase migration repair --status applied <V7>   # só se §2.5 foi aplicado
```

### 5.2 Regenerar `types.ts` (operador, introspecção read-only — G10)

```bash
supabase gen types typescript --project-id ewamvzncsloagtcvkbxv > src/integrations/supabase/types.ts
```

Só lê o catálogo (não executa DDL/DML). Commitar o arquivo regenerado numa branch de lane. Efeito esperado: as 4
tabelas passam a existir em `Database["public"]["Tables"]` e `clients.Row` ganha `library_assets`.

### 5.3 Rodada de **lane** pós-`gen types` (não do operador)

1. `src/repositories/catalogRepositoryShared.ts` usa hoje `catalogDb = supabase as unknown as SupabaseClient`
   (as tabelas não estão em `types.ts`). Trocar pelo cliente tipado e os repositórios de categorias/serviços/produtos/planos
   pelas `Row`/`Insert` geradas; **manter** `isMissingTableError`/`CatalogUnavailableError` (a degradação continua
   valendo em ambientes sem a migration) e os testes de degradação.
2. Conferir que as `Row` geradas batem com `SupabaseService`/`SupabaseProduct`/`SupabaseCommercialPlan` (se o gerador
   tipar `items` como `Json`, estreitar no mapper — já há leitura defensiva).
3. `clients.library_assets` tipado entra com a trilha M1–M4 (whitelist de `clients` + mapper), **não** nesta rodada.

---

## 6. Degradação (por que dá pra aplicar o SQL e o código em qualquer ordem sem derrubar o app)

| Situação | Efeito |
|---|---|
| Código novo, **sem** as 4 tabelas | **Padrão LOCAL** (flag não setada): zero efeito. Card de import: alerta "Schema pendente (pacote §8-b)" e botões desabilitados. Com a flag "Supabase" (teste): a tela avisa "schema pendente" e **cai no local** (nada some, nada é gravado na nuvem) |
| Tabelas aplicadas **sem** os índices únicos (§2.3) | leitura ok; **o import falha** (42P10 no upsert) — o card relata falha por item, **nada duplica**. Aplicar §2.3 e repetir |
| Tabelas + índices, flag local (padrão) | app idêntico ao de hoje; o catálogo da nuvem fica só como espelho do import |
| Tabelas + índices + flag "Supabase" em um navegador de teste | esse navegador lê/escreve o catálogo da nuvem (CT4); os demais seguem locais |
| FK de §2.5 aplicada, código atual | inerte: o app **não escreve** `quote_items.service_id` (CT5) |
| `library_assets` aplicada, código atual | inerte: nenhum código lê/escreve a coluna (M1–M4); a Biblioteca segue no store local por uuid (M0) |

---

## 7. Rollback

- **Código:** nada a re-deployar neste pacote (é só schema; o app é o front). O padrão LOCAL independe do banco.
- **Antes de qualquer DDL de rollback:** se o import (§4) já rodou, **exportar** o catálogo da nuvem
  (`SELECT * FROM public.services …` etc.) — o `localStorage` do navegador do operador ainda tem os dados originais
  (o import não os apaga), mas **catálogo criado direto na nuvem depois do CT4** só existe no banco.
- **FK (§2.5):** `ALTER TABLE public.quote_items DROP CONSTRAINT IF EXISTS quote_items_service_id_fkey;` (volta ao `uuid` solto; sem perda).
- **`library_assets` (§2.4):** `ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_library_assets_array_chk;` e
  `ALTER TABLE public.clients DROP COLUMN IF EXISTS library_assets;` — **destrói o que estiver gravado na coluna**
  (hoje nada: M1–M4 ainda não escrevem nela).
- **Tabelas (§2.1), só se realmente necessário e **depois** de §2.5:**
  ```sql
  DROP TABLE IF EXISTS public.commercial_plans;
  DROP TABLE IF EXISTS public.products;
  DROP TABLE IF EXISTS public.services;
  DROP TABLE IF EXISTS public.service_categories;
  ```
  **Apaga todo o catálogo da nuvem** (e seus índices/policies/triggers). O app degrada sozinho para o local (§6) —
  navegador com a flag "Supabase" verá "schema pendente" e voltará ao local. Preferível a apagar: **voltar a flag para
  "Local"** (card de Configurações).
- **Não** apagar tabela com a FK de §2.5 ainda de pé (o `DROP TABLE services` falha por dependência — de propósito).

---

## Referências
- Fase A: [`etapa-5-flip-catalogo-materiais-fase-a.md`](../architecture/etapa-5-flip-catalogo-materiais-fase-a.md) §6 (drafts), §8 (import), §9 (fatias)
- Rodadas: [`etapa-5-g94-m0-ct1.md`](etapa-5-g94-m0-ct1.md) (M0 + CT1), [`etapa-5-g94-ct2-ct3.md`](etapa-5-g94-ct2-ct3.md) (CT2 + import), [`etapa-5-g94-ct4-fase-b.md`](etapa-5-g94-ct4-fase-b.md) (CT4)
- Moldes: [`etapa-9-bot-pacote-operador-8b.md`](etapa-9-bot-pacote-operador-8b.md), [`g71-credenciais-terceiros-pacote-operador.md`](g71-credenciais-terceiros-pacote-operador.md), [`migrations-espelho-8b.md`](migrations-espelho-8b.md)
- Catálogo de gaps: G94, G56 (idempotência), G67 (uuid), G40/G49 (vocabulário literal), G29 (UI que não mente), G97 (Biblioteca)
