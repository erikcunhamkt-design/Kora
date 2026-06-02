
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists
DO $$
BEGIN
  PERFORM cron.unschedule('whatsapp-campaign-processor');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'whatsapp-campaign-processor',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ewamvzncsloagtcvkbxv.supabase.co/functions/v1/whatsapp-campaign-processor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3YW12em5jc2xvYWd0Y3ZrYnh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjI3MDcsImV4cCI6MjA5MTc5ODcwN30.1mbT5JdDAYJlQrzTFFHK2rp02PKQlyinZ-SF97tr9Cw'
    ),
    body := jsonb_build_object('trigger', 'cron', 'time', now())
  );
  $$
);
