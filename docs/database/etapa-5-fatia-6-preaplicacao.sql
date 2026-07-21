-- ============================================================================
-- Etapa 5 · Fatia 6 (finance) — checagens de PRÉ-APLICAÇÃO das migrations F1
-- ============================================================================
-- Rode ANTES de aplicar (e DEPOIS do export manual de financial_transactions, gate
-- 1 do protocolo — embora a nuvem esteja com 0 linhas vivas, per decisão F6). Ajuste
-- <WS> para o workspace de teste. Sequência de aplicação (2 arquivos):
--   (1)(2) antes de tudo
--   -> aplicar 20260721000000 (ALTER: source_local_id)
--   (3) confere a coluna existe e todas as linhas começam NULL
--   -> aplicar 20260721000100 (UNIQUE INDEX CONCURRENTLY: ux_financial_transactions_source_local)
--   (4) confere indisvalid + indisunique
--   (5) confirma que ux_ft_receivable_from_quote (Etapa 3, já existente) NÃO foi
--       tocado por nenhuma das duas migrations acima — os dois índices coexistem
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) BASELINE — contagem atual de financial_transactions vivas no workspace.
--     Esperado (per decisão F6, 2026-07-21): 0.
-- ----------------------------------------------------------------------------
select count(*) as financial_transactions_antes
from public.financial_transactions
where workspace_id = '<WS>' and deleted_at is null;

-- ----------------------------------------------------------------------------
-- (2) A coluna source_local_id ainda NÃO existe (rodar ANTES do ALTER).
--     Esperado: 0 linhas.
-- ----------------------------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'financial_transactions'
  and column_name = 'source_local_id';

-- ----------------------------------------------------------------------------
-- (3) PÓS-ALTER de source_local_id — confirma a coluna existe e todas as
--     linhas começam NULL (zero risco de conflito na criação do índice único).
--     Esperado: com_source_local_id = 0.
-- ----------------------------------------------------------------------------
select
  count(*)                    as total,
  count(source_local_id)      as com_source_local_id
from public.financial_transactions;

-- ----------------------------------------------------------------------------
-- (4) PÓS-INDEX (ux_financial_transactions_source_local) — confirma válido e
--     único. Esperado: indisvalid = t, indisunique = t.
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid = 'public.ux_financial_transactions_source_local'::regclass;

-- ----------------------------------------------------------------------------
-- (5) CONTROLE — ux_ft_receivable_from_quote (Etapa 3, já existente) segue
--     intocado: mesma definição de antes, ainda válido/único. As duas
--     migrations desta fatia NÃO alteram esse índice.
--     Esperado: indisvalid = t, indisunique = t (mesmo valor da Fase A, §0.1
--     query 4 — comparar para confirmar que nada mudou).
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique,
       pg_get_indexdef(indexrelid) as definition
from pg_index
where indexrelid = 'public.ux_ft_receivable_from_quote'::regclass;
