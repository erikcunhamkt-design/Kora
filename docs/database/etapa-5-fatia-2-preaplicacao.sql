-- ============================================================================
-- Etapa 5 · Fatia 2 (opportunities) — checagens de PRÉ-APLICAÇÃO da migration A3
-- ============================================================================
-- Rode ANTES de aplicar as migrations (e DEPOIS do export manual de crm_opportunities).
-- Ajuste <WS> para o workspace de teste. Sequência: (1) e (2) antes de tudo;
-- aplicar o ALTER; (3) antes do INDEX; aplicar o INDEX (autocommit); (4) depois.

-- ----------------------------------------------------------------------------
-- (1) BASELINE — contagem atual de oportunidades no workspace (guarde o número).
-- ----------------------------------------------------------------------------
select count(*) as opps_antes
from public.crm_opportunities
where workspace_id = '<WS>';

-- ----------------------------------------------------------------------------
-- (2) A coluna source_local_id ainda NÃO existe (rodar ANTES do ALTER).
--     Esperado: 0 linhas.
-- ----------------------------------------------------------------------------
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'crm_opportunities'
  and column_name = 'source_local_id';

-- ----------------------------------------------------------------------------
-- (3) PÓS-ALTER, PRÉ-INDEX — todas as linhas com source_local_id NULL
--     (coluna recém-criada) → zero risco de conflito na criação do índice único.
--     Esperado: com_source_local_id = 0.
-- ----------------------------------------------------------------------------
select count(*)                    as total,
       count(source_local_id)      as com_source_local_id
from public.crm_opportunities;

-- ----------------------------------------------------------------------------
-- (4) PÓS-INDEX — confirmar índice válido e único.
--     Esperado: indisvalid = t, indisunique = t.
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid = 'public.ux_crm_opp_source_local'::regclass;
