// @ts-nocheck
// Repository for Projects (Supabase)
import { supabase } from "@/integrations/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

export interface SupabaseProject {
  id: string;
  workspace_id: string;
  client_id?: string | null;
  quote_id?: string | null;
  opportunity_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  start_date?: string | null;
  due_date?: string | null;
  budget?: number;
  source?: string | null;
  is_demo: boolean;
  archived: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export const projectsRepository = {
  async findProjectByQuote(workspaceId: string, quoteId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("quote_id", quoteId)
      .eq("source", "quote")
      .is("deleted_at", null);

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject[];
  },

  async createProjectFromQuote(workspaceId: string, input: Partial<SupabaseProject>) {
    const { data, error } = await supabase
      .from("projects")
      .insert({
        workspace_id: workspaceId,
        status: "active",
        source: "quote",
        ...input,
      })
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation do índice ux_projects_from_quote (Etapa 3 S5).
      // Corrida perdedora: o projeto deste orçamento já existe -> idempotente,
      // devolve o existente em vez de propagar o erro.
      if (error.code === "23505" && input.quote_id) {
        const existing = await projectsRepository.findProjectByQuote(workspaceId, input.quote_id);
        if (existing[0]) return existing[0];
      }
      throw normalizeSupabaseError(error);
    }
    return data as SupabaseProject;
  },

  async softDeleteProject(workspaceId: string, projectId: string) {
    const { data, error } = await supabase
      .from("projects")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("id", projectId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject;
  },

  async listProjects(workspaceId: string) {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseProject[];
  },
};