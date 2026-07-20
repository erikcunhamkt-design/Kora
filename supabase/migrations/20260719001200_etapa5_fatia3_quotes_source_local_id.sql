-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — Q2 (1/2): coluna source_local_id
-- ============================================================================
-- Variante B do molde "Espelho Reversível" (idêntica à Fatia 2 / opportunities):
-- `quotes` não tem chave única natural (dois orçamentos podem legitimamente ter
-- mesmo título/cliente/total). O backstop de idempotência é `source_local_id`
-- namespacado por perfil de navegador: `${installId}:${localId}`
-- (src/lib/installId.ts, já existente — reutilizado, nenhuma infra nova aqui).
--
-- Transacional (ALTER simples). O UNIQUE (arquivo seguinte) vem em CONCURRENTLY.
-- ============================================================================

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS source_local_id text;

COMMENT ON COLUMN public.quotes.source_local_id IS
  'Etapa 5 · Fatia 3 (Q2): chave de idempotência do import local->Supabase, formato "<installId>:<localId>" (src/lib/installId.ts). Arbiter de ux_quotes_source_local (workspace_id, source_local_id) e do RPC import_quote_with_items. NULL para linhas não vindas de import (legado).';
