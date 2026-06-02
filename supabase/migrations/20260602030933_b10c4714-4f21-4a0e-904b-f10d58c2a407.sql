-- Migration: Create whatsapp_message_media and expand whatsapp_messages

ALTER TABLE public.whatsapp_messages 
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS timestamp timestamptz,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.whatsapp_message_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  media_id text,
  mime_type text,
  file_name text,
  file_size integer,
  sha256 text,
  storage_path text,
  temporary_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz DEFAULT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_media TO authenticated;
GRANT ALL ON public.whatsapp_message_media TO service_role;

ALTER TABLE public.whatsapp_message_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_media_select" ON public.whatsapp_message_media
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_media_insert" ON public.whatsapp_message_media
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_media_update" ON public.whatsapp_message_media
  FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_media_delete" ON public.whatsapp_message_media
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));