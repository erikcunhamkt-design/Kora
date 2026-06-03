CREATE TABLE public.workspace_ai_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'vertex',
  credentials_json jsonb NOT NULL,
  location text NOT NULL DEFAULT 'us-central1',
  default_model text NOT NULL DEFAULT 'gemini-2.0-flash-001',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_ai_credentials TO authenticated;
GRANT ALL ON public.workspace_ai_credentials TO service_role;

ALTER TABLE public.workspace_ai_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their workspace AI credentials"
  ON public.workspace_ai_credentials FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert AI credentials in their workspace"
  ON public.workspace_ai_credentials FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can update AI credentials in their workspace"
  ON public.workspace_ai_credentials FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can delete AI credentials in their workspace"
  ON public.workspace_ai_credentials FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE TRIGGER trg_workspace_ai_credentials_updated_at
  BEFORE UPDATE ON public.workspace_ai_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();