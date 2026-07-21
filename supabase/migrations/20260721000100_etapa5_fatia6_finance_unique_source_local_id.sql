-- Etapa 5 · Fatia 6 (finance) — F1 (2/2): UNIQUE (workspace_id, source_local_id)
--
-- É o arbiter do upsert(onConflict: "workspace_id,source_local_id") usado pelo import
-- GERAL (transações sem fan-in de quote, ou já resolvidas via findReceivableByQuote —
-- ver docs/qa/etapa-5-fatia-6-finance.md §6).
--
-- >>> NÃO-PARCIAL de propósito (mesmo raciocínio de P8b e das Fatias 2/3/4): um índice
--     único PARCIAL (WHERE source_local_id IS NOT NULL) não serve de arbiter para
--     ON CONFLICT — o inference do Postgres exige um índice cuja definição bata
--     exatamente com as colunas do ON CONFLICT, sem predicado adicional. Não-parcial
--     permite ilimitadas linhas legadas com source_local_id NULL sem conflito entre si
--     (NULL nunca colide com NULL numa UNIQUE).
--
-- >>> COEXISTE, não compete, com `ux_ft_receivable_from_quote` (Etapa 3 S5) — colunas
--     diferentes (aqui: workspace_id+source_local_id; lá: quote_id sozinho, parcial),
--     predicados diferentes, nunca a mesma operação de escrita usa os dois ao mesmo
--     tempo. Ver Sec6 do doc da fatia para a árvore de decisão completa.
--
-- >>> APLICAÇÃO: CREATE INDEX CONCURRENTLY não pode rodar dentro de uma transação.
--     Aplicar em autocommit (SQL Editor do Supabase, ou psql sem BEGIN/COMMIT).
--
-- >>> PRÉ-REQUISITO: rodar a query 1 de docs/database/etapa-5-fatia-6-preaplicacao.sql
--     antes — todas as linhas devem ter source_local_id IS NULL (coluna recém-criada,
--     nenhum import rodou ainda), então não há duplicata possível nesta aplicação.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS ux_financial_transactions_source_local
  ON public.financial_transactions (workspace_id, source_local_id);
