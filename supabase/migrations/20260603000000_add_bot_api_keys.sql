-- Migration to add custom API credentials to whatsapp_bot_settings
ALTER TABLE public.whatsapp_bot_settings ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'lovable';
ALTER TABLE public.whatsapp_bot_settings ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
ALTER TABLE public.whatsapp_bot_settings ADD COLUMN IF NOT EXISTS gcp_project_id TEXT;
ALTER TABLE public.whatsapp_bot_settings ADD COLUMN IF NOT EXISTS gcp_region TEXT;
ALTER TABLE public.whatsapp_bot_settings ADD COLUMN IF NOT EXISTS gcp_service_account TEXT;

-- Add comment for description
COMMENT ON COLUMN public.whatsapp_bot_settings.provider IS 'AI provider: lovable, gemini_api_key, or vertex_ai';
