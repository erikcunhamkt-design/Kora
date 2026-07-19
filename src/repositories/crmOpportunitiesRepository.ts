import { supabase } from "@/integrations/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

export interface SupabaseOpportunity {
  id: string;
  workspace_id: string;
  client_id: string | null;
  title: string;
  company: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  stage: string;
  status: string | null;
  source: string | null;
  temperature: string | null;
  priority: string | null;
  potential_value: number;
  probability: number | null;
  next_action: string | null;
  next_action_date: string | null;
  expected_close_date: string | null;
  notes: string | null;
  quote_id: string | null;
  quote_title: string | null;
  converted_client_id: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  is_demo: boolean;
  archived: boolean;
  /** Etapa 5 · Fatia 2 — chave de origem do import local (`${installId}:${localId}`). */
  source_local_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseOpportunityInput {
  client_id?: string | null;
  title: string;
  company?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  stage?: string;
  status?: string | null;
  source?: string | null;
  temperature?: string | null;
  priority?: string | null;
  potential_value?: number;
  probability?: number | null;
  next_action?: string | null;
  next_action_date?: string | null;
  expected_close_date?: string | null;
  notes?: string | null;
  quote_id?: string | null;
  quote_title?: string | null;
  converted_client_id?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  lost_reason?: string | null;
  is_demo?: boolean;
  archived?: boolean;
  source_local_id?: string | null;
}

export const crmOpportunitiesRepository = {
  async listOpportunities(workspaceId: string, options?: { includeArchived?: boolean; onlyDeleted?: boolean }) {
    let query = supabase
      .from("crm_opportunities")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Filter based on soft‑deleted status
    if (options?.onlyDeleted) {
      // only deleted rows
      query = query.not("deleted_at", "is", null);
    } else {
      // default – only active (not deleted) rows
      query = query.is("deleted_at", null);
    }

    // Archive filter – applies only when not requesting deleted rows
    if (!options?.includeArchived && !options?.onlyDeleted) {
      query = query.eq("archived", false);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async getOpportunity(workspaceId: string, opportunityId: string) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .select("*")
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId)
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async createOpportunity(workspaceId: string, input: SupabaseOpportunityInput) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .insert({
        workspace_id: workspaceId,
        ...input,
      })
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  /**
   * Etapa 5 · Fatia 2 — upsert idempotente do IMPORT local.
   * Usa a UNIQUE (workspace_id, source_local_id) como arbiter: reimportar o mesmo
   * registro (mesmo installId:localId) vira UPDATE, nunca duplicata.
   * `sourceLocalId` deve vir namespacado (`${installId}:${localId}`) — ver buildSourceLocalId.
   */
  async upsertImportedOpportunity(
    workspaceId: string,
    input: SupabaseOpportunityInput,
    sourceLocalId: string,
  ) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .upsert(
        { workspace_id: workspaceId, ...input, source_local_id: sourceLocalId },
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async updateOpportunity(workspaceId: string, opportunityId: string, patch: Partial<SupabaseOpportunityInput>) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .update(patch)
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async moveOpportunityStage(workspaceId: string, opportunityId: string, stage: string) {
    const patch: Partial<SupabaseOpportunityInput> = { stage };
    if (stage === "fechado") {
      patch.won_at = new Date().toISOString();
      patch.lost_at = null;
      patch.lost_reason = null;
      patch.status = "won";
    } else if (stage === "perdido") {
      patch.lost_at = new Date().toISOString();
      patch.won_at = null;
      patch.status = "lost";
    } else {
      patch.won_at = null;
      patch.lost_at = null;
      patch.lost_reason = null;
      patch.status = "open";
    }

    return this.updateOpportunity(workspaceId, opportunityId, patch);
  },

  async markOpportunityWon(workspaceId: string, opportunityId: string) {
    const patch: Partial<SupabaseOpportunityInput> = {
      stage: "fechado",
      status: "won",
      won_at: new Date().toISOString(),
      lost_at: null,
      lost_reason: null,
    };
    return this.updateOpportunity(workspaceId, opportunityId, patch);
  },

  async markOpportunityLost(workspaceId: string, opportunityId: string, reason?: string) {
    const patch: Partial<SupabaseOpportunityInput> = {
      stage: "perdido",
      status: "lost",
      lost_at: new Date().toISOString(),
      won_at: null,
      lost_reason: reason ?? null,
    };
    return this.updateOpportunity(workspaceId, opportunityId, patch);
  },

  async archiveOpportunity(workspaceId: string, opportunityId: string, archived = true) {
    const { data, error } = await supabase
      .from("crm_opportunities")
      .update({ archived })
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  /**
   * Soft‑delete an opportunity (logical delete).
   * Sets `deleted_at` to current timestamp and optionally stores a reason.
   * Does not remove the row from the table.
   */
  async softDeleteOpportunity(workspaceId: string, opportunityId: string, reason?: string) {
    const patch: { deleted_at: string; deleted_reason?: string } = { deleted_at: new Date().toISOString() };
    if (reason) patch.deleted_reason = reason;
    const { data, error } = await supabase
      .from("crm_opportunities")
      .update(patch)
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  /**
   * Restore a soft‑deleted opportunity.
   * Clears deleted_at, deleted_reason and sets archived = false.
   */
  async restoreSoftDeletedOpportunity(workspaceId: string, opportunityId: string) {
    const patch = { deleted_at: null, deleted_reason: null, archived: false };
    const { data, error } = await supabase
      .from("crm_opportunities")
      .update(patch)
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();
    if (error) throw normalizeSupabaseError(error);
    return data;
  },

  async deleteOpportunity(workspaceId: string, opportunityId: string) {
    const { error } = await supabase
      .from("crm_opportunities")
      .delete()
      .eq("id", opportunityId)
      .eq("workspace_id", workspaceId);

    if (error) throw normalizeSupabaseError(error);
  },
};
