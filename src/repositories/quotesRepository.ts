// Repository for Quotes (Supabase)
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
// Removed unused import of local Quote types

// import_quote_with_items's generated Args type has no null unions for its
// text params (p_client_id/p_opportunity_id/p_client_name/p_client_email/
// p_description) — Postgres function parameters have no NOT NULL concept,
// so the SQL (supabase/migrations/20260719001400_...) genuinely accepts NULL
// for all of these; the generator just doesn't express that.
type ImportQuoteWithItemsArgs = Database["public"]["Functions"]["import_quote_with_items"]["Args"];
type QuoteUpsert = Database["public"]["Tables"]["quotes"]["Insert"];
// Etapa 5 · Fatia 9 (Q8): as 6 colunas novas (client_whatsapp/company/payment_condition/
// delivery_deadline/validity_days/notes) ainda não existem em types.ts (G10 — gerado,
// desatualizado até o operador regenerar pós-aplicação desta migration). Mesmo contorno
// via `unknown` já usado em createQuote/outros repositories para este mesmo gap.
type QuoteUpdate = Database["public"]["Tables"]["quotes"]["Update"];

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
  /** Etapa 5 · Fatia 3 (Q1): cliente Supabase vinculado (fan-out). */
  client_id?: string | null;
  /** Etapa 5 · Fatia 3 (Q1): oportunidade Supabase vinculada (fan-out). */
  opportunity_id?: string | null;
  /** Etapa 5 · Fatia 3 (Q2): chave de idempotência do import (installId:localId). */
  source_local_id?: string | null;
  /** Etapa 5 · Fatia 9 (Q8): espelha Quote.clientWhatsapp local. */
  client_whatsapp?: string | null;
  /** Etapa 5 · Fatia 9 (Q8): espelha Quote.company local. */
  company?: string | null;
  /** Etapa 5 · Fatia 9 (Q8): espelha Quote.paymentCondition local. */
  payment_condition?: string | null;
  /** Etapa 5 · Fatia 9 (Q8): espelha Quote.deliveryDeadline local. */
  delivery_deadline?: string | null;
  /** Etapa 5 · Fatia 9 (Q8): espelha Quote.validityDays local. */
  validity_days?: number | null;
  /** Etapa 5 · Fatia 9 (Q8): espelha Quote.notes local. */
  notes?: string | null;
}

/** Payload do orçamento para o RPC import_quote_with_items — ver mapLocalQuoteToSupabaseQuote. */
export interface ImportQuoteWithItemsInput {
  client_id: string | null;
  opportunity_id: string | null;
  client_name?: string | null;
  client_email?: string | null;
  title: string;
  description?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  archived: boolean;
  /** Etapa 5 · Fatia 9 (Q8). */
  client_whatsapp?: string | null;
  company?: string | null;
  payment_condition?: string | null;
  delivery_deadline?: string | null;
  validity_days?: number | null;
  notes?: string | null;
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
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuote[];
  },

  async getQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .single();
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuote;
  },

  async createQuote(workspaceId: string, input: Partial<SupabaseQuote>) {
    const { data, error } = await supabase
      .from("quotes")
      .insert({ workspace_id: workspaceId, ...input } as unknown as QuoteUpsert)
      .select()
      .single();
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuote;
  },

  async updateQuote(workspaceId: string, quoteId: string, patch: Partial<SupabaseQuote>) {
    const { data, error } = await supabase
      .from("quotes")
      .update(patch as unknown as QuoteUpdate)
      .eq("id", quoteId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) throw normalizeSupabaseError(error);
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
    if (error) throw normalizeSupabaseError(error);
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
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuote;
  },

  async listQuoteItems(workspaceId: string, quoteId: string) {
    // Workspace check via quote relationship
    const { data, error } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false });
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuoteItem[];
  },

  async listQuoteItemsForQuotes(workspaceId: string, quoteIds: string[]) {
    if (!quoteIds.length) return {} as Record<string, SupabaseQuoteItem[]>;
    const { data, error } = await supabase
      .from("quote_items")
      .select("*")
      .in("quote_id", quoteIds)
      .order("created_at", { ascending: false });
    if (error) throw normalizeSupabaseError(error);
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
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuoteItem[];
  },

  /**
   * Etapa 5 · Fatia 3 (Q3, B.3 passo 1): import atômico via RPC
   * import_quote_with_items — upsert do pai (arbiter: UNIQUE workspace_id,
   * source_local_id) + reposição atômica dos itens filhos, numa única
   * transação PostgREST. Substitui createQuote+replaceQuoteItems no caminho
   * de import (nunca fica quote sem itens; ver migration 20260719001400).
   */
  async importQuoteWithItems(
    workspaceId: string,
    sourceLocalId: string,
    quote: ImportQuoteWithItemsInput,
    items: Omit<SupabaseQuoteItem, "id" | "quote_id" | "created_at" | "updated_at">[],
  ) {
    const { data, error } = await supabase.rpc("import_quote_with_items", {
      p_workspace_id: workspaceId,
      p_source_local_id: sourceLocalId,
      p_client_id: quote.client_id,
      p_opportunity_id: quote.opportunity_id,
      p_client_name: quote.client_name ?? null,
      p_client_email: quote.client_email ?? null,
      p_title: quote.title,
      p_description: quote.description ?? null,
      p_subtotal: quote.subtotal,
      p_discount: quote.discount,
      p_total: quote.total,
      p_status: quote.status,
      p_archived: quote.archived,
      p_items: items,
      // Etapa 5 · Fatia 9 (Q8).
      p_client_whatsapp: quote.client_whatsapp ?? null,
      p_company: quote.company ?? null,
      p_payment_condition: quote.payment_condition ?? null,
      p_delivery_deadline: quote.delivery_deadline ?? null,
      p_validity_days: quote.validity_days ?? null,
      p_notes: quote.notes ?? null,
    } as unknown as ImportQuoteWithItemsArgs);
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuote;
  },

  async listQuotesByOpportunity(workspaceId: string, opportunityId: string) {
    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("opportunity_id", opportunityId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw normalizeSupabaseError(error);
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
    if (error) throw normalizeSupabaseError(error);
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
    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseQuote;
  },
};