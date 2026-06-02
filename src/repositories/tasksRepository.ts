// @ts-nocheck
import { supabase } from "@/integrations/supabase/client";

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

    if (error) throw error;
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
        }))
      )
      .select();

    if (error) throw error;
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

    if (error) throw error;
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

    if (error) throw error;
    return data as SupabaseTask;
  },
};