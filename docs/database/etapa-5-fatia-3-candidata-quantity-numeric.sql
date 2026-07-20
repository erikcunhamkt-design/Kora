-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — CANDIDATA OPCIONAL: quote_items.quantity -> numeric
-- ============================================================================
-- >>> NÃO É UMA MIGRATION APROVADA. NÃO está em supabase/migrations/ de propósito
--     (para não ser pega por engano por nenhuma automação/push). Este arquivo só
--     é promovido a supabase/migrations/ SE o veredito abaixo mandar aplicar.
--
-- O QUE É: hoje `quote_items.quantity` é `integer NOT NULL`
--   (20260531030000_create_quotes_schema.sql:30). A camada Q5 (B.1,
--   quoteMoney.ts / coerceQuantity) trata quantidade fracionária local
--   ARREDONDANDO para inteiro na entrada + REPORTANDO a divergência no card de
--   import — o dado nunca é perdido silenciosamente, mas a fração é achatada.
--
-- A ALTERNATIVA que esta migration candidata representa: alargar o schema para
-- `numeric`, preservando a fração sem precisar arredondar em nenhuma camada.
-- É a correção "de raiz" (schema) em vez da correção "de borda" (coerce+report)
-- que já está em produção de código (B.1).
--
-- >>> POR QUE NÃO FOI ESCRITA COMO DECISÃO JÁ TOMADA: não sabemos ainda se o
--     dado REAL do operador (3 quotes reais em orbyt.quotes.v1) tem algum item
--     com quantidade fracionária. Se NUNCA acontece na prática, alargar o schema
--     é complexidade sem benefício (YAGNI) — o coerce+report do Q5 já é
--     suficiente e mais simples. Se ACONTECE (ex.: cobrança por hora fracionária
--     tipo "1,5h"), o achatamento do Q5 é uma perda de precisão real e esta
--     migration deveria ser promovida.
--
-- VEREDITO: ver docs/qa/etapa-5-fatia-3-quotes.md, seção "Q5b — decisão
-- pendente: quantity numeric" — preenchido depois que o operador rodar o grep
-- de quantidade fracionária no console (orbyt.quotes.v1) e reportar o resultado.
-- Nada se aplica antes desse veredito.
--
-- SE O VEREDITO FOR "APLICAR", este arquivo (movido para supabase/migrations/
-- com timestamp adequado) NÃO é suficiente sozinho — precisa também de:
--   1. RPC import_quote_with_items (20260719001400): trocar o cast
--      `(item->>'quantity')::integer` por `(item->>'quantity')::numeric` na
--      linha do INSERT dos itens.
--   2. quoteMapper.ts (mapLocalQuoteItemToSupabaseItem): trocar
--      `coerceQuantity(item.quantity)` por `roundMoney(item.quantity)` (ou
--      remover o arredondamento, se a intenção for preservar mais casas).
--   3. Repository SupabaseQuoteItem.quantity já é `number` no TS — sem mudança
--      de tipo necessária no client.
-- Esses três ajustes NÃO estão feitos aqui — ficam para quando/se o veredito
-- for "aplicar" (fora do escopo desta migration candidata, que é só o schema).
-- ============================================================================

ALTER TABLE public.quote_items
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

COMMENT ON COLUMN public.quote_items.quantity IS
  'Etapa 5 · Fatia 3 (Q5b, candidata): alargado de integer para numeric para preservar quantidade fracionária (ex.: horas). Ver docs/qa/etapa-5-fatia-3-quotes.md secao Q5b para o veredito que motivou esta mudanca.';
