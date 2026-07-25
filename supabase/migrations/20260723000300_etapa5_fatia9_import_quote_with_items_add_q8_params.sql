-- ============================================================================
-- Etapa 5 · Fatia 9 (quotes — fundação + cutover de leitura) — Q8: RPC
-- import_quote_with_items ganha os 6 novos parâmetros
-- ============================================================================
-- PROBLEMA que esta migration resolve: a migration 20260723000200 (mesma fatia)
-- adiciona as 6 colunas do Q8 em public.quotes, mas o RPC
-- import_quote_with_items (Q3, Fatia 3) — único caminho que escreve uma quote
-- completa hoje — não tem parâmetro nenhum para elas. Sem esta migration, o
-- mapper (quoteMapper.ts, mapLocalQuoteToSupabaseQuote) já produziria os 6
-- campos no payload, mas quotesRepository.importQuoteWithItems descartaria
-- silenciosamente porque o RPC não os aceita — o "backfill via reimport
-- idempotente" prometido no design da Fase B (§8.1 do doc da fatia) não
-- funcionaria de verdade sem este passo.
--
-- SOLUÇÃO: CREATE OR REPLACE FUNCTION com os 6 parâmetros novos ACRESCENTADOS
-- NO FIM da assinatura, todos com DEFAULT NULL — Postgres permite isso sem
-- quebrar a identidade da função (mesmo nome, mesmos parâmetros existentes,
-- na mesma ordem/tipo) e sem exigir DROP FUNCTION. Chamadas antigas (sem os 6
-- novos argumentos) continuam funcionando, usando o default NULL — não há
-- chamador desta forma hoje fora do próprio quotesRepository.ts, que é
-- atualizado no mesmo commit desta migration para sempre passar os 6.
--
-- Mesma decisão de segurança da migration original (SECURITY INVOKER, RLS do
-- chamador, SET search_path = public, pg_temp) — nada muda aqui, só os
-- parâmetros e as duas colunas extras no INSERT/UPDATE do upsert do pai.
--
-- >>> PRÉ-REQUISITO: 20260723000200 (as 6 colunas) já aplicada.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.import_quote_with_items(
  p_workspace_id uuid,
  p_source_local_id text,
  p_client_id uuid,
  p_opportunity_id uuid,
  p_client_name text,
  p_client_email text,
  p_title text,
  p_description text,
  p_subtotal numeric,
  p_discount numeric,
  p_total numeric,
  p_status text,
  p_archived boolean,
  -- Array de itens: [{ "name": "...", "quantity": 1.5, "unit_price": 10.5, "service_id": null }, ...]
  -- quantity é numeric (Q5b, 20260719001350) — aceita fração (ex.: horas).
  p_items jsonb,
  -- Etapa 5 · Fatia 9 (Q8) — 6 novos, todos opcionais (DEFAULT NULL) para não
  -- quebrar nenhum chamador existente que ainda não os envie.
  p_client_whatsapp text DEFAULT NULL,
  p_company text DEFAULT NULL,
  p_payment_condition text DEFAULT NULL,
  p_delivery_deadline text DEFAULT NULL,
  p_validity_days integer DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS public.quotes
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_quote public.quotes;
BEGIN
  -- 0) Guarda de NULL (mesma da migration original) — inalterada.
  IF p_workspace_id IS NULL OR p_source_local_id IS NULL OR p_source_local_id = '' THEN
    RAISE EXCEPTION 'import_quote_with_items: workspace_id e source_local_id são obrigatórios (arbiter da idempotência)';
  END IF;

  -- 1) Upsert do PAI. Arbiter: UNIQUE (workspace_id, source_local_id)
  --    (ux_quotes_source_local, não-parcial — precedente P8b / Fatia 2).
  --    Q8: 6 colunas novas incluídas no INSERT e no DO UPDATE SET.
  INSERT INTO public.quotes (
    workspace_id, source_local_id, client_id, opportunity_id,
    client_name, client_email, title, description,
    subtotal, discount, total, status, archived,
    client_whatsapp, company, payment_condition, delivery_deadline, validity_days, notes
  )
  VALUES (
    p_workspace_id, p_source_local_id, p_client_id, p_opportunity_id,
    p_client_name, p_client_email, p_title, p_description,
    p_subtotal, p_discount, p_total, p_status, COALESCE(p_archived, false),
    p_client_whatsapp, p_company, p_payment_condition, p_delivery_deadline, p_validity_days, p_notes
  )
  ON CONFLICT (workspace_id, source_local_id) DO UPDATE SET
    client_id = EXCLUDED.client_id,
    opportunity_id = EXCLUDED.opportunity_id,
    client_name = EXCLUDED.client_name,
    client_email = EXCLUDED.client_email,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    subtotal = EXCLUDED.subtotal,
    discount = EXCLUDED.discount,
    total = EXCLUDED.total,
    status = EXCLUDED.status,
    archived = EXCLUDED.archived,
    client_whatsapp = EXCLUDED.client_whatsapp,
    company = EXCLUDED.company,
    payment_condition = EXCLUDED.payment_condition,
    delivery_deadline = EXCLUDED.delivery_deadline,
    validity_days = EXCLUDED.validity_days,
    notes = EXCLUDED.notes
  RETURNING * INTO v_quote;

  -- 2) Reposição atômica dos FILHOS — inalterado.
  DELETE FROM public.quote_items WHERE quote_id = v_quote.id;

  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    INSERT INTO public.quote_items (quote_id, service_id, name, quantity, unit_price)
    SELECT
      v_quote.id,
      NULLIF(item->>'service_id', '')::uuid,
      item->>'name',
      (item->>'quantity')::numeric,
      (item->>'unit_price')::numeric
    FROM jsonb_array_elements(p_items) AS item;
  END IF;

  RETURN v_quote;
END;
$$;

-- Assinatura completa mudou (6 tipos a mais no fim) — REVOKE/GRANT precisam da
-- lista nova; as concessões antigas (assinatura de 14 argumentos) ficam órfãs
-- automaticamente, já que essa assinatura exata não existe mais como objeto
-- após o CREATE OR REPLACE acima (mesmo nome, identidade de argumentos mudou).
REVOKE ALL ON FUNCTION public.import_quote_with_items(
  uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, boolean, jsonb,
  text, text, text, text, integer, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.import_quote_with_items(
  uuid, text, uuid, uuid, text, text, text, text, numeric, numeric, numeric, text, boolean, jsonb,
  text, text, text, text, integer, text
) TO authenticated, service_role;

COMMENT ON FUNCTION public.import_quote_with_items IS
  'Etapa 5 · Fatia 3 (Q3) + Fatia 9 (Q8): import atômico de um orçamento + seus itens, incluindo os 6 campos de paridade de schema (client_whatsapp/company/payment_condition/delivery_deadline/validity_days/notes). SECURITY INVOKER de propósito — roda sob a RLS do chamador.';
