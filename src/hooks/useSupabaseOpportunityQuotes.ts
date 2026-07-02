// Quotes linked to a CRM opportunity — React Query backed (A2 pilot).
// Public API unchanged: { quotes, loading, error, refresh }.
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { mapSupabaseQuoteToLocalQuote } from "@/services/quotes/quoteMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import type { Quote } from "@/hooks/useQuotes";

export function useSupabaseOpportunityQuotes(opportunityId?: string) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";

  const query = useQuery({
    queryKey: ["supabase-opportunity-quotes", workspaceId, opportunityId ?? null],
    queryFn: async (): Promise<Quote[]> => {
      const supabaseQuotes = await quotesRepository.listQuotesByOpportunity(workspaceId, opportunityId!);
      return supabaseQuotes.map(mapSupabaseQuoteToLocalQuote);
    },
    enabled: !!workspaceId && !!opportunityId,
    staleTime: 30_000,
  });

  return {
    quotes: query.data ?? [],
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh: () => query.refetch(),
  };
}
