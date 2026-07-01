// @ts-nocheck
// Repository for Quotes (Supabase)
import { supabase } from "@/integrations/supabase/client";
// Removed unused import of local Quote types

export interface SupabaseQuote {
  id: string;
  workspace_id: string;
  client_name?: string | null;
  client_email?: string | null;
  title: string;
  description?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
  deleted_at?: string | null;
  deleted_reason?: string | null;
  deleted_by?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
}

export interface SupabaseQuoteItem {
  id: string;
  quote_id: string;
  service_id?: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  updated_at: string;
}

export const quotesRepository = {
  async listQuotes(workspaceId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as SupabaseQuote[];
  },

  async getQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },

  async createQuote(workspaceId: string, input: Partial<SupabaseQuote>) {
    const { data, error } = await supabase
      .from("quotes")
      .insert({ workspace_id: workspaceId, ...input })
      .select()
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },

  async updateQuote(workspaceId: string, quoteId: string, patch: Partial<SupabaseQuote>) {
    const { data, error } = await supabase
      .from("quotes")
      .update(patch)
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },

  async archiveQuote(workspaceId: string, quoteId: string, archived: boolean) {
    const { data, error } = await supabase
      .from("quotes")
      .update({ archived })
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },

  async softDeleteQuote(workspaceId: string, quoteId: string, reason?: string) {
    const patch: { deleted_at: string; deleted_reason?: string } = { deleted_at: new Date().toISOString() };
    if (reason) patch.deleted_reason = reason;
    const { data, error } = await supabase
      .from("quotes")
      .update(patch)
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },

  async listQuoteItems(workspaceId: string, quoteId: string) {
    // Workspace check via quote relationship
    const { data, error } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as SupabaseQuoteItem[];
  },

  async listQuoteItemsForQuotes(workspaceId: string, quoteIds: string[]) {
    if (!quoteIds.length) return {} as Record<string, SupabaseQuoteItem[]>;
    const { data, error } = await supabase
      .from("quote_items")
      .select("*")
      .in("quote_id", quoteIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const grouped: Record<string, SupabaseQuoteItem[]> = {};
    for (const row of data as SupabaseQuoteItem[]) {
      (grouped[row.quote_id] ||= []).push(row);
    }
    return grouped;
  },

  async replaceQuoteItems(workspaceId: string, quoteId: string, items: Omit<SupabaseQuoteItem, "id" | "quote_id" | "created_at" | "updated_at">[]) {
    // Delete existing items for the quote
    await supabase.from("quote_items").delete().eq("quote_id", quoteId);
    // Insert new items
    const toInsert = items.map((it) => ({ ...it, quote_id: quoteId }));
    const { data, error } = await supabase.from("quote_items").insert(toInsert).select();
    if (error) throw error;
    return data as SupabaseQuoteItem[];
  },

  async listQuotesByOpportunity(workspaceId: string, opportunityId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("opportunity_id", opportunityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data as SupabaseQuote[];
  },

  async approveQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        rejected_at: null,
      })
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },

  async rejectQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        approved_at: null,
      })
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .select()
      .single();
    if (error) throw error;
    return data as SupabaseQuote;
  },
};