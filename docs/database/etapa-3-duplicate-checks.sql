-- ============================================================================
-- Etapa 3 · S5 — Checagem de duplicatas (RODAR ANTES de criar os índices únicos)
-- ============================================================================
-- Somente leitura (SELECT). Rode no Supabase Dashboard > SQL Editor.
-- Regra: se uma query retornar 0 linhas, o índice único correspondente pode ser
-- criado com segurança. Se retornar linhas, HÁ duplicatas — a criação do
-- CREATE UNIQUE INDEX CONCURRENTLY falhará (e deixará um índice INVÁLIDO). Nesse
-- caso é preciso um passo de LIMPEZA (UPDATE/DELETE), que exige sua aprovação
-- explícita e separada — este arquivo NÃO altera dados.
--
-- Cada query agrupa por quote_id (a chave real do índice; quote_id é globalmente
-- único) e lista os ids em conflito para facilitar a inspeção manual.
-- ============================================================================

-- (1) Recebíveis de orçamento duplicados
--     -> bloqueia ux_ft_receivable_from_quote
SELECT
  quote_id,
  count(*)        AS n,
  array_agg(id)   AS transaction_ids,
  array_agg(workspace_id) AS workspace_ids
FROM public.financial_transactions
WHERE source = 'quote'
  AND type = 'receivable'
  AND deleted_at IS NULL
  AND quote_id IS NOT NULL
GROUP BY quote_id
HAVING count(*) > 1
ORDER BY n DESC;

-- (2) Projetos de orçamento duplicados
--     -> bloqueia ux_projects_from_quote
SELECT
  quote_id,
  count(*)        AS n,
  array_agg(id)   AS project_ids,
  array_agg(workspace_id) AS workspace_ids
FROM public.projects
WHERE source = 'quote'
  AND deleted_at IS NULL
  AND quote_id IS NOT NULL
GROUP BY quote_id
HAVING count(*) > 1
ORDER BY n DESC;

-- ============================================================================
-- (opcional) Confirmação do estado de is_workspace_member (item 1 da Etapa 3)
-- Deve retornar provolatile='s' (STABLE) e prosecdef=true (SECURITY DEFINER),
-- confirmando que o batch2_performance já foi aplicado nesta base.
-- ============================================================================
SELECT
  p.proname,
  p.provolatile,   -- 's' = STABLE (esperado); 'v' = VOLATILE (batch2 não aplicado)
  p.prosecdef,     -- true = SECURITY DEFINER (esperado)
  pg_get_function_identity_arguments(p.oid) AS args,
  p.proconfig      -- deve conter search_path=public
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_workspace_member';
