-- Migration: Workspaces Schema V1
-- Description: Creates public.workspaces and public.workspace_members tables, hooks up handles, and updates the onboarding user bootstrap triggers.

-- Create public.workspaces table
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index workspaces on owner
CREATE INDEX IF NOT EXISTS idx_workspaces_owner ON public.workspaces(owner_id);

-- Create public.workspace_members table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_workspace_user UNIQUE (workspace_id, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Helper SQL function for workspace membership check
CREATE OR REPLACE FUNCTION public.is_workspace_member(w_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = w_id
      AND workspace_members.user_id = auth.uid()
  );
END;
$$;

-- Revoke public execution permission and grant to system/authenticated roles
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID) TO authenticated, service_role;

-- RLS Policies for public.workspaces
CREATE POLICY "Users can view workspaces they belong to"
ON public.workspaces
FOR SELECT
TO authenticated
USING (public.is_workspace_member(id));

CREATE POLICY "Owners can update their workspaces"
ON public.workspaces
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = public.workspaces.id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_members.workspace_id = public.workspaces.id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
  )
);

-- RLS Policies for public.workspace_members
CREATE POLICY "Users can view members of their workspaces"
ON public.workspace_members
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Trigger function update for handle_new_user to bootstrap workspaces
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  profile_id UUID;
  workspace_id UUID;
  display_name_val TEXT;
BEGIN
  -- 1. Insert Profile
  display_name_val := COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  
  INSERT INTO public.profiles (user_id, display_name, email)
  VALUES (NEW.id, display_name_val, NEW.email)
  RETURNING user_id INTO profile_id;

  -- 2. Insert Workspace
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (display_name_val || ' Workspace', profile_id)
  RETURNING id INTO workspace_id;

  -- 3. Insert Membership (Owner)
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (workspace_id, profile_id, 'owner');

  RETURN NEW;
END;
$$;

-- Re-apply revoke execution on public.handle_new_user()
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- Add updated_at trigger for workspaces
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON public.workspaces
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
