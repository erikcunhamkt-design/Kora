-- WhatsApp Campaign Sender V1 — logs table

CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  campaign_id uuid NOT NULL,
  recipient_id uuid,
  phone text,
  event text NOT NULL,
  message text,
  provider_message_id text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_camp_logs_workspace ON public.whatsapp_campaign_send_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wa_camp_logs_campaign ON public.whatsapp_campaign_send_logs(campaign_id, created_at DESC);

GRANT SELECT, INSERT ON public.whatsapp_campaign_send_logs TO authenticated;
GRANT ALL ON public.whatsapp_campaign_send_logs TO service_role;

ALTER TABLE public.whatsapp_campaign_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY wa_camplog_select ON public.whatsapp_campaign_send_logs
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

CREATE POLICY wa_camplog_insert ON public.whatsapp_campaign_send_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_workspace_member(workspace_id));