-- Etapa 5 · Fatia 7 (projects/tasks) — F1 (1/4): coluna source_local_id em projects
--
-- projects não tem chave natural para o caso GERAL de import (projetos "manual").
-- O backstop de idempotência é `source_local_id`, mesmo padrão das Fatias 2/3/4/6
-- (clients/quotes/opportunities/finance): `${installId}:${localId}`
-- (namespacado por perfil de navegador, src/lib/installId.ts).
--
-- IMPORTANTE — este arbiter NÃO substitui nem compete com `ux_projects_from_quote`
-- (índice parcial já existente, Etapa 3 S5). Os dois coexistem: este cobre
-- idempotência geral do import; aquele cobre a regra de negócio "1 projeto vivo por
-- orçamento", que se aplica só ao subconjunto source='quote'. Ver
-- docs/qa/etapa-5-fatia-7-projects.md §6 para a árvore de decisão completa de qual
-- caminho de escrita usar por linha, incluindo a tradução de vocabulário local
-- "orçamento" -> nuvem "quote" (Project.source local nunca usa o literal "quote").
--
-- O índice único vai em arquivo SEPARADO (…_unique_source_local_id.sql) por causa do
-- CREATE INDEX CONCURRENTLY (não roda dentro de transação).

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS source_local_id text;

COMMENT ON COLUMN public.projects.source_local_id IS
  'Etapa 5 · Fatia 7 (F1): chave de idempotência do import local->Supabase, formato "<installId>:<localId>" (src/lib/installId.ts). Arbiter de ux_projects_source_local (workspace_id, source_local_id). NULL para linhas não vindas de import geral (legado, ou criadas nativamente na nuvem via CreateProjectFromQuoteDialog/Etapa 3 — essas continuam arbitradas por ux_projects_from_quote quando aplicável).';
