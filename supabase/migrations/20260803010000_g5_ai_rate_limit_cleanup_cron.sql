-- G5 Parte 2 — job pg_cron de limpeza de ai_rate_limit_counters.
-- Recomendação não-bloqueante registrada em docs/qa/etapa-6-g5-rate-limit.md §10.2 (a tabela
-- cresce 1 linha por workspace/bucket/janela de 1 min, sem limpeza cresce pra sempre).
--
-- ESCRITA E PRONTA, NÃO APLICADA por esta rodada — aplicação é sessão §8-b com o operador,
-- guiada pelo revisor, após revisão deste texto. Ver docs/qa/etapa-6-g5-rate-limit.md §13
-- para o desenho completo (retenção, frequência, decisão inline-vs-função, kit de verificação).
--
-- Padrão seguido do job pg_cron já em produção (whatsapp-campaign-processor,
-- 20260602161206_abe508c3-758d-49be-a9a8-d1e136a29c87.sql): DELETE inline no cron.schedule
-- (não uma função dedicada — não é uma RPC exposta via PostgREST, então não há superfície de
-- GRANT/REVOKE pra fechar; a única identidade que executa isto é o dono do job de cron).
-- Re-agendamento idempotente via unschedule-then-schedule, mesma forma do precedente.

DO $$
BEGIN
  PERFORM cron.unschedule('ai-rate-limit-cleanup');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'ai-rate-limit-cleanup',
  '0 * * * *',
  $$
  DELETE FROM public.ai_rate_limit_counters WHERE window_start < now() - interval '24 hours';
  $$
);
