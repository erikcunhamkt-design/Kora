-- Batch 1 security hardening (2026-07-01)
--
-- Restores column-level SELECT protections regressed by 20260615215705
-- (blanket GRANT loop), applies same protection to Meta credentials added
-- in 20260615173900, and re-enables realtime RLS disabled by 20260603174157.
--
-- Safe to re-run: uses IF EXISTS / IF NOT EXISTS where possible; REVOKE +
-- column GRANT is idempotent.

-- ============================================================================
-- S1: whatsapp_instances -- hide instance_token from authenticated
-- ============================================================================
REVOKE SELECT ON public.whatsapp_instances FROM authenticated;
GRANT SELECT (
  id,
  workspace_id,
  status,
  phone,
  phone_name,
  qr_code,
  connected_at,
  last_status_at,
  instance_name,
  subdomain,
  created_by,
  created_at,
  updated_at,
  provider
) ON public.whatsapp_instances TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;

-- ============================================================================
-- S1: workspace_ai_credentials -- hide credentials_json from authenticated
-- ============================================================================
REVOKE SELECT ON public.workspace_ai_credentials FROM authenticated;
GRANT SELECT (
  id,
  workspace_id,
  provider,
  location,
  default_model,
  is_active,
  credentials_project_id,
  credentials_client_email,
  created_at,
  updated_at
) ON public.workspace_ai_credentials TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workspace_ai_credentials TO authenticated;

-- ============================================================================
-- S2: whatsapp_official_credentials -- hide access_token, verify_token, app_secret
--     RLS policy still lets members SEE the row exists; column GRANT hides secrets.
-- ============================================================================
REVOKE SELECT ON public.whatsapp_official_credentials FROM authenticated;
GRANT SELECT (
  id,
  workspace_id,
  phone_number_id,
  waba_id,
  display_phone_number,
  verified_name,
  status,
  last_verified_at,
  created_at,
  updated_at
) ON public.whatsapp_official_credentials TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.whatsapp_official_credentials TO authenticated;

-- ============================================================================
-- S3: realtime.messages -- re-enable RLS + restore workspace-scoped policies
--     (disabled by 20260603174157, silently regressing 20260603174051)
-- ============================================================================
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can receive workspace realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Workspace members can send workspace realtime" ON realtime.messages;

CREATE POLICY "Workspace members can receive workspace realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  public.workspace_id_from_realtime_topic(realtime.topic()) IS NOT NULL
  AND public.is_workspace_member(public.workspace_id_from_realtime_topic(realtime.topic()))
);

CREATE POLICY "Workspace members can send workspace realtime"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.workspace_id_from_realtime_topic(realtime.topic()) IS NOT NULL
  AND public.is_workspace_member(public.workspace_id_from_realtime_topic(realtime.topic()))
);
