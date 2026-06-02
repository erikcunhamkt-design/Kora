
-- WhatsApp via uazapi: instâncias, conversas e mensagens
CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  instance_token text NOT NULL,
  instance_name text,
  subdomain text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  phone text,
  phone_name text,
  qr_code text,
  connected_at timestamptz,
  last_status_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_instances_select" ON public.whatsapp_instances
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_instances_insert" ON public.whatsapp_instances
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_instances_update" ON public.whatsapp_instances
  FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_instances_delete" ON public.whatsapp_instances
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TRIGGER trg_wa_instances_updated_at
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Conversas
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  contact_phone text NOT NULL,
  contact_name text,
  client_id uuid,
  opportunity_id uuid,
  status text NOT NULL DEFAULT 'open',
  tags text[] DEFAULT '{}',
  last_message text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instance_id, contact_phone)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_conv_select" ON public.whatsapp_conversations
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_conv_insert" ON public.whatsapp_conversations
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_conv_update" ON public.whatsapp_conversations
  FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_conv_delete" ON public.whatsapp_conversations
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE INDEX idx_wa_conv_workspace_last ON public.whatsapp_conversations (workspace_id, last_message_at DESC);

CREATE TRIGGER trg_wa_conv_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Mensagens
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  conversation_id uuid NOT NULL,
  instance_id uuid NOT NULL,
  wa_message_id text,
  direction text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_msg_select" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
CREATE POLICY "wa_msg_insert" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_msg_update" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
CREATE POLICY "wa_msg_delete" ON public.whatsapp_messages
  FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE INDEX idx_wa_msg_conv ON public.whatsapp_messages (conversation_id, created_at);
CREATE INDEX idx_wa_msg_wa_id ON public.whatsapp_messages (instance_id, wa_message_id);
