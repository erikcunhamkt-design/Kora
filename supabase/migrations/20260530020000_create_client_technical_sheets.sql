-- Migration: Client Technical Sheets V1
-- Description: Creates public.client_technical_sheets table with RLS policies and automatic updated_at trigger.

CREATE TABLE IF NOT EXISTS public.client_technical_sheets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  branding JSONB DEFAULT '{}'::jsonb,
  persona JSONB DEFAULT '{}'::jsonb,
  editorial JSONB DEFAULT '{}'::jsonb,
  typography JSONB DEFAULT '{}'::jsonb,
  social_links JSONB DEFAULT '{}'::jsonb,
  briefing JSONB DEFAULT '{}'::jsonb,
  materials JSONB DEFAULT '[]'::jsonb,
  raw_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Indexes for client_technical_sheets
CREATE INDEX IF NOT EXISTS idx_client_technical_sheets_workspace ON public.client_technical_sheets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_client_technical_sheets_client ON public.client_technical_sheets(client_id);

-- Enable RLS
ALTER TABLE public.client_technical_sheets ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_technical_sheets
CREATE POLICY "Users can select technical sheets from their workspaces"
ON public.client_technical_sheets
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can insert technical sheets into their workspaces"
ON public.client_technical_sheets
FOR INSERT
TO authenticated
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can update technical sheets in their workspaces"
ON public.client_technical_sheets
FOR UPDATE
TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can delete technical sheets in their workspaces"
ON public.client_technical_sheets
FOR DELETE
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Trigger for updated_at column
CREATE TRIGGER update_client_technical_sheets_updated_at
BEFORE UPDATE ON public.client_technical_sheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
