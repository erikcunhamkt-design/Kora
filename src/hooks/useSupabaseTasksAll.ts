// G53 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §3.4/§7 B2) —
// leitura Supabase pra tela principal de Tarefas (Tarefas.tsx), fora do
// escopo de um projeto único (diferente de useSupabaseProjectTasks.ts, que
// já existia e é escopado por projectId). Devolve `Task[]` já traduzido pro
// formato local (mesmo padrão de useSupabaseFinanceTransactions.ts/
// useSupabaseProjects.ts — a tela principal consome objetos prontos, não
// linhas cruas) — `mapSupabaseTaskToLocal` já existe desde este mesmo pacote
// de fundações, este hook só liga o cano até ele.
//
// [G32] `enabled: !!workspaceId`, NUNCA gated por dataSource — o hook
// Supabase busca em paralelo sempre; só `useBifurcatedTasks()` decide qual
// resultado a tela EXIBE.
//
// B5 (fundações de Fase B, §7) — ganhou create/update/move(status)/delete de
// task arbitrária, mesmo molde de useSupabaseFinanceTransactions.ts: [G30]
// cada mutation grava a resposta da própria escrita direto no cache
// (`setQueryData`) desde o primeiro commit — nunca invalidate-only. [G37]
// `createMutation` reusa `mapLocalTaskToSupabase` (já resolve FKs via
// `resolveTaskFk`, passthrough de UUID incluso) — nunca reinventa resolução
// de FK aqui. Criação nativa não tem import-map (maps omitido -> vazio,
// mesmo precedente de useSupabaseProjects.ts/useSupabaseFinanceTransactions.ts):
// se o chamador já passar um uuid real em clientId/quoteId/projectId (cliente/
// quote/projeto já lidos da nuvem), o passthrough de `resolveTaskFk` (G37 por
// desenho) cobre isso sem precisar de mapa nenhum.
import { useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { tasksRepository, type SupabaseTask } from "@/repositories/tasksRepository";
import { mapSupabaseTaskToLocal, mapLocalTaskToSupabase, type CloudTaskStatus } from "@/services/tasks/tasksMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Task } from "@/hooks/useTasks";

const EMPTY_TASKS: SupabaseTask[] = [];

/** Mesmo shape que useTasks().addTask()/NewTaskDialog já aceitam — permite
 * montar UM objeto de formulário e passar pro caminho nativo-nuvem sem
 * transformação (mesmo precedente de NewProjectInput/NewTransactionInput). */
export type NewTaskInput = Omit<Task, "id" | "isDemo" | "createdAt">;

export function useSupabaseTasksAll() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { clients } = useClientsDataSource();
  const queryClient = useQueryClient();
  const queryKey = ["supabase-tasks-all", workspaceId];

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[String(c.id)] = c.name; });
    return map;
  }, [clients]);

  const query = useQuery({
    queryKey,
    queryFn: () => tasksRepository.listTasks(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: NewTaskInput) => {
      // mapLocalTaskToSupabase só lê os campos de negócio (title, description,
      // priority, dueDate, status, source, FKs) — id/createdAt/isDemo aqui só
      // satisfazem o tipo Task, nunca lidos pelo mapper.
      const taskLike: Task = { ...input, id: 0, createdAt: "", isDemo: false };
      const payload = mapLocalTaskToSupabase(taskLike);
      return tasksRepository.importTask(workspaceId, buildNativeSourceLocalId(), payload);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseTask[]>(
        queryKey,
        (prev) => [created, ...(prev ?? []).filter((t) => t.id !== created.id)],
      );
    },
  });

  // UPDATE genérico — o chamador (Tarefas.tsx) monta o patch já no formato
  // cloud (`Partial<SupabaseTask>`), decidindo quais campos locais têm
  // contraparte cloud antes de chamar. Mesmo contrato de
  // useSupabaseProjects.updateProject/useSupabaseFinanceTransactions.updateTransaction.
  const updateMutation = useMutation({
    mutationFn: ({ taskId, patch }: { taskId: string; patch: Partial<SupabaseTask> }) =>
      tasksRepository.updateTask(workspaceId, taskId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseTask[]>(
        queryKey,
        (prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)),
      );
    },
  });

  // "Move" (status) — reusa tasksRepository.updateTaskStatus (já existe,
  // consumido por useSupabaseProjectTasks.ts) em vez de duplicar via
  // updateMutation genérico — mesmo vocabulário local/cloud (R1/G40), sem
  // tradução. G30 aplicado aqui de propósito (não descoberto depois): grava a
  // resposta do próprio UPDATE no cache desta query (`supabase-tasks-all`),
  // independente do cache de useSupabaseProjectTasks (`supabase-project-tasks`,
  // escopado por projeto — os 2 hooks nunca competem pela mesma queryKey).
  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: CloudTaskStatus }) =>
      tasksRepository.updateTaskStatus(workspaceId, taskId, status),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseTask[]>(
        queryKey,
        (prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: string) => tasksRepository.softDeleteTask(workspaceId, taskId),
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseTask[]>(
        queryKey,
        (prev) => (prev ?? []).filter((t) => t.id !== deleted.id),
      );
    },
  });

  const tasks = useMemo<Task[]>(
    () => (query.data ?? EMPTY_TASKS).map((st) => mapSupabaseTaskToLocal(st, clientNameById)),
    [query.data, clientNameById],
  );

  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const refresh = useCallback(() => { refetchRef.current(); }, []);

  return {
    tasks,
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,

    createTask: (input: NewTaskInput) => createMutation.mutateAsync(input),
    updateTask: (taskId: string, patch: Partial<SupabaseTask>) =>
      updateMutation.mutateAsync({ taskId, patch }),
    moveTask: (taskId: string, status: CloudTaskStatus) =>
      moveMutation.mutateAsync({ taskId, status }),
    deleteTask: (taskId: string) => deleteMutation.mutateAsync(taskId),
  };
}
