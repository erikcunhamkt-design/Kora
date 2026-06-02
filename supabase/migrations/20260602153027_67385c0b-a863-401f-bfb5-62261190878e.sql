-- Migration: WhatsApp Inbox V2 - Multi-atendimento, Disparos e Chatbot Gemini

-- 1. Alterações em tabelas existentes
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Tabela de Configurações do Chatbot com Gemini
CREATE TABLE IF NOT EXISTS public.whatsapp_bot_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    is_active BOOLEAN DEFAULT false,
    system_instruction TEXT DEFAULT 'Você é o assistente virtual do KORA Hub. Seja prestativo, educado e conciso.',
    model_name VARCHAR(100) DEFAULT 'gemini-1.5-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_bot_settings TO authenticated;
GRANT ALL ON public.whatsapp_bot_settings TO service_role;

ALTER TABLE public.whatsapp_bot_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view bot settings" ON public.whatsapp_bot_settings;
CREATE POLICY "Workspace members can view bot settings" 
    ON public.whatsapp_bot_settings FOR SELECT 
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can modify bot settings" ON public.whatsapp_bot_settings;
CREATE POLICY "Workspace members can modify bot settings" 
    ON public.whatsapp_bot_settings FOR ALL 
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 3. Tabela de Campanhas de Disparo em Massa
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft' NOT NULL,
    total_contacts INTEGER DEFAULT 0 NOT NULL,
    sent_contacts INTEGER DEFAULT 0 NOT NULL,
    failed_contacts INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_campaigns TO authenticated;
GRANT ALL ON public.whatsapp_campaigns TO service_role;

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Workspace members can view campaigns" 
    ON public.whatsapp_campaigns FOR SELECT 
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Workspace members can manage campaigns" 
    ON public.whatsapp_campaigns FOR ALL 
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- 4. Tabela de Fila de Envio (Queue) para campanhas
CREATE TABLE IF NOT EXISTS public.whatsapp_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL,
    phone VARCHAR(30) NOT NULL,
    recipient_name VARCHAR(255),
    variables JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending' NOT NULL,
    error_message TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_status_scheduled ON public.whatsapp_queue(status, scheduled_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_queue TO authenticated;
GRANT ALL ON public.whatsapp_queue TO service_role;

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view queue" ON public.whatsapp_queue;
CREATE POLICY "Workspace members can view queue" 
    ON public.whatsapp_queue FOR SELECT 
    USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "Workspace members can manage queue" ON public.whatsapp_queue;
CREATE POLICY "Workspace members can manage queue" 
    ON public.whatsapp_queue FOR ALL 
    USING (public.is_workspace_member(workspace_id))
    WITH CHECK (public.is_workspace_member(workspace_id));

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_whatsapp_bot_settings_updated_at ON public.whatsapp_bot_settings;
CREATE TRIGGER update_whatsapp_bot_settings_updated_at
BEFORE UPDATE ON public.whatsapp_bot_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();