-- Etapa 5 · Fatia 9 (quotes — fundação + cutover de leitura) — Q8: paridade de schema
--
-- Achado Q8 (docs/qa/etapa-5-fatia-3-quotes.md §12, DECIDIDO na Fase A da Fatia 9):
-- 6 campos do Quote local (src/hooks/useQuotes.ts) não têm coluna correspondente em
-- public.quotes. Auditoria de uso real (grep + leitura de QuotesSection.tsx,
-- docs/qa/etapa-5-fatia-9-quotes-cutover.md §2) confirma os 6 ativamente usados —
-- editáveis no wizard de criação e renderizados no "Preview do orçamento" (o
-- documento que o cliente vê) e, dois deles, também na tabela principal da lista.
-- Bloqueante para o cutover de leitura desta própria fatia — sem isso, todo
-- orçamento migrado perderia forma de pagamento, prazo, observações, WhatsApp do
-- cliente, razão social e dias de validade ao ser lido via Supabase.
--
-- Sem UNIQUE/índice novo — nenhum dos 6 campos entra em chave de idempotência. Não
-- precisa de autocommit (nenhum CREATE INDEX CONCURRENTLY envolvido) — roda dentro
-- de transação normal. Todas nullable, sem DEFAULT -> ADD COLUMN metadata-only
-- (Postgres 11+), sem rewrite de tabela mesmo com quotes tendo dados reais hoje.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS client_whatsapp text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS payment_condition text,
  ADD COLUMN IF NOT EXISTS delivery_deadline text,
  ADD COLUMN IF NOT EXISTS validity_days integer,
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.quotes.client_whatsapp IS
  'Etapa 5 · Fatia 9 (Q8): espelha Quote.clientWhatsapp local (src/hooks/useQuotes.ts). Telefone formatado livre, não normalizado.';

COMMENT ON COLUMN public.quotes.company IS
  'Etapa 5 · Fatia 9 (Q8): espelha Quote.company local. Razão social opcional, texto livre.';

COMMENT ON COLUMN public.quotes.payment_condition IS
  'Etapa 5 · Fatia 9 (Q8): espelha Quote.paymentCondition local. Rótulo livre (ex.: "À vista no Pix"), não um enum.';

COMMENT ON COLUMN public.quotes.delivery_deadline IS
  'Etapa 5 · Fatia 9 (Q8): espelha Quote.deliveryDeadline local. Rótulo livre (ex.: "15 dias"), não uma data — o parse pra data (QuoteToProjectDialog.tsx) é feito no app a partir deste texto, a coluna não antecipa esse parse.';

COMMENT ON COLUMN public.quotes.validity_days IS
  'Etapa 5 · Fatia 9 (Q8): espelha Quote.validityDays local. Inteiro de dias, usado em aritmética de data para calcular vencimento (getQuoteExpiryDate).';

COMMENT ON COLUMN public.quotes.notes IS
  'Etapa 5 · Fatia 9 (Q8): espelha Quote.notes local. Observações livres (textarea, até 600 caracteres no form local).';
