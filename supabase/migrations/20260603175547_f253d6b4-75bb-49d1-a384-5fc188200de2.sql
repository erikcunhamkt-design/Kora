-- Delete messages whose conversation is orphan (instance no longer exists)
DELETE FROM public.whatsapp_messages m
WHERE m.conversation_id IN (
  SELECT c.id FROM public.whatsapp_conversations c
  WHERE c.instance_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.whatsapp_instances i WHERE i.id = c.instance_id)
);

-- Delete orphan conversations
DELETE FROM public.whatsapp_conversations c
WHERE c.instance_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_instances i WHERE i.id = c.instance_id);

-- Delete remaining orphan messages by instance_id
DELETE FROM public.whatsapp_messages m
WHERE m.instance_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.whatsapp_instances i WHERE i.id = m.instance_id);

-- Foreign keys
ALTER TABLE public.whatsapp_conversations
  ADD CONSTRAINT whatsapp_conversations_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_instance_id_fkey
  FOREIGN KEY (instance_id) REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_conversation_id_fkey
  FOREIGN KEY (conversation_id) REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_wa_conv_instance ON public.whatsapp_conversations(instance_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_instance ON public.whatsapp_messages(instance_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_conversation ON public.whatsapp_messages(conversation_id);