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
// Supabase busca em paralelo sempre; só `useBifurcatedTasks()` (Fase B,
// próximo item) decide qual resultado a tela EXIBE.
//
// Read-only por desenho, igual a useBifurcatedFinance.ts: escrita nativa em
// modo Supabase pra Tarefas.tsx (criar/editar/mover tarefa arbitrária) é a
// B5 do plano de Fase B — não existe hoje, fora do escopo desta rodada
// (B2+B3). `updateStatus` de tarefas de projeto continua em
// useSupabaseProjectTasks.ts, intocado.
import { useCallback, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { tasksRepository, type SupabaseTask } from "@/repositories/tasksRepository";
import { mapSupabaseTaskToLocal } from "@/services/tasks/tasksMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import type { Task } from "@/hooks/useTasks";

const EMPTY_TASKS: SupabaseTask[] = [];

export function useSupabaseTasksAll() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { clients } = useClientsDataSource();
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
  };
}
