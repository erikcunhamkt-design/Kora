-- Migration: Create projects table with RLS
-- Timestamp: 2026-06-01 03:00:00

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  start_date date,
  due_date date,
  budget numeric DEFAULT 0,
  source text DEFAULT 'quote',
  is_demo boolean DEFAULT false,
  archived boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
CREATE POLICY projects_select ON public.projects
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY projects_insert ON public.projects
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY projects_update ON public.projects
  FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY projects_delete ON public.projects
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Trigger to update updated_at column
CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
