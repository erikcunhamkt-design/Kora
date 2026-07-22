-- Etapa 5 · Fatia 7 (projects/tasks) — F1 (4/4): UNIQUE (workspace_id, source_local_id) em tasks
--
-- É o arbiter do upsert(onConflict: "workspace_id,source_local_id") usado pelo import
-- GERAL de tasks (todas — não há subconjunto de negócio a desviar, ver migration
-- anterior e docs/qa/etapa-5-fatia-7-projects.md §6/§9).
--
-- >>> NÃO-PARCIAL de propósito (mesmo raciocínio de P8b e das Fatias 2/3/4/6): um
--     índice único PARCIAL (WHERE source_local_id IS NOT NULL) não serve de arbiter
--     para ON CONFLICT — o inference do Postgres exige um índice cuja definição bata
--     exatamente com as colunas do ON CONFLICT, sem predicado adicional. Não-parcial
--     permite ilimitadas linhas legadas com source_local_id NULL sem conflito entre si
--     (NULL nunca colide com NULL numa UNIQUE).
--
-- >>> NÃO É o índice que resolveria a corrida TOCTOU do gerador de "tarefas base"
--     (source='project_template') — aquele é um problema diferente, sem solução via
--     índice simples (ver §9 do doc da fatia: o motivo é sort_order variar conforme a
--     seleção do usuário no dialog, não uma posição fixa por tarefa-padrão). Catalogado
--     separadamente, não resolvido nesta migration.
--
-- >>> APLICAÇÃO: CREATE INDEX CONCURRENTLY não pode rodar dentro de uma transação.
--     Aplicar em autocommit (SQL Editor do Supabase, ou psql sem BEGIN/COMMIT).
--
-- >>> PRÉ-REQUISITO: confirmar que todas as linhas têm source_local_id IS NULL
--     (coluna recém-criada pela migration anterior, nenhum import rodou ainda) —
--     não há duplicata possível nesta aplicação (nuvem = 0 tasks vivas, medido na
--     Fase A, §0 deste doc).

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_tasks_source_local
  ON public.tasks (workspace_id, source_local_id);
