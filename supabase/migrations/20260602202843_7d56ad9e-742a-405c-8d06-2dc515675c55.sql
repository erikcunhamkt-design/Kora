CREATE INDEX IF NOT EXISTS idx_wa_recip_provider_msg
  ON public.whatsapp_campaign_recipients(workspace_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_recip_reply_lookup
  ON public.whatsapp_campaign_recipients(workspace_id, normalized_phone, sent_at DESC);