-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — Q1 (2/2): índices dos FKs client_id/opportunity_id
-- ============================================================================
-- Mesmo padrão de idx_projects_client / idx_projects_opportunity / idx_ft_opportunity
-- (batch2_performance): índice PARCIAL (WHERE ... IS NOT NULL) — menor, e só serve
-- lookups que de fato filtram por FK preenchida (NULL nunca é buscado por igualdade).
--
-- >>> Estes NÃO são arbiters de idempotência (não são UNIQUE) — a regra do P8b
--     (índice parcial quebra ON CONFLICT) não se aplica aqui. O UNIQUE não-parcial
--     de idempotência é o de source_local_id (Q2, arquivos seguintes), que É o
--     arbiter do upsert/RPC.
--
-- >>> APLICAÇÃO: CREATE INDEX CONCURRENTLY NÃO roda dentro de transação. Este
--     arquivo NÃO contém BEGIN/COMMIT. Aplique em AUTOCOMMIT (Supabase SQL Editor
--     ou `psql -f`). NÃO aplique via `supabase db push` (pode envolver em
--     transação e o CONCURRENTLY falharia).
--
-- >>> PRÉ-REQUISITO: 20260719001000_etapa5_fatia3_quotes_add_fk_columns.sql já
--     aplicado (as colunas precisam existir).
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotes_client
  ON public.quotes (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quotes_opportunity
  ON public.quotes (opportunity_id)
  WHERE opportunity_id IS NOT NULL;
