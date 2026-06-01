-- Migration: CRM Opportunities Schema V1
-- Description: Creates public.crm_opportunities table with RLS policies linked to workspaces.

CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  company TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  stage TEXT NOT NULL DEFAULT 'lead',
  status TEXT DEFAULT 'open',
  source TEXT,
  temperature TEXT,
  priority TEXT,
  potential_value NUMERIC DEFAULT 0,
  probability INTEGER,
  next_action TEXT,
  next_action_date DATE,
  expected_close_date DATE,
  notes TEXT,
  quote_id UUID,
  quote_title TEXT,
  converted_client_id UUID,
  won_at TIMESTAMPTZ,
  lost_at TIMESTAMPTZ,
  lost_reason TEXT,
  is_demo BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_workspace ON public.crm_opportunities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_client ON public.crm_opportunities(client_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON public.crm_opportunities(workspace_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_archived ON public.crm_opportunities(workspace_id, archived);

-- Enable RLS
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can select opportunities from their workspaces"
ON public.crm_opportunities
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can insert opportunities into their workspaces"
ON public.crm_opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_member(workspace_id)
);

CREATE POLICY "Users can update opportunities in their workspaces"
ON public.crm_opportunities
FOR UPDATE
TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can delete opportunities in their workspaces"
ON public.crm_opportunities
FOR DELETE
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Trigger for updated_at column
CREATE TRIGGER update_crm_opportunities_updated_at
BEFORE UPDATE ON public.crm_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
