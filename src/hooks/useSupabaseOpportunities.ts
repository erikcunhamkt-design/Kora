// Supabase-backed CRM opportunities — React Query (A2).
//
// SOMENTE LEITURA (+ `refresh`). Reads go through useQuery (workspace + options scoped key).
//
// Histórico: este hook já expôs 8 mutations (create/update/moveStage/markWon/markLost/archive/
// delete/restore), migradas pra `useMutation` + `setQueryData` na preparação G30/G32. Nenhum
// consumidor as usou: o CRM (`CRM.tsx`) e os escritores de lead fora dele (`QuotesSection`,
// `Clientes`) escrevem direto por `crmOpportunitiesRepository` e depois chamam `refresh()`
// (confirmado por grep: todo consumidor deste hook só lê `opportunities`/`loading`/`error`/
// `refresh`). Foram removidas como API morta (classe G84 — código que promete uma escrita que
// ninguém usa e que, ao ser religado, escreveria por um caminho sem as regras do CRM: master flag,
// `PipelineStage.type`, passthrough de uuid G89/G91). Quem precisar escrever usa o repositório
// pelo mesmo caminho do CRM, não reintroduz mutations aqui.
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  crmOpportunitiesRepository,
  type SupabaseOpportunity,
} from "@/repositories/crmOpportunitiesRepository";

const EMPTY_OPPORTUNITIES: SupabaseOpportunity[] = [];

export function useSupabaseOpportunities(options?: { includeArchived?: boolean; onlyDeleted?: boolean }) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";

  const includeArchived = options?.includeArchived;
  const onlyDeleted = options?.onlyDeleted;
  const queryKey = ["supabase-opportunities", workspaceId, includeArchived ?? false, onlyDeleted ?? false];

  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<SupabaseOpportunity[]> => {
      const data = await crmOpportunitiesRepository.listOpportunities(workspaceId, {
        includeArchived,
        onlyDeleted,
      });
      return (data as unknown as SupabaseOpportunity[]) || [];
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  return {
    opportunities: query.data ?? EMPTY_OPPORTUNITIES,
    loading: query.isLoading || query.isFetching,
    error: (query.error ?? null) as Error | null,
    refresh: () => query.refetch(),
  };
}
