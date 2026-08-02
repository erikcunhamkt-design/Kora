-- G5 Parte 2 — rate limit por workspace para whatsapp-bot-reply (chamadas de IA)
-- + fix do DEFAULT morto da coluna provider (G18 fechou, "lovable" não tem mais secret).
--
-- ESCRITA E PRONTA, NÃO APLICADA por esta rodada — aplicação é sessão §8-b com o
-- operador, guiada pelo revisor, após revisão deste texto.
--
-- Ver docs/qa/etapa-6-g5-rate-limit.md §10/§11 para o desenho completo (chave do
-- contador, política de limite, decisão de fail-open no erro do RPC).

-- ============================================================================
-- 1. Fix do DEFAULT morto (G18): coluna aponta pra um provider sem secret desde
--    a remoção de LOVABLE_API_KEY — não é mais "não recomendado", é morto de fato.
-- ============================================================================
ALTER TABLE public.whatsapp_bot_settings
  ALTER COLUMN provider SET DEFAULT 'gemini_api_key';

-- ============================================================================
-- 2. Tabela de contador — janela fixa, chave (workspace_id, bucket, window_start).
--    bucket separa 'webhook' (tráfego real) de 'isTest' (simulador) porque os
--    dois têm padrões de uso legítimo muito diferentes — ver §11.1 do doc.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_rate_limit_counters (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (workspace_id, bucket, window_start)
);

COMMENT ON TABLE public.ai_rate_limit_counters IS
  'G5: contador de chamadas de IA por workspace/bucket/janela de 1 min, usado por check_and_increment_ai_rate_limit. Sem limpeza automática nesta rodada — ver §10.2 do doc (job pg_cron de limpeza recomendado, não bloqueante).';

-- Só o service_role escreve/lê aqui (a function chama via adminClient, nunca o
-- frontend) — mesma política de acesso das outras tabelas internas de worker
-- (ex.: whatsapp_queue). RLS habilitada por padrão de segurança do projeto,
-- mas sem policy pra 'authenticated' — só service_role (que ignora RLS) acessa.
ALTER TABLE public.ai_rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. RPC — upsert atômico (INSERT ... ON CONFLICT ... RETURNING é uma operação
--    atômica única no Postgres, sem race condition sob concorrência — mesma
--    garantia do padrão claim_campaign_messages do G4, adaptado de "reivindicar
--    linha" pra "incrementar contador").
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_and_increment_ai_rate_limit(
  p_workspace_id uuid,
  p_bucket text,
  p_max int,
  p_window_s int DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);
  v_count int;
BEGIN
  INSERT INTO public.ai_rate_limit_counters (workspace_id, bucket, window_start, count)
  VALUES (p_workspace_id, p_bucket, v_window_start, 1)
  ON CONFLICT (workspace_id, bucket, window_start)
  DO UPDATE SET count = public.ai_rate_limit_counters.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

COMMENT ON FUNCTION public.check_and_increment_ai_rate_limit IS
  'G5: incrementa o contador da janela corrente e retorna se ainda está dentro do limite (true) ou estourou (false). Chamado pela whatsapp-bot-reply antes de qualquer trabalho pesado por-request. Fail-open no chamador se a RPC em si falhar (função ausente, erro transitório) — ver §11.2 do doc.';

-- Só a Edge Function (via service_role) chama isto — mesmo padrão de
-- claim_campaign_messages/reap_stuck_campaign_messages (G4).
REVOKE ALL ON FUNCTION public.check_and_increment_ai_rate_limit(uuid, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_rate_limit(uuid, text, int, int) TO service_role;
