-- ============================================================================
-- Etapa 3 · S5 — UNIQUE anti-race: projeto gerado a partir de orçamento
-- ============================================================================
-- Contexto (código real):
--   src/repositories/projectsRepository.ts
--     findProjectByQuote(): SELECT ... WHERE workspace_id, quote_id,
--       source='quote', deleted_at IS NULL
--     createProjectFromQuote(): INSERT (status='active', source='quote', ...)
--   Dedup no app (SELECT-depois-INSERT) em
--   src/components/crm/CreateProjectFromQuoteDialog.tsx.
--   Mesma corrida do recebível: dois SELECTs "vazios" -> 2 projetos para o mesmo
--   orçamento. Índice único parcial torna a duplicidade impossível no banco.
--
-- Invariante reforçada: no máximo UM projeto VIVO (deleted_at IS NULL) de
--   source='quote' por quote_id. (projects não tem coluna `type`, então o
--   predicado é apenas source='quote' AND deleted_at IS NULL.)
--   quote_id é globalmente único (FK -> quotes.id) -> a chave (quote_id) basta.
--
-- >>> APLICAÇÃO (IMPORTANTE): CREATE INDEX CONCURRENTLY NÃO roda dentro de
--     transação. Sem BEGIN/COMMIT aqui. Aplique em AUTOCOMMIT:
--       - Supabase Dashboard > SQL Editor, OU
--       - psql "$DATABASE_URL" -f <este arquivo>
--     NÃO via `supabase db push` (pode envolver em transação).
--
-- >>> PRÉ-REQUISITO: rodar ANTES a checagem de duplicatas
--     (docs/database/etapa-3-duplicate-checks.sql, query 2). Só criar se retornar
--     0 linhas. Se o CONCURRENTLY falhar, ele deixa índice INVÁLIDO -> rode
--     `DROP INDEX IF EXISTS public.ux_projects_from_quote;` e limpe as duplicatas
--     (com aprovação) antes de recriar.
--
-- >>> ATENÇÃO (código): INSERT concorrente perdedor recebe 23505. Hoje
--     createProjectFromQuote apenas propaga o erro. Recomenda-se tratar 23505 como
--     "já existe" (mudança de código à parte e aprovada). NÃO incluído aqui.
-- ============================================================================

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_projects_from_quote
  ON public.projects (quote_id)
  WHERE source = 'quote' AND deleted_at IS NULL;
