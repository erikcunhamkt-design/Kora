-- Migration to add flow_data column to whatsapp_bot_settings
ALTER TABLE public.whatsapp_bot_settings
  ADD COLUMN IF NOT EXISTS flow_data JSONB;
