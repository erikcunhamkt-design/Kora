
-- Public client signup requests
CREATE TABLE public.client_signup_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  document TEXT,
  project_interest TEXT,
  message TEXT,
  source TEXT NOT NULL DEFAULT 'public_signup',
  status TEXT NOT NULL DEFAULT 'pending',
  consent BOOLEAN NOT NULL DEFAULT false,
  converted_client_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT csr_name_len CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT csr_email_len CHECK (email IS NULL OR char_length(email) <= 255),
  CONSTRAINT csr_phone_len CHECK (phone IS NULL OR char_length(phone) <= 40),
  CONSTRAINT csr_company_len CHECK (company IS NULL OR char_length(company) <= 160),
  CONSTRAINT csr_document_len CHECK (document IS NULL OR char_length(document) <= 40),
  CONSTRAINT csr_interest_len CHECK (project_interest IS NULL OR char_length(project_interest) <= 200),
  CONSTRAINT csr_message_len CHECK (message IS NULL OR char_length(message) <= 2000),
  CONSTRAINT csr_status_valid CHECK (status IN ('pending','approved','archived','converted','lead')),
  CONSTRAINT csr_contact_required CHECK (
    (email IS NOT NULL AND char_length(email) > 0) OR
    (phone IS NOT NULL AND char_length(phone) > 0)
  ),
  CONSTRAINT csr_consent_required CHECK (consent = true)
);

CREATE INDEX idx_csr_owner_status ON public.client_signup_requests(owner_id, status, created_at DESC);

ALTER TABLE public.client_signup_requests ENABLE ROW LEVEL SECURITY;

-- Public (anon + authenticated) can insert a pending request for any owner_id.
-- We restrict to status=pending and source=public_signup; no SELECT is granted publicly.
CREATE POLICY "Public can submit signup requests"
ON public.client_signup_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  status = 'pending'
  AND source = 'public_signup'
  AND consent = true
  AND converted_client_id IS NULL
);

CREATE POLICY "Owners can view their signup requests"
ON public.client_signup_requests
FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can update their signup requests"
ON public.client_signup_requests
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their signup requests"
ON public.client_signup_requests
FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

CREATE TRIGGER trg_csr_updated_at
BEFORE UPDATE ON public.client_signup_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
