// Supabase-backed clients — React Query (A2).
//
// Public API is unchanged from the previous useState/useEffect version, so
// consumers (useClientsDataSource, useLocalClientsImport, Configuracoes) need
// no edits. The workspace-scoped queryKey replaces the manual requestSeq /
// workspaceIdRef guards that prevented stale writes across workspace switches.
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientsRepository, type SupabaseClientInput } from "@/repositories/clientsRepository";

type SupabaseClientRecord = Awaited<ReturnType<typeof clientsRepository.listClients>>[number];

export function useSupabaseClients() {
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["supabase-clients", workspaceId],
    queryFn: () => clientsRepository.listClients(workspaceId),
    enabled: !!workspace && !workspaceLoading,
    staleTime: 30_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["supabase-clients", workspaceId] }),
    [queryClient, workspaceId],
  );

  const addMutation = useMutation({
    mutationFn: (input: SupabaseClientInput) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.createClient(workspace.id, input);
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ clientId, patch }: { clientId: string; patch: Partial<SupabaseClientInput> }) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.updateClient(workspace.id, clientId, patch);
    },
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ clientId, archived }: { clientId: string; archived: boolean }) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.archiveClient(workspace.id, clientId, archived);
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (clientId: string) => {
      if (!workspace) throw new Error("No active workspace found");
      return clientsRepository.deleteClient(workspace.id, clientId);
    },
    onSuccess: invalidate,
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
