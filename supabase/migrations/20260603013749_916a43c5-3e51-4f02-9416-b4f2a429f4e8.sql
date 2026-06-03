-- Fase 3: campos premium em whatsapp_messages
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reactions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_wa_msg_reply_to ON public.whatsapp_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_pinned ON public.whatsapp_messages(conversation_id, pinned_at) WHERE pinned_at IS NOT NULL;

-- Busca full-text em content (português)
CREATE INDEX IF NOT EXISTS idx_wa_msg_content_fts
  ON public.whatsapp_messages
  USING GIN (to_tsvector('portuguese', coalesce(content, '')));
