-- Migration: Create quotes and quote_items tables with RLS and triggers
-- Timestamp: 2026-05-31 03:00:00

-- Table: public.quotes
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_name text,
  client_email text,
  title text NOT NULL,
  description text,
  subtotal numeric,
  discount numeric,
  total numeric,
  status text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  archived boolean DEFAULT false,
  deleted_at timestamp with time zone,
  deleted_reason text,
  deleted_by uuid
);

-- Table: public.quote_items
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  service_id uuid,
  name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable row level security
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Policies for SELECT, INSERT, UPDATE, DELETE using is_workspace_member()
CREATE POLICY quotes_select ON public.quotes
  FOR SELECT USING (public.is_workspace_member(workspace_id));
CREATE POLICY quotes_insert ON public.quotes
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY quotes_update ON public.quotes
  FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY quotes_delete ON public.quotes
  FOR DELETE USING (public.is_workspace_member(workspace_id));

CREATE POLICY quote_items_select ON public.quote_items
  FOR SELECT USING (public.is_workspace_member((SELECT workspace_id FROM public.quotes WHERE id = quote_id)));
CREATE POLICY quote_items_insert ON public.quote_items
  FOR INSERT WITH CHECK (public.is_workspace_member((SELECT workspace_id FROM public.quotes WHERE id = quote_id)));
CREATE POLICY quote_items_update ON public.quote_items
  FOR UPDATE USING (public.is_workspace_member((SELECT workspace_id FROM public.quotes WHERE id = quote_id))) WITH CHECK (public.is_workspace_member((SELECT workspace_id FROM public.quotes WHERE id = quote_id)));
CREATE POLICY quote_items_delete ON public.quote_items
  FOR DELETE USING (public.is_workspace_member((SELECT workspace_id FROM public.quotes WHERE id = quote_id)));

-- Triggers to update updated_at column
CREATE FUNCTION public.update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotes_updated_at BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

CREATE TRIGGER quote_items_updated_at BEFORE UPDATE ON public.quote_items
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- End of migration
