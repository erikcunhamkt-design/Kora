-- Migration: Create financial_transactions table with RLS
-- Timestamp: 2026-06-01 02:00:00

CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'receivable',
  status text NOT NULL DEFAULT 'pending',
  title text NOT NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  due_date date,
  paid_at timestamp with time zone,
  source text DEFAULT 'quote',
  is_demo boolean DEFAULT false,
  archived boolean DEFAULT false,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for RLS
CREATE POLICY financial_transactions_select ON public.financial_transactions
  FOR SELECT USING (public.is_workspace_member(workspace_id));

CREATE POLICY financial_transactions_insert ON public.financial_transactions
  FOR INSERT WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY financial_transactions_update ON public.financial_transactions
  FOR UPDATE USING (public.is_workspace_member(workspace_id)) WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY financial_transactions_delete ON public.financial_transactions
  FOR DELETE USING (public.is_workspace_member(workspace_id));

-- Trigger to update updated_at column
CREATE TRIGGER financial_transactions_updated_at BEFORE UPDATE ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
