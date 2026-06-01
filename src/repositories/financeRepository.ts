// Repository for Financial Transactions (Supabase)
import { supabase } from "@/integrations/supabase/client";

export interface SupabaseFinancialTransaction {
  id: string;
  workspace_id: string;
  client_id?: string | null;
  quote_id?: string | null;
  opportunity_id?: string | null;
  type: string;
  status: string;
  title: string;
  description?: string | null;
  amount: number;
  due_date?: string | null;
  paid_at?: string | null;
  source?: string | null;
  is_demo: boolean;
  archived: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const financeRepository = {
  async findReceivableByQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("quote_id", quoteId)
      .eq("source", "quote")
      .eq("type", "receivable")
      .is("deleted_at", null);

    if (error) throw error;
    return data as SupabaseFinancialTransaction[];
  },

  async createReceivableFromQuote(workspaceId: string, input: Partial<SupabaseFinancialTransaction>) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .insert({
        workspace_id: workspaceId,
        type: "receivable",
        status: "pending",
        source: "quote",
        ...input,
      })
      .select()
      .single();

    if (error) throw error;
    return data as SupabaseFinancialTransaction;
  },

  async softDeleteReceivable(workspaceId: string, id: string) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw error;
    return data as SupabaseFinancialTransaction;
  },

  async listReceivables(workspaceId: string) {
    const { data, error } = await supabase
      .from("financial_transactions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data as SupabaseFinancialTransaction[];
  },
};
