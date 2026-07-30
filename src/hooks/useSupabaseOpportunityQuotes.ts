// Quotes linked to a CRM opportunity — React Query backed (A2 pilot).
// Public API unchanged: { quotes, loading, error, refresh }.
import { useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { mapSupabaseQuoteToLocalQuote } from "@/services/quotes/quoteMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import type { Quote } from "@/hooks/useQuotes";

const EMPTY_QUOTES: Quote[] = [];

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

  // Fatia 10 · Fase D (incidente #2) — `refresh` precisa ter identidade
  // ESTÁVEL entre renders. `() => query.refetch()` inline recria a função a
  // cada render; um consumidor que coloca `refresh` numa dependência de
  // `useEffect` (padrão real em LinkedQuotesSection.tsx) entra em loop: chama
  // refresh -> refetch muda isFetching -> re-render -> nova identidade de
  // refresh -> efeito roda de novo -> chama refresh de novo, infinitamente.
  // Via ref: a função devolvida nunca muda, mesmo que `query.refetch` mude.
  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const refresh = useCallback(() => {
    refetchRef.current();
  }, []);

  return {
    quotes: query.data ?? EMPTY_QUOTES,
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,
  };
}
