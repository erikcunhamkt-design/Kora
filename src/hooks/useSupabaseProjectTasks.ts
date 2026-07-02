// Supabase project tasks — React Query (A2). Public API unchanged.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { tasksRepository, type SupabaseTask } from "@/repositories/tasksRepository";
import { getFriendlyMessage } from "@/lib/supabase/errors";

export function useSupabaseProjectTasks(projectId?: string) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["supabase-project-tasks", workspaceId, projectId ?? null],
    queryFn: () => tasksRepository.listTasksByProject(workspaceId, projectId!),
    enabled: !!workspaceId && !!projectId,
    staleTime: 30_000,
  });

  const updateStatus = useCallback(
    async (taskId: string, status: "todo" | "in_progress" | "done") => {
      if (!workspaceId) throw new Error("Workspace ativo ausente");
      await tasksRepository.updateTaskStatus(workspaceId, taskId, status);
      await queryClient.invalidateQueries({
        queryKey: ["supabase-project-tasks", workspaceId, projectId ?? null],
      });
    },
    [workspaceId, projectId, queryClient],
  );

  return {
    tasks: (query.data ?? []) as SupabaseTask[],
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh: () => query.refetch(),
    updateStatus,
  };
}
