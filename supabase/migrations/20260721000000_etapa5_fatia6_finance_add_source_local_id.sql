-- Etapa 5 · Fatia 6 (finance) — F1 (1/2): coluna source_local_id
--
-- financial_transactions não tem chave natural para o caso GERAL de import (manual/
-- expense/service/sale/recurring). O backstop de idempotência para esses casos é
-- `source_local_id`, mesmo padrão das Fatias 2/3/4 (opportunities/quotes/clients):
-- `${installId}:${localId}` (namespacado por perfil de navegador, src/lib/installId.ts).
--
-- IMPORTANTE — este arbiter NÃO substitui nem compete com `ux_ft_receivable_from_quote`
-- (índice parcial já existente, Etapa 3 S5). Os dois coexistem: este cobre idempotência
-- geral do import; aquele cobre a regra de negócio "1 recebível vivo por orçamento",
-- que se aplica só ao subconjunto source='quote' AND type='receivable'. Ver
-- docs/qa/etapa-5-fatia-6-finance.md §6 para a regra de decisão completa de qual
-- caminho de escrita usar por linha.
--
-- O índice único vai em arquivo SEPARADO (…_unique_source_local_id.sql) por causa do
-- CREATE INDEX CONCURRENTLY (não roda dentro de transação).

ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS source_local_id text;

COMMENT ON COLUMN public.financial_transactions.source_local_id IS
  'Etapa 5 · Fatia 6 (F1): chave de idempotência do import local->Supabase, formato "<installId>:<localId>" (src/lib/installId.ts). Arbiter de ux_financial_transactions_source_local (workspace_id, source_local_id). NULL para linhas não vindas de import geral (legado, ou criadas nativamente na nuvem via CreateReceivableDialog/Etapa 3 — essas continuam arbitradas por ux_ft_receivable_from_quote quando aplicável).';
