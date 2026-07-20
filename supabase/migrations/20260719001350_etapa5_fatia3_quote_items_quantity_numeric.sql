-- ============================================================================
-- Etapa 5 · Fatia 3 (quotes) — Q5b: quote_items.quantity integer -> numeric
-- ============================================================================
-- DECISÃO (2026-07-19): PROMOVER. O grep de quantidade fracionária em
-- orbyt.quotes.v1 (3 quotes reais, 5 itens verificados) voltou 0 fracionários
-- hoje — esta migration NÃO é motivada por dado real perdido, é uma DECISÃO DE
-- PRODUTO: alargar o schema agora (custo zero, tabela vazia) evita reabrir esta
-- discussão quando cobrança por hora fracionária (ex.: "1,5h") aparecer no
-- futuro. Substitui o plano B do Q5 (coerceQuantity arredondava a inteiro +
-- reportava) por preservação real da fração, quantizada a 3 casas
-- (src/services/quotes/quoteMoney.ts, roundQuantity).
--
-- Histórico: nasceu como candidata opcional em
-- docs/database/etapa-5-fatia-3-candidata-quantity-numeric.sql (removida —
-- promovida aqui). Decisão + grep completo em
-- docs/qa/etapa-5-fatia-3-quotes.md, seção Q5b.
--
-- POSIÇÃO NA SEQUÊNCIA (entre Q2 e Q3): quote_items é uma tabela diferente de
-- quotes — esta migration NÃO depende de nenhuma das colunas/índices de Q1
-- (20260719001000/1100) nem de Q2 (20260719001200/1300), então não precisa vir
-- antes delas. Ela PRECISA vir antes de Q3 (20260719001400, RPC
-- import_quote_with_items), cujo cast de quantity passa a ser `::numeric`.
-- Inserir nesta posição mantém a cadeia de dependência linear e legível:
-- Q1 (2 arquivos) -> Q2 (2 arquivos) -> Q5b (este) -> Q3 (RPC, usa tudo acima).
--
-- SEGURANÇA: ALTER COLUMN TYPE sempre bloqueia com ACCESS EXCLUSIVE e reescreve
-- a tabela inteira (não existe variante CONCURRENTLY para isso no Postgres, ao
-- contrário de CREATE INDEX). Seguro aqui porque quote_items está VAZIA em
-- produção (0 linhas, medido em 2026-07-19) — o rewrite é instantâneo. NÃO
-- seria seguro aplicar do mesmo jeito numa tabela populada em produção.
-- Transacional (ALTER simples — CONCURRENTLY não se aplica a este tipo de ALTER).
-- ============================================================================

ALTER TABLE public.quote_items
  ALTER COLUMN quantity TYPE numeric USING quantity::numeric;

COMMENT ON COLUMN public.quote_items.quantity IS
  'Etapa 5 · Fatia 3 (Q5b): numeric (promovido de integer em 2026-07-19) — preserva quantidade fracionária (ex.: horas). Decisão de produto, não motivada por dado real perdido (grep = 0 fracionários em 5 itens). Ver docs/qa/etapa-5-fatia-3-quotes.md seção Q5b.';
