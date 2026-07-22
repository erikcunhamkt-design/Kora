-- Etapa 5 · Fatia 7 (projects/tasks) — F1 (2/4): UNIQUE (workspace_id, source_local_id) em projects
--
-- É o arbiter do upsert(onConflict: "workspace_id,source_local_id") usado pelo import
-- GERAL de projects (projetos sem fan-in de quote, ou já resolvidos via
-- findProjectByQuote — ver docs/qa/etapa-5-fatia-7-projects.md §6).
--
-- >>> NÃO-PARCIAL de propósito (mesmo raciocínio de P8b e das Fatias 2/3/4/6): um
--     índice único PARCIAL (WHERE source_local_id IS NOT NULL) não serve de arbiter
--     para ON CONFLICT — o inference do Postgres exige um índice cuja definição bata
--     exatamente com as colunas do ON CONFLICT, sem predicado adicional. Não-parcial
--     permite ilimitadas linhas legadas com source_local_id NULL sem conflito entre si
--     (NULL nunca colide com NULL numa UNIQUE).
--
-- >>> COEXISTE, não compete, com `ux_projects_from_quote` (Etapa 3 S5) — colunas
--     diferentes (aqui: workspace_id+source_local_id; lá: quote_id sozinho, parcial),
--     predicados diferentes, nunca a mesma operação de escrita usa os dois ao mesmo
--     tempo. Ver §6 do doc da fatia para a árvore de decisão completa.
--
-- >>> APLICAÇÃO: CREATE INDEX CONCURRENTLY não pode rodar dentro de uma transação.
--     Aplicar em autocommit (SQL Editor do Supabase, ou psql sem BEGIN/COMMIT).
--
-- >>> PRÉ-REQUISITO: confirmar que todas as linhas têm source_local_id IS NULL
--     (coluna recém-criada pela migration anterior, nenhum import rodou ainda) —
--     não há duplicata possível nesta aplicação (nuvem = 0 projetos vivos, medido
--     na Fase A, §0 deste doc).

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_projects_source_local
  ON public.projects (workspace_id, source_local_id);
