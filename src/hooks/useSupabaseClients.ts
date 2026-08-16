// Supabase-backed clients — React Query (A2).
//
// Public API is unchanged from the previous useState/useEffect version, so
// consumers (useClientsDataSource, useLocalClientsImport, Configuracoes) need
// no edits. The workspace-scoped queryKey replaces the manual requestSeq /
// workspaceIdRef guards that prevented stale writes across workspace switches.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientsRepository, type SupabaseClientInput } from "@/repositories/clientsRepository";

type SupabaseClientRecord = Awaited<ReturnType<typeof clientsRepository.listClients>>[number];

export function useSupabaseClients() {
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = ["supabase-clients", workspaceId];

  const query = useQuery({
    queryKey,
    queryFn: () => clientsRepository.listClients(workspaceId),
    enabled: !!workspace && !workspaceLoading,
    staleTime: 30_000,
  });

  // G60 (docs/architecture/kora-hub-auditoria-e-plano.md) — G30 varrendo as 4
  // mutations deste hook (transferido de volta pra Lane D — pacote Clientes
  // da Lane C é doc-only, não toca este arquivo). Cache guarda a linha crua
  // do repository (SupabaseClientRecord), não um shape mapeado — mesmo molde
  // simples de useSupabaseFinanceTransactions/useSupabaseProjects, sem
  // precisar do mergeQuotePatch de useSupabaseQuotes.
  const addMutation = useMutation({
    mutationFn: (input: SupabaseClientInput) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.createClient(workspace.id, input);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseClientRecord[]>(
        queryKey,
        (prev) => [created, ...(prev ?? []).filter((c) => c.id !== created.id)],
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ clientId, patch }: { clientId: string; patch: Partial<SupabaseClientInput> }) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.updateClient(workspace.id, clientId, patch);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseClientRecord[]>(
        queryKey,
        (prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });

  // archiveClient não some da lista — listClients não filtra por archived
  // (é uma flag exibida/filtrada pelo consumidor, não uma exclusão de
  // query), então o merge é update-in-place, mesmo padrão de updateMutation.
  const archiveMutation = useMutation({
    mutationFn: ({ clientId, archived }: { clientId: string; archived: boolean }) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.archiveClient(workspace.id, clientId, archived);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseClientRecord[]>(
        queryKey,
        (prev) => (prev ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });

  // deleteClient é hard delete de verdade (clientsRepository.ts) — devolve
  // `true`, não a linha apagada, então o id pra remover do cache vem da
  // própria variável de entrada da mutation (2º argumento do onSuccess),
  // não da resposta.
  const deleteMutation = useMutation({
    mutationFn: (clientId: string) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.deleteClient(workspace.id, clientId);
    },
    onSuccess: (_success, clientId) => {
      queryClient.setQueryData<SupabaseClientRecord[]>(
        queryKey,
        (prev) => (prev ?? []).filter((c) => c.id !== clientId),
      );
    },
  });

  return {
    workspace,
    workspaceLoading,
    clients: (query.data ?? []) as SupabaseClientRecord[],
    loading: query.isLoading || query.isFetching,
    error: (query.error ?? null) as Error | null,
    addClient: (input: SupabaseClientInput) => addMutation.mutateAsync(input),
    updateClient: (clientId: string, patch: Partial<SupabaseClientInput>) =>
      updateMutation.mutateAsync({ clientId, patch }),
    archiveClient: (clientId: string, archived = true) =>
      archiveMutation.mutateAsync({ clientId, archived }),
    deleteClient: (clientId: string) => deleteMutation.mutateAsync(clientId),
    refreshClients: () => query.refetch(),
  };
}
export type { SupabaseClientInput };
