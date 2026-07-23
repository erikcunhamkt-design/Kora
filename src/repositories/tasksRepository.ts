import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

type TaskUpsert = Database["public"]["Tables"]["tasks"]["Insert"];

export interface SupabaseTask {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  client_id?: string | null;
  quote_id?: string | null;
  opportunity_id?: string | null;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  due_date?: string | null;
  source: string;
  sort_order: number;
  is_demo: boolean;
  archived: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Etapa 5 · Fatia 7 (F1): chave de idempotência do import geral. NULL para linhas
   * legadas ou geradas nativamente na nuvem via CreateProjectBaseTasksDialog
   * (source='project_template') — vocabulário disjunto do import geral, os dois
   * nunca competem (ver docs/qa/etapa-5-fatia-7-projects.md §7.3). */
  source_local_id?: string | null;
}

export const tasksRepository = {
  async listTasksByProject(workspaceId: string, projectId: string): Promise<SupabaseTask[]> {
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw normalizeSupabaseError(error);
    return (data as SupabaseTask[]) || [];
  },

  async createProjectBaseTasks(workspaceId: string, tasks: Partial<SupabaseTask>[]): Promise<SupabaseTask[]> {
    const { data, error } = await supabase
      .from("tasks")
      .insert(
        tasks.map((t) => ({
          workspace_id: workspaceId,
          status: "todo",
          source: "project_template",
          ...t,
        })) as unknown as TaskUpsert[]
      )
      .select();

    if (error) throw normalizeSupabaseError(error);
    return (data as SupabaseTask[]) || [];
  },

  async softDeleteTask(workspaceId: string, taskId: string): Promise<SupabaseTask> {
    const { data, error } = await supabase
      .from("tasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", taskId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseTask;
  },

  async updateTaskStatus(workspaceId: string, taskId: string, status: "todo" | "in_progress" | "done"): Promise<SupabaseTask> {
    const { data, error } = await supabase
      .from("tasks")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseTask;
  },

  // Etapa 5 · Fatia 7 (F2) — import geral. Sem árvore de decisão (§7.3 do doc da
  // fatia): o vocabulário local de Task.source ("manual"/"projeto"/"orçamento")
  // nunca produz o literal "project_template" (gerador de tarefas base, Etapa 3) —
  // os dois nunca escrevem a mesma combinação de valores, então um upsert direto
  // pelo arbiter geral basta, sem precisar de nenhum caminho especial.
  async importTask(
    workspaceId: string,
    sourceLocalId: string,
    input: Partial<SupabaseTask>,
  ) {
    // Guarda (mesma disciplina de financeRepository.importTransaction/
    // projectsRepository.importProject): sem source_local_id não-vazio, o upsert
    // abaixo não tem arbiter de idempotência nenhum.
    if (!sourceLocalId || !sourceLocalId.trim()) {
      throw new Error("importTask: source_local_id é obrigatório (arbiter da idempotência)");
    }

    const { data, error } = await supabase
      .from("tasks")
      .upsert(
        { workspace_id: workspaceId, source_local_id: sourceLocalId, ...input } as unknown as TaskUpsert,
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw normalizeSupabaseError(error);
    return data as SupabaseTask;
  },
};