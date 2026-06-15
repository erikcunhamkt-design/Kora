
-- Provider column on existing whatsapp_instances
ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'uazapi'
    CHECK (provider IN ('uazapi','official'));

-- Credentials table for Meta WhatsApp Cloud API
CREATE TABLE public.whatsapp_official_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  display_phone_number TEXT,
  verified_name TEXT,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  app_secret TEXT,
  status TEXT NOT NULL DEFAULT 'configured'
    CHECK (status IN ('not_configured','configured','verified')),
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id),
  UNIQUE (phone_number_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_official_credentials TO authenticated;
GRANT ALL ON public.whatsapp_official_credentials TO service_role;

ALTER TABLE public.whatsapp_official_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_official_select_members"
  ON public.whatsapp_official_credentials
  FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "wa_official_insert_admins"
  ON public.whatsapp_official_credentials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "wa_official_update_admins"
  ON public.whatsapp_official_credentials
  FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

CREATE POLICY "wa_official_delete_admins"
  ON public.whatsapp_official_credentials
  FOR DELETE TO authenticated
  USING (public.is_workspace_admin(workspace_id));

CREATE TRIGGER trg_wa_official_updated_at
  BEFORE UPDATE ON public.whatsapp_official_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wa_official_workspace ON public.whatsapp_official_credentials(workspace_id);
CREATE INDEX idx_wa_official_phone_number_id ON public.whatsapp_official_credentials(phone_number_id);
