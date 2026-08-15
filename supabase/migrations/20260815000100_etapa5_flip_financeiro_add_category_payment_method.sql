-- Etapa 5 · Financeiro Fase B (Pacote do Flip) — §1.1 do desenho
-- (docs/qa/etapa-5-flip-financeiro-pacote.md). 2 gaps de schema bloqueantes
-- (Fase A, etapa-5-flip-financeiro-fase-a.md §3): category (texto livre,
-- nunca foi enum) e payment_method (enum pequeno e fechado, vale CHECK
-- desde o dia 1 — mesmo raciocínio do G40).
--
-- PROPOSTA — NÃO aplicada pelo Code. Code não roda DDL contra produção
-- (protocolo §0/§6/§8-b) — aplicação é gate do operador. Passo do operador:
-- rodar este arquivo (via Supabase CLI/dashboard) ANTES de qualquer escrita
-- real de Fase B tentar gravar category/payment_method — sem a coluna, o
-- INSERT/UPDATE com esses campos falha.
ALTER TABLE public.financial_transactions
  ADD COLUMN category text NULL,
  ADD COLUMN payment_method text NULL,
  ADD CONSTRAINT financial_transactions_payment_method_known_chk
    CHECK (payment_method IS NULL OR payment_method IN ('pix','card','boleto','transfer','cash','other'));
