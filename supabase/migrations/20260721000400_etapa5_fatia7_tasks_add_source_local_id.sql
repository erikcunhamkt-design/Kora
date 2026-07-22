-- Etapa 5 · Fatia 7 (projects/tasks) — F1 (3/4): coluna source_local_id em tasks
--
-- tasks não tem chave natural para o caso GERAL de import (tarefas "manual"/"projeto"/
-- "orçamento" — vocabulário local, nunca "project_template"). O backstop de
-- idempotência é `source_local_id`, mesmo padrão das demais fatias.
--
-- IMPORTANTE — este arbiter NÃO compete com o gerador de "tarefas base"
-- (`tasksRepository.createProjectBaseTasks`, source='project_template', Etapa 3),
-- porque os valores de `source` são disjuntos por construção: o vocabulário local de
-- Task.source ("manual"/"projeto"/"orçamento") nunca produz o literal
-- "project_template" — essa string só existe no caminho nativo da nuvem, hoje sem
-- nenhuma UI que o acione (ver docs/qa/etapa-5-fatia-7-projects.md §2.3/§9). Ao
-- contrário de projects (que precisou de uma árvore de decisão explícita porque o
-- vocabulário de origem colidia), aqui a ausência de colisão é uma propriedade do
-- dado, não precisa de lógica de coexistência no código.
--
-- O índice único vai em arquivo SEPARADO (…_unique_source_local_id.sql) por causa do
-- CREATE INDEX CONCURRENTLY (não roda dentro de transação).

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source_local_id text;

COMMENT ON COLUMN public.tasks.source_local_id IS
  'Etapa 5 · Fatia 7 (F1): chave de idempotência do import local->Supabase, formato "<installId>:<localId>" (src/lib/installId.ts). Arbiter de ux_tasks_source_local (workspace_id, source_local_id). NULL para linhas não vindas de import geral (legado, ou geradas nativamente na nuvem via CreateProjectBaseTasksDialog/Etapa 3, source=''project_template'' — vocabulário disjunto do import geral, ver nota acima).';
