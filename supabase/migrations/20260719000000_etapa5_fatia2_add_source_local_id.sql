-- ============================================================================
-- Etapa 5 · Fatia 2 (opportunities) — A3 (1/2): coluna source_local_id
-- ============================================================================
-- Contexto (código real):
--   crm_opportunities NÃO tem UNIQUE natural. O import
--   (src/hooks/useLocalOpportunitiesImport.ts) passa a usar
--   crmOpportunitiesRepository.upsertImportedOpportunity(...) com
--   .upsert(onConflict: "workspace_id,source_local_id") para ser idempotente.
--
--   source_local_id = `${installId}:${localId}` — namespacado por PERFIL DE NAVEGADOR
--   (src/lib/installId.ts). O escopo dos ids locais é o localStorage do navegador,
--   não o usuário → esse namespace evita fusão de oportunidades distintas de navegadores
--   diferentes no mesmo workspace. Ver docs/architecture/espelho-reversivel.md
--   (variante "entidade com fan-in e sem UNIQUE natural").
--
-- Este arquivo é TRANSACIONAL (ADD COLUMN é instantâneo, sem reescrita de tabela).
-- O índice único vai em arquivo SEPARADO (…_unique_source_local_id.sql) por causa do
-- CREATE INDEX CONCURRENTLY, que não roda dentro de transação.
--
-- >>> PRÉ-REQUISITO: rodar as checagens de pré-aplicação
--     (docs/database/etapa-5-fatia-2-preaplicacao.sql) e o export manual de
--     crm_opportunities ANTES (gate de segurança — projeto Free sem backup automático).
-- ============================================================================

ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS source_local_id text;

COMMENT ON COLUMN public.crm_opportunities.source_local_id IS
  'Etapa 5 · Fatia 2 — chave de origem do import local, formato <installId>:<localId> '
  '(namespacada por perfil de navegador). Arbiter da UNIQUE (workspace_id, source_local_id) '
  'para idempotência do import. NULL em linhas não originadas de import local.';
