ALTER TABLE public.whatsapp_bot_settings
  ADD COLUMN IF NOT EXISTS respond_all boolean NOT NULL DEFAULT false;