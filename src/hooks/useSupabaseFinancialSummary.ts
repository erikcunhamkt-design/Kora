// Supabase receivables summary — React Query (A2). Public API unchanged.
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository, type SupabaseFinancialTransaction } from "@/repositories/financeRepository";
import { getFriendlyMessage } from "@/lib/supabase/errors";

export function useSupabaseFinancialSummary() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";

  const query = useQuery({
    queryKey: ["supabase-receivables", workspaceId],
    queryFn: () => financeRepository.listReceivables(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  return {
    receivables: (query.data ?? []) as SupabaseFinancialTransaction[],
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh: () => query.refetch(),
  };
}
