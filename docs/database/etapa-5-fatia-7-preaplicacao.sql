-- ============================================================================
-- Etapa 5 · Fatia 7 (projects/tasks) — checagens de PRÉ-APLICAÇÃO das migrations F1
-- ============================================================================
-- Rode ANTES de aplicar. Ajuste <WS> para o workspace de teste. Sequência de
-- aplicação (4 arquivos, DOIS pares independentes — projects e tasks não dependem
-- um do outro, podem ser aplicados em qualquer ordem entre si):
--   (1)(2) antes de tudo — baseline de projects e tasks
--   -> aplicar 20260721000200 (ALTER projects: source_local_id)
--   (3) confere a coluna existe em projects e todas as linhas começam NULL
--   -> aplicar 20260721000300 (UNIQUE INDEX CONCURRENTLY: ux_projects_source_local)
--   (4) confere indisvalid + indisunique de ux_projects_source_local
--   (5) confirma que ux_projects_from_quote (Etapa 3, já existente) NÃO foi tocado
--   -> aplicar 20260721000400 (ALTER tasks: source_local_id)
--   (6) confere a coluna existe em tasks e todas as linhas começam NULL
--   -> aplicar 20260721000500 (UNIQUE INDEX CONCURRENTLY: ux_tasks_source_local)
--   (7) confere indisvalid + indisunique de ux_tasks_source_local
-- ============================================================================

-- ----------------------------------------------------------------------------
-- (1) BASELINE — contagem atual de projects/tasks vivos no workspace.
--     Esperado (per Fase A, medição do revisor): 0 e 0.
-- ----------------------------------------------------------------------------
select
  (select count(*) from public.projects
   where workspace_id = '<WS>' and deleted_at is null) as projects_antes,
  (select count(*) from public.tasks
   where workspace_id = '<WS>' and deleted_at is null) as tasks_antes;

-- ----------------------------------------------------------------------------
-- (2) As colunas source_local_id ainda NÃO existem (rodar ANTES do ALTER).
--     Esperado: 0 linhas.
-- ----------------------------------------------------------------------------
select table_name, column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('projects', 'tasks')
  and column_name = 'source_local_id';

-- ----------------------------------------------------------------------------
-- (3) PÓS-ALTER de projects.source_local_id — confirma a coluna existe e todas
--     as linhas começam NULL (zero risco de conflito na criação do índice único).
--     Esperado: com_source_local_id = 0.
-- ----------------------------------------------------------------------------
select
  count(*)               as total,
  count(source_local_id)  as com_source_local_id
from public.projects;

-- ----------------------------------------------------------------------------
-- (4) PÓS-INDEX (ux_projects_source_local) — confirma válido e único.
--     Esperado: indisvalid = t, indisunique = t.
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid = 'public.ux_projects_source_local'::regclass;

-- ----------------------------------------------------------------------------
-- (5) CONTROLE — ux_projects_from_quote (Etapa 3, já existente) segue intocado:
--     mesma definição de antes, ainda válido/único. As duas migrations desta
--     fatia NÃO alteram esse índice.
--     Esperado: indisvalid = t, indisunique = t (mesmo valor da Fase A, §0
--     query 7 — comparar para confirmar que nada mudou).
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique,
       pg_get_indexdef(indexrelid) as definition
from pg_index
where indexrelid = 'public.ux_projects_from_quote'::regclass;

-- ----------------------------------------------------------------------------
-- (6) PÓS-ALTER de tasks.source_local_id — mesma checagem, para tasks.
--     Esperado: com_source_local_id = 0.
-- ----------------------------------------------------------------------------
select
  count(*)               as total,
  count(source_local_id)  as com_source_local_id
from public.tasks;

-- ----------------------------------------------------------------------------
-- (7) PÓS-INDEX (ux_tasks_source_local) — confirma válido e único.
--     Esperado: indisvalid = t, indisunique = t.
-- ----------------------------------------------------------------------------
select indexrelid::regclass as index_name, indisvalid, indisunique
from pg_index
where indexrelid = 'public.ux_tasks_source_local'::regclass;
