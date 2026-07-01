-- Batch 3 WhatsApp campaign robustness (2026-07-01)
--
-- P4: Move anti-ban pacing out of the edge function's in-process sleep loop
--     (which ran up to ~6min per invocation and blew the wall-clock limit,
--     stranding rows in status='sending' forever) into a DB-side per-instance
--     gate + a self-healing reaper. Each invocation now claims at most one
--     due message per workspace, closes that instance's gate for a random
--     30-90s, and returns in seconds. Cron (every minute) drives cadence.
--
-- P7: Add the indexes the processor's hot paths need (per-workspace due
--     lookup, campaign counters, reaper scan, campaigns.workspace_id).
--
-- P8b: The Batch-2 partial UNIQUE index on (instance_id, wa_message_id)
--     cannot be used as a PostgREST upsert onConflict target (arbiter
--     inference can't see the partial predicate). Recreate it non-partial:
--     Postgres treats NULLs as distinct in unique indexes, so outbound rows
--     with NULL wa_message_id are still allowed without the WHERE clause.

-- ============================================================================
-- P8b: non-partial UNIQUE (instance_id, wa_message_id)
-- ============================================================================
DROP INDEX IF EXISTS public.ux_wa_messages_instance_wa_id;
CREATE UNIQUE INDEX IF NOT EXISTS ux_wa_messages_instance_wa_id
  ON public.whatsapp_messages (instance_id, wa_message_id);

-- ============================================================================
-- P4: schema support — per-instance send gate + queue lock timestamp
-- ============================================================================
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS campaign_next_send_at timestamptz;

ALTER TABLE public.whatsapp_queue
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

-- ============================================================================
-- P7: indexes
-- ============================================================================
-- One-oldest-per-workspace due lookup (DISTINCT ON workspace_id ORDER BY sched)
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_pending_ws_sched
  ON public.whatsapp_queue (workspace_id, scheduled_at)
  WHERE status = 'pending';

-- Campaign counter recomputation (.eq campaign_id .eq status) + FK cascade
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_campaign_status
  ON public.whatsapp_queue (campaign_id, status);

-- Reaper scan for stuck 'sending' rows
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_sending
  ON public.whatsapp_queue (locked_at)
  WHERE status = 'sending';

-- whatsapp_campaigns.workspace_id was entirely unindexed
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_workspace
  ON public.whatsapp_campaigns (workspace_id);

-- ============================================================================
-- P4: claim_campaign_messages
--   Atomically claims at most one due 'pending' message per workspace whose
--   instance is connected and whose gate is open, flips those rows to
--   'sending', closes each claimed instance's gate for a random delay, and
--   returns the claimed rows joined with their instance token.
--
--   Concurrency: DISTINCT ON picks the same oldest row per workspace across
--   concurrent runs; the locking UPDATE's `status='pending'` guard lets only
--   one run win each row. Data-modifying CTEs run to completion even when not
--   referenced by the final SELECT (per Postgres docs), so the gate closes.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_campaign_messages(
  p_max_workspaces int DEFAULT 8,
  p_min_delay_s int DEFAULT 30,
  p_max_delay_s int DEFAULT 90
)
RETURNS TABLE (
  id uuid,
  campaign_id uuid,
  workspace_id uuid,
  phone text,
  recipient_name text,
  variables jsonb,
  instance_id uuid,
  instance_token text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT DISTINCT ON (q.workspace_id)
      q.id           AS q_id,
      q.workspace_id AS ws_id,
      i.id           AS inst_id
    FROM public.whatsapp_queue q
    JOIN public.whatsapp_instances i ON i.workspace_id = q.workspace_id
    WHERE q.status = 'pending'
      AND q.scheduled_at <= now()
      AND i.status = 'connected'
      AND (i.campaign_next_send_at IS NULL OR i.campaign_next_send_at <= now())
    ORDER BY q.workspace_id, q.scheduled_at, q.id
    LIMIT p_max_workspaces
  ),
  locked AS (
    UPDATE public.whatsapp_queue q
    SET status = 'sending', locked_at = now()
    FROM candidates c
    WHERE q.id = c.q_id
      AND q.status = 'pending'
    RETURNING q.id AS q_id, q.campaign_id, q.workspace_id,
              q.phone, q.recipient_name, q.variables, c.inst_id
  ),
  gate AS (
    UPDATE public.whatsapp_instances i
    SET campaign_next_send_at =
          now() + make_interval(secs =>
            p_min_delay_s + floor(random() * (p_max_delay_s - p_min_delay_s + 1))::int)
    FROM locked l
    WHERE i.id = l.inst_id
    RETURNING i.id
  )
  SELECT l.q_id, l.campaign_id, l.workspace_id,
         l.phone::text, l.recipient_name::text, l.variables,
         l.inst_id, i.instance_token
  FROM locked l
  JOIN public.whatsapp_instances i ON i.id = l.inst_id;
END;
$$;

-- ============================================================================
-- P4: reap_stuck_campaign_messages
--   Returns rows stranded in 'sending' back to 'pending' so a later run
--   retries them. Heals both legacy orphans (locked_at IS NULL, from the old
--   sleep-loop design) and any future crash mid-send.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reap_stuck_campaign_messages(
  p_cutoff_s int DEFAULT 300
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
BEGIN
  UPDATE public.whatsapp_queue
  SET status = 'pending', locked_at = NULL
  WHERE status = 'sending'
    AND (locked_at IS NULL OR locked_at < now() - make_interval(secs => p_cutoff_s));
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Only the edge function (service_role) drives the queue.
REVOKE ALL ON FUNCTION public.claim_campaign_messages(int, int, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reap_stuck_campaign_messages(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_campaign_messages(int, int, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.reap_stuck_campaign_messages(int) TO service_role;
