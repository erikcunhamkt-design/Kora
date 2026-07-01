-- Batch 2 performance hardening (2026-07-01)
--
-- P2: Add workspace_id / FK / hot-column indexes across the 5 core tables
--     that currently rely on sequential scans for every list/filter.
-- P3: Convert public.is_workspace_member to SQL STABLE (parity with
--     is_workspace_admin) so the planner can cache RLS calls per statement
--     instead of re-executing for every row.
-- P8: Add UNIQUE (instance_id, wa_message_id) on whatsapp_messages so
--     retried webhook deliveries deduplicate at the DB level. Includes a
--     one-shot cleanup of pre-existing duplicates.
--
-- All CREATE INDEX statements are IF NOT EXISTS and use predicate filters
-- to keep index size small (only live rows). Kept out of CONCURRENTLY so
-- the migration remains transactional — safe at current row counts.

-- ============================================================================
-- P3: is_workspace_member -> SQL, STABLE, SECURITY DEFINER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_workspace_member(w_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = w_id
      AND wm.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated, service_role;

-- ============================================================================
-- P2: projects
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_projects_workspace_live
  ON public.projects (workspace_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_client
  ON public.projects (client_id)
  WHERE client_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_projects_quote
  ON public.projects (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_opportunity
  ON public.projects (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- ============================================================================
-- P2: tasks
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_live
  ON public.tasks (workspace_id, updated_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_order
  ON public.tasks (project_id, sort_order)
  WHERE project_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_client
  ON public.tasks (client_id)
  WHERE client_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_quote
  ON public.tasks (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_opportunity
  ON public.tasks (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_workspace_status
  ON public.tasks (workspace_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- P2: financial_transactions
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_ft_workspace_due
  ON public.financial_transactions (workspace_id, due_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ft_workspace_status
  ON public.financial_transactions (workspace_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ft_client
  ON public.financial_transactions (client_id)
  WHERE client_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ft_quote
  ON public.financial_transactions (quote_id)
  WHERE quote_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ft_opportunity
  ON public.financial_transactions (opportunity_id)
  WHERE opportunity_id IS NOT NULL;

-- ============================================================================
-- P2: quotes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_quotes_workspace_created
  ON public.quotes (workspace_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_quotes_workspace_status
  ON public.quotes (workspace_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- P2: quote_items — FKs are NOT auto-indexed in PostgreSQL, and every
--                   quote_items RLS check does (SELECT workspace_id FROM
--                   quotes WHERE id = quote_id). Without this index that
--                   FK-lookup + policy join sequential-scans quote_items.
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_quote_items_quote
  ON public.quote_items (quote_id);

-- ============================================================================
-- P8: whatsapp_messages dedup on (instance_id, wa_message_id)
--     Meta and uazapi both re-deliver webhooks; two identical inserts
--     currently create two rows. Enforce dedup at the DB with a partial
--     UNIQUE index (NULL wa_message_id is allowed — outbound drafts).
-- ============================================================================

-- 1) One-shot cleanup: keep smallest ctid (physically-oldest row) per
--    (instance_id, wa_message_id) pair, delete the rest.
DELETE FROM public.whatsapp_messages a
USING public.whatsapp_messages b
WHERE a.ctid > b.ctid
  AND a.instance_id = b.instance_id
  AND a.wa_message_id = b.wa_message_id
  AND a.wa_message_id IS NOT NULL;

-- 2) Drop the old non-unique lookup index — replaced by the UNIQUE below
--    which also serves the same (instance_id, wa_message_id) lookup path.
DROP INDEX IF EXISTS public.idx_wa_msg_wa_id;

-- 3) Enforce dedup.
CREATE UNIQUE INDEX IF NOT EXISTS ux_wa_messages_instance_wa_id
  ON public.whatsapp_messages (instance_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;
