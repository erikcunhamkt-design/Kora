-- Etapa 6, item 4 do roadmap (docs/architecture/kora-roadmap.md §4) — decisão
-- registrada: opção (c) — whatsapp-campaign-v2-sender continua manual-only,
-- SEM cron novo (opção (a) rejeitada: automatizar antes de corrigir o reaper
-- industrializaria o bug G24, só trocando "preso manualmente" por "preso em
-- escala"). Esta migration resolve isoladamente o bug G24 (docs/architecture/
-- kora-hub-auditoria-e-plano.md): recipients presos em status='sending' sem
-- self-heal quando a invocação do sender morre no meio do lote.
--
-- ESCRITA E PRONTA, NÃO APLICADA por esta rodada — aplicação é sessão §8-b com
-- o operador, guiada pelo revisor, CARONA na mesma janela da migration de
-- Projetos (20260811000100_etapa5_flip_projetos_deliverables_status_check.sql,
-- não relacionada, mesma sessão por conveniência operacional).
--
-- Por que o threshold do legado (reap_stuck_campaign_messages, 300s/5min,
-- 20260701220000_batch3_campaign_robustness.sql) NÃO serve aqui: aquele valor
-- pressupõe o desenho pós-Batch-3, onde cada invocação do processor legado é
-- rápida (claim atômico + retorno em segundos, pacing fica num gate no banco).
-- O v2 sender NÃO foi re-arquitetado nesta rodada (decisão (c), não (a)) —
-- continua fazendo sleep in-process entre envios do lote
-- (whatsapp-campaign-v2-sender/index.ts:286-289). MAX_BATCH_SIZE=10 (:23) com
-- delay 30-90s entre envios (:25-26, 9 gaps num lote cheio) já soma até ~13,5
-- min de wall-clock só de pacing, fora rede/typing/DB — um threshold de 5min
-- reaptaria lotes legítimos ainda em andamento. Threshold proposto: 1200s
-- (20 min) — ~6 min de margem acima do pior caso calculado.
--
-- Cron proposto: a cada 15 min, não por minuto como o processor legado — este
-- job não é o loop de envio (o v2 continua manual), é rede de segurança pura;
-- a maioria das execuções não encontra nenhuma linha presa. Padrão de
-- agendamento idêntico ao já em produção (unschedule tolerante + schedule
-- inline, ai-rate-limit-cleanup / whatsapp-campaign-processor).

-- ============================================================================
-- reap_stuck_campaign_v2_recipients
--   Devolve pra 'queued' recipients presos em 'sending' há mais que o
--   threshold — mesmo papel do reap_stuck_campaign_messages (G4 original,
--   legado), adaptado pro schema v2 (whatsapp_campaign_recipients). Não usa
--   uma coluna locked_at dedicada (o legado tem; o v2 não) — usa updated_at,
--   já mantida por trigger em toda escrita da tabela, inclusive o UPDATE de
--   lock 'queued'->'sending' que o sender faz (index.ts:198-204).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reap_stuck_campaign_v2_recipients(
  p_cutoff_s int DEFAULT 1200
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.whatsapp_campaign_recipients
  SET status = 'queued'
  WHERE status = 'sending'
    AND updated_at < now() - make_interval(secs => p_cutoff_s);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION public.reap_stuck_campaign_v2_recipients IS
  'G24 fix: libera recipients presos em sending (timeout/crash do sender v2 no meio do lote) de volta pra queued, pra um próximo "Processar próximo lote" manual conseguir retomá-los. Threshold default 1200s — ver comentário desta migration pra justificativa (batches legítimos chegam a ~13,5min de wall-clock).';

-- REVOKE explícito de anon/authenticated (lição da emenda G5/rate limit,
-- docs/qa/etapa-6-g5-rate-limit.md, aplicada em
-- 20260802010000_g5_ai_rate_limit.sql): funções novas recebem EXECUTE por
-- default privilege pra esses dois roles DIRETO, não herdado de PUBLIC —
-- "REVOKE ... FROM PUBLIC" sozinho não remove isso. Sem esta linha, a RPC
-- ficaria chamável via PostgREST por qualquer usuário autenticado (ou anon),
-- de qualquer workspace, permitindo destravar recipients de campanhas alheias
-- fora de hora (mesma classe de risco que o G5 já fechou pra
-- check_and_increment_ai_rate_limit).
REVOKE ALL ON FUNCTION public.reap_stuck_campaign_v2_recipients(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reap_stuck_campaign_v2_recipients(int) TO service_role;

-- ============================================================================
-- cron.schedule — padrão já em produção (unschedule tolerante + schedule
-- inline). Diferente do processor legado, não precisa de net.http_post/edge
-- function: o reaper é só uma UPDATE, e pg_cron já roda como um role que pode
-- chamar a SECURITY DEFINER function diretamente por SQL.
-- ============================================================================
DO $$
BEGIN
  PERFORM cron.unschedule('whatsapp-campaign-v2-reaper');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'whatsapp-campaign-v2-reaper',
  '*/15 * * * *',
  $$
  SELECT public.reap_stuck_campaign_v2_recipients();
  $$
);
