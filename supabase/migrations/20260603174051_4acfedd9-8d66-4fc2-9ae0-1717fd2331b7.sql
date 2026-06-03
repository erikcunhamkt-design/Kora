-- Helpers for role-scoped workspace access without recursive RLS issues
CREATE OR REPLACE FUNCTION public.is_workspace_admin(w_id uuid)
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
      AND wm.role IN ('owner', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.workspace_id_from_realtime_topic(topic text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN topic ~ '^workspace:[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}:'
      THEN split_part(topic, ':', 2)::uuid
    ELSE NULL::uuid
  END;
$$;

REVOKE EXECUTE ON FUNCTION public.workspace_id_from_realtime_topic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_id_from_realtime_topic(text) TO authenticated, service_role;

-- Workspace creation must be explicit and owner-scoped
DROP POLICY IF EXISTS "Users can create owned workspaces" ON public.workspaces;
CREATE POLICY "Users can create owned workspaces"
ON public.workspaces
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Workspace membership changes are restricted to existing owners/admins
DROP POLICY IF EXISTS "Workspace admins can add members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Workspace admins can remove members" ON public.workspace_members;

CREATE POLICY "Workspace admins can add members"
ON public.workspace_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_admin(workspace_id)
  AND role IN ('admin', 'member', 'viewer')
);

CREATE POLICY "Workspace admins can update members"
ON public.workspace_members
FOR UPDATE
TO authenticated
USING (
  public.is_workspace_admin(workspace_id)
  AND role <> 'owner'
)
WITH CHECK (
  public.is_workspace_admin(workspace_id)
  AND role IN ('admin', 'member', 'viewer')
);

CREATE POLICY "Workspace admins can remove members"
ON public.workspace_members
FOR DELETE
TO authenticated
USING (
  public.is_workspace_admin(workspace_id)
  AND user_id <> auth.uid()
  AND role <> 'owner'
);

-- Keep WhatsApp instance tokens server-side only
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
  updated_at
) ON public.whatsapp_instances TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

-- The client does not need realtime updates for instance rows; dropping avoids token broadcast.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_instances'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.whatsapp_instances;
  END IF;
END $$;

-- Store non-secret display metadata separately so the raw credential JSON never needs to be selected by the client
ALTER TABLE public.workspace_ai_credentials
  ADD COLUMN IF NOT EXISTS credentials_project_id text,
  ADD COLUMN IF NOT EXISTS credentials_client_email text;

UPDATE public.workspace_ai_credentials
SET
  credentials_project_id = COALESCE(credentials_project_id, credentials_json->>'project_id'),
  credentials_client_email = COALESCE(credentials_client_email, credentials_json->>'client_email')
WHERE credentials_json IS NOT NULL;

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
GRANT ALL ON public.workspace_ai_credentials TO service_role;

DROP POLICY IF EXISTS "Members can view their workspace AI credentials" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Members can insert AI credentials in their workspace" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Members can update AI credentials in their workspace" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Members can delete AI credentials in their workspace" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Workspace admins can view AI credential status" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Workspace admins can insert AI credentials" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Workspace admins can update AI credentials" ON public.workspace_ai_credentials;
DROP POLICY IF EXISTS "Workspace admins can delete AI credentials" ON public.workspace_ai_credentials;

CREATE POLICY "Workspace admins can view AI credential status"
ON public.workspace_ai_credentials
FOR SELECT
TO authenticated
USING (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can insert AI credentials"
ON public.workspace_ai_credentials
FOR INSERT
TO authenticated
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can update AI credentials"
ON public.workspace_ai_credentials
FOR UPDATE
TO authenticated
USING (public.is_workspace_admin(workspace_id))
WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "Workspace admins can delete AI credentials"
ON public.workspace_ai_credentials
FOR DELETE
TO authenticated
USING (public.is_workspace_admin(workspace_id));

-- Realtime private-channel authorization. Channel topics must start with workspace:<workspace_id>:
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