// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

export interface SupabaseTechnicalSheetInput {
  branding?: Record<string, unknown>;
  persona?: Record<string, unknown>;
  editorial?: Record<string, unknown>;
  typography?: Record<string, unknown>;
  social_links?: Record<string, unknown>;
  briefing?: Record<string, unknown>;
  materials?: Record<string, unknown>[];
  raw_payload?: Record<string, unknown>;
}

export const clientTechnicalSheetsRepository = {
  async getTechnicalSheet(workspaceId: string, clientId: string) {
    const { data, error } = await supabase
      .from("client_technical_sheets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async upsertTechnicalSheet(
    workspaceId: string,
    clientId: string,
    payload: SupabaseTechnicalSheetInput
  ) {
    const { data, error } = await supabase
      .from("client_technical_sheets")
      .upsert({
        workspace_id: workspaceId,
        client_id: clientId,
        ...payload,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "client_id",
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteTechnicalSheet(workspaceId: string, clientId: string) {
    const { error } = await supabase
      .from("client_technical_sheets")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId);

    if (error) throw error;
    return true;
  },
};