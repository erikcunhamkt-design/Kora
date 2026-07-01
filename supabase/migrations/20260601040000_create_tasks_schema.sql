-- Migration: Create tasks schema
-- Description: Creates public.tasks table with workspace RLS

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date DATE,
  source TEXT NOT NULL DEFAULT 'project_template',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Select policy
CREATE POLICY "Users can select tasks in their workspaces"
ON public.tasks
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Insert policy
CREATE POLICY "Users can insert tasks in their workspaces"
ON public.tasks
FOR INSERT
TO authenticated
WITH CHECK (public.is_workspace_member(workspace_id));

-- Update policy
CREATE POLICY "Users can update tasks in their workspaces"
ON public.tasks
FOR UPDATE
TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

-- Delete policy (soft delete is used, but RLS policy for hard delete is added just in case)
CREATE POLICY "Users can delete tasks in their workspaces"
ON public.tasks
FOR DELETE
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
