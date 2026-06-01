-- Migration: Clients and Contacts V1
-- Description: Creates public.clients and public.client_contacts tables with Row Level Security (RLS) linked to workspaces.

-- Create public.clients table
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  instagram TEXT,
  website TEXT,
  city TEXT,
  state TEXT,
  address TEXT,
  document TEXT,
  type TEXT,
  status TEXT,
  source TEXT,
  temperature TEXT,
  potential_value NUMERIC DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  next_action TEXT,
  next_action_date DATE,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  archived BOOLEAN DEFAULT false,
  is_demo BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for clients
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON public.clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_archived ON public.clients(workspace_id, archived);

-- Create public.client_contacts table
CREATE TABLE IF NOT EXISTS public.client_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_financial BOOLEAN DEFAULT false,
  is_decision_maker BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for client_contacts
CREATE INDEX IF NOT EXISTS idx_client_contacts_client ON public.client_contacts(client_id);
CREATE INDEX IF NOT EXISTS idx_client_contacts_workspace ON public.client_contacts(workspace_id);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for public.clients
CREATE POLICY "Users can select clients from their workspaces"
ON public.clients
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can insert clients into their workspaces"
ON public.clients
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_member(workspace_id)
);

CREATE POLICY "Users can update clients in their workspaces"
ON public.clients
FOR UPDATE
TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can delete clients in their workspaces"
ON public.clients
FOR DELETE
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- RLS Policies for public.client_contacts
CREATE POLICY "Users can select client contacts from their workspaces"
ON public.client_contacts
FOR SELECT
TO authenticated
USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can insert client contacts into their workspaces"
ON public.client_contacts
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_workspace_member(workspace_id)
);

CREATE POLICY "Users can update client contacts in their workspaces"
ON public.client_contacts
FOR UPDATE
TO authenticated
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY "Users can delete client contacts in their workspaces"
ON public.client_contacts
FOR DELETE
TO authenticated
USING (public.is_workspace_member(workspace_id));

-- Triggers for updated_at column
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_contacts_updated_at
BEFORE UPDATE ON public.client_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
