import { useCallback, useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { tasksRepository, type SupabaseTask } from "@/repositories/tasksRepository";

export function useSupabaseProjectTasks(projectId?: string) {
  const { workspace } = useCurrentWorkspace();
  const [tasks, setTasks] = useState<SupabaseTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id ?? "";

  const fetchTasks = useCallback(async () => {
    if (!workspaceId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tasksRepository.listTasksByProject(workspaceId, projectId);
      setTasks(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar tarefas do projeto");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateStatus = useCallback(async (taskId: string, status: "todo" | "in_progress" | "done") => {
    if (!workspaceId) throw new Error("Workspace ativo ausente");
    try {
      await tasksRepository.updateTaskStatus(workspaceId, taskId, status);
      await fetchTasks();
    } catch (e: unknown) {
      throw new Error(e instanceof Error ? e.message : "Erro ao atualizar status da tarefa");
    }
  }, [workspaceId, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refresh: fetchTasks,
    updateStatus,
  };
}
