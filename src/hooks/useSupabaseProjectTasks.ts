// Supabase project tasks — React Query (A2). Public API unchanged.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { tasksRepository, type SupabaseTask } from "@/repositories/tasksRepository";
import type { CloudTaskStatus } from "@/services/tasks/tasksMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";

export function useSupabaseProjectTasks(projectId?: string) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = ["supabase-project-tasks", workspaceId, projectId ?? null];

  const query = useQuery({
    queryKey,
    queryFn: () => tasksRepository.listTasksByProject(workspaceId, projectId!),
    enabled: !!workspaceId && !!projectId,
    staleTime: 30_000,
  });

  // G53 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §3.5) — G30:
  // grava a linha devolvida pelo próprio UPDATE (`.select().single()`,
  // tasksRepository.ts, já confirmada pelo banco) direto no cache, em vez de
  // só invalidar e esperar um refetch — mesmo fix aplicado a
  // useSupabaseProjects.ts. Um refetch subsequente com qualquer lag (réplica,
  // cache do PostgREST, timing de rede) reverteria o cache pro valor antigo
  // até o próximo refetch — mesma classe de bug que prendia
  // ProjectDetailDrawer.tsx mostrando status velho antes do fix de G30.
  const updateStatus = useCallback(
    async (taskId: string, status: CloudTaskStatus) => {
      if (!workspaceId) throw new Error("Workspace ativo ausente");
      const updated = await tasksRepository.updateTaskStatus(workspaceId, taskId, status);
      queryClient.setQueryData<SupabaseTask[]>(
        ["supabase-project-tasks", workspaceId, projectId ?? null],
        (prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)),
      );
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
