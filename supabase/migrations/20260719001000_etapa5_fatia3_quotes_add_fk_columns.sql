-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — Q1: colunas de fan-out client_id/opportunity_id
-- ============================================================================
-- DRIFT CONFIRMADO (docs/qa/etapa-5-fatia-3-quotes.md §0): a tabela public.quotes
-- NUNCA teve essas colunas versionadas, mas o código (useLocalQuotesImport.ts,
-- quotesRepository.listQuotesByOpportunity) já as lê/escreve. Nunca explodiu
-- porque nada foi importado ainda (nuvem = 0 quotes). Esta migration adiciona
-- as colunas que faltam, no mesmo padrão FK de projects/tasks/financial_transactions
-- (batch2_performance / create_projects_schema / create_tasks_schema):
--   ... uuid REFERENCES public.<tabela>(id) ON DELETE SET NULL
-- ON DELETE SET NULL (não CASCADE): apagar um cliente ou uma oportunidade NÃO
-- deve apagar o orçamento — só desliga o vínculo, preservando o registro
-- financeiro/comercial do orçamento em si.
--
-- Transacional (ALTER simples, sem CONCURRENTLY): tabela vazia em produção
-- (quotes = 0 linhas, medido em 2026-07-19), custo desprezível.
-- Os ÍNDICES dessas colunas vêm em arquivo separado (CONCURRENTLY, autocommit) —
-- ver 20260719001100_etapa5_fatia3_quotes_fk_indexes.sql.
-- ============================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quotes.client_id IS
  'Etapa 5 · Fatia 3 (Q1): cliente Supabase vinculado ao orçamento (fan-out). NULL = sem vínculo ou cliente ainda não migrado.';
COMMENT ON COLUMN public.quotes.opportunity_id IS
  'Etapa 5 · Fatia 3 (Q1): oportunidade Supabase vinculada ao orçamento (fan-out). NULL = sem vínculo ou oportunidade ainda não migrada.';
