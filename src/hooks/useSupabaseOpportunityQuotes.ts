import { useCallback, useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { mapSupabaseQuoteToLocalQuote } from "@/services/quotes/quoteMapper";
import type { Quote } from "@/hooks/useQuotes";

export function useSupabaseOpportunityQuotes(opportunityId?: string) {
  const { workspace } = useCurrentWorkspace();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id ?? "";

  const fetchQuotes = useCallback(async () => {
    if (!workspaceId || !opportunityId) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabaseQuotes = await quotesRepository.listQuotesByOpportunity(workspaceId, opportunityId);
      const localQuotes = supabaseQuotes.map(mapSupabaseQuoteToLocalQuote);
      setQuotes(localQuotes);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar orçamentos");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, opportunityId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  return {
    quotes,
    loading,
    error,
    refresh: fetchQuotes,
  };
}
