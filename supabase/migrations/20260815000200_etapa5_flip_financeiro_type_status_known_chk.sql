-- Etapa 5 · Financeiro Fase B (Pacote do Flip) — §2.1 do desenho
-- (docs/qa/etapa-5-flip-financeiro-pacote.md). CHECK PREVENTIVO — diferente
-- de O12 (projects)/G40 (tasks), aqui o CHECK entra ANTES de qualquer
-- escrita divergente existir: todo escritor até hoje
-- (createReceivableFromQuote, mapLocalTransactionToSupabase via CLOUD_TYPE,
-- importTransaction) já usa exatamente os 4 valores de TxStatus e os 2 de
-- CLOUD_TYPE — não há shim de tradução a escrever, só a proteção contra um
-- futuro caminho de escrita introduzir um valor fora do contrato.
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b). Passo do operador ANTES de aplicar: confirmar que
-- não há linha em public.financial_transactions com type/status fora do
-- vocabulário abaixo (expectativa é ZERO — confirmar, não supor):
--   SELECT DISTINCT type FROM public.financial_transactions WHERE type NOT IN ('receivable','payable');
--   SELECT DISTINCT status FROM public.financial_transactions WHERE status NOT IN ('pending','paid','overdue','canceled');
-- Se qualquer uma das 2 queries devolver linha, PARAR — não aplicar este
-- CHECK sem decidir o que fazer com o dado fora do vocabulário primeiro.
ALTER TABLE public.financial_transactions
  ADD CONSTRAINT financial_transactions_type_known_chk
    CHECK (type IN ('receivable', 'payable')),
  ADD CONSTRAINT financial_transactions_status_known_chk
    CHECK (status IN ('pending', 'paid', 'overdue', 'canceled'));
