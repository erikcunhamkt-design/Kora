-- Batch 4a workspace localization (2026-07-02)
--
-- Adds market/locale settings to workspaces so the app can render money, dates
-- and numbers per market instead of assuming Brazil. The frontend format layer
-- (src/lib/format) reads these; until a workspace changes them the defaults
-- preserve today's pt-BR / BRL behavior exactly.
--
-- workspaces already carries table-level GRANTs (SELECT/INSERT/UPDATE/DELETE to
-- authenticated, ALL to service_role), so new columns inherit access — no extra
-- GRANT needed. RLS policies are row-scoped and unaffected by new columns.

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS locale   text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS timezone text;

-- Light validation: ISO 4217 is 3 uppercase letters; locale is a non-empty
-- BCP-47 tag. timezone stays free-form (IANA) and nullable (null = client local).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_currency_iso4217_chk'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_currency_iso4217_chk CHECK (currency ~ '^[A-Z]{3}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspaces_locale_nonempty_chk'
  ) THEN
    ALTER TABLE public.workspaces
      ADD CONSTRAINT workspaces_locale_nonempty_chk CHECK (char_length(locale) BETWEEN 2 AND 10);
  END IF;
END $$;

COMMENT ON COLUMN public.workspaces.currency IS 'ISO 4217 currency code for money formatting (e.g. BRL, USD, EUR).';
COMMENT ON COLUMN public.workspaces.locale   IS 'BCP-47 locale for number/date formatting (e.g. pt-BR, en-US).';
COMMENT ON COLUMN public.workspaces.timezone IS 'IANA time zone for date display; NULL = client/browser local.';
