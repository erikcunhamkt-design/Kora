-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — checagens de PRÉ-APLICAÇÃO das migrations Q1+Q2+Q3
-- ============================================================================
-- Rode ANTES de aplicar (e DEPOIS do export manual de quotes + quote_items, gate
-- 1 do protocolo). Ajuste <WS> para o workspace de teste. Sequência de aplicação:
--   (1)(2) antes de tudo
--   -> aplicar 20260719001000 (ALTER: client_id/opportunity_id)
--   (3) confere as colunas
--   -> aplicar 20260719001100 (INDEX CONCURRENTLY: idx_quotes_client/opportunity)
--   (4) confere indisvalid dos 2 índices
--   -> aplicar 20260719001200 (ALTER: source_local_id)
--   (5) confere: todas as linhas com source_local_id IS NULL (zero risco de
--       conflito na criação do UNIQUE)
--   -> aplicar 20260719001300 (UNIQUE INDEX CONCURRENTLY: ux_quotes_source_local)
--   (6) confere indisvalid + indisunique
--   -> aplicar 20260719001400 (CREATE FUNCTION: import_quote_with_items)
--   (7) confere que o RPC existe e é SECURITY INVOKER (prosecdef = false)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) BASELINE — contagem atual de quotes/quote_items no workspace (guarde).
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.quotes where workspace_id = '<WS>')            as quotes_antes,
  (select count(*) from public.quote_items qi
     join public.quotes q on q.id = qi.quote_id
     where q.workspace_id = '<WS>')                                            as quote_items_antes;

-- ----------------------------------------------------------------------------
-- (2) As colunas client_id / opportunity_id / source_local_id ainda NÃO
--     existem (rodar ANTES de qualquer ALTER). Esperado: 0 linhas.
-- ----------------------------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'quotes'
  and column_name in ('client_id', 'opportunity_id', 'source_local_id');

-- ----------------------------------------------------------------------------
-- (3) PÓS-ALTER de client_id/opportunity_id — confirma as colunas existem e
--     começam todas NULL (nada quebrou nenhum FK existente).
-- ----------------------------------------------------------------------------
select
  count(*)                as total,
  count(client_id)         as com_client_id,
  count(opportunity_id)    as com_opportunity_id
from public.quotes;
-- esperado: com_client_id = 0, com_opportunity_id = 0 (colunas recém-criadas).

-- ----------------------------------------------------------------------------
-- (4) PÓS-INDEX (idx_quotes_client / idx_quotes_opportunity) — confirma válidos.
--     Esperado: indisvalid = t para os dois (não são UNIQUE -> indisunique = f).
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid in (
  'public.idx_quotes_client'::regclass,
  'public.idx_quotes_opportunity'::regclass
);

-- ----------------------------------------------------------------------------
-- (5) PÓS-ALTER de source_local_id, PRÉ-UNIQUE-INDEX — todas as linhas com
--     source_local_id NULL (coluna recém-criada) -> zero risco de conflito na
--     criação do índice único. Esperado: com_source_local_id = 0.
-- ----------------------------------------------------------------------------
select
  count(*)                    as total,
  count(source_local_id)      as com_source_local_id
from public.quotes;

-- ----------------------------------------------------------------------------
-- (6) PÓS-INDEX (ux_quotes_source_local) — confirma válido e único.
--     Esperado: indisvalid = t, indisunique = t.
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid = 'public.ux_quotes_source_local'::regclass;

-- ----------------------------------------------------------------------------
-- (7) PÓS-RPC — confirma que import_quote_with_items existe e é SECURITY
--     INVOKER (prosecdef = false), com search_path fixo (proconfig mostra
--     'search_path=public'). Confere a decisão de segurança do Q3.
-- ----------------------------------------------------------------------------
select proname, prosecdef, proconfig
from pg_proc
where proname = 'import_quote_with_items';
-- esperado: prosecdef = false (INVOKER); proconfig contém 'search_path=public'.
