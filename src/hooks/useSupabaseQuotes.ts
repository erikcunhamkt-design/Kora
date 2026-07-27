// Hook for Supabase Quotes — backed by React Query (pilot for A2).
//
// Public API is unchanged from the previous useState/useEffect version, so
// consumers (SupabaseQuotesViewerCard, SupabaseOperationalDashboardCard) need
// no edits. Internally React Query now provides caching, request dedup,
// background refetch and automatic invalidation after mutations.
import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import {
  mapLocalQuoteToSupabaseQuote,
  mapSupabaseQuoteToLocalQuote,
  mapLocalQuoteItemToSupabaseItem,
  mapSupabaseQuoteItemToLocalItem,
} from "@/services/quotes/quoteMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Quote, QuoteItem } from "@/hooks/useQuotes";

async function fetchQuotesWithItems(workspaceId: string): Promise<Quote[]> {
  const supabaseQuotes = await quotesRepository.listQuotes(workspaceId);
  const itemsByQuoteId = await quotesRepository.listQuoteItemsForQuotes(
    workspaceId,
    supabaseQuotes.map((sq) => sq.id),
  );
  return supabaseQuotes.map((sq) => {
    const q = mapSupabaseQuoteToLocalQuote(sq);
    q.items = (itemsByQuoteId[sq.id] ?? []).map(mapSupabaseQuoteItemToLocalItem);
    return q;
  });
}

export function useSupabaseQuotes() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = ["supabase-quotes", workspaceId];

  const query = useQuery({
    queryKey,
    queryFn: () => fetchQuotesWithItems(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["supabase-quotes", workspaceId] }),
    [queryClient, workspaceId],
  );

  // Etapa 5 · Fatia 10 (item 1, Q10) — caminho único de criação: sempre via RPC
  // atômica (import_quote_with_items), nunca createQuote+replaceQuoteItems em
  // separado. source_local_id sintético ("native:...") já que não existe um
  // registro local de origem a importar — ver src/lib/installId.ts.
  const createMutation = useMutation({
    mutationFn: async ({ quote, items }: { quote: Quote; items: QuoteItem[] }) => {
      const payload = mapLocalQuoteToSupabaseQuote(quote);
      const supaItems = items.map(mapLocalQuoteItemToSupabaseItem);
      return quotesRepository.importQuoteWithItems(
        workspaceId,
        buildNativeSourceLocalId(),
        payload,
        supaItems,
      );
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ quoteId, patch }: { quoteId: string; patch: Partial<Quote> }) => {
      const supaPatch: Record<string, unknown> = {};
      if (patch.title) supaPatch.title = patch.title;
      if (patch.description) supaPatch.description = patch.description;
      if (patch.status) supaPatch.status = patch.status;
      return quotesRepository.updateQuote(workspaceId, quoteId, supaPatch);
    },
    onSuccess: invalidate,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ quoteId, archived }: { quoteId: string; archived: boolean }) =>
      quotesRepository.archiveQuote(workspaceId, quoteId, archived),
    onSuccess: invalidate,
  });

  const softDeleteMutation = useMutation({
    mutationFn: ({ quoteId, reason }: { quoteId: string; reason?: string }) =>
      quotesRepository.softDeleteQuote(workspaceId, quoteId, reason),
    onSuccess: invalidate,
  });

  const replaceItemsMutation = useMutation({
    mutationFn: ({ quoteId, items }: { quoteId: string; items: QuoteItem[] }) =>
      quotesRepository.replaceQuoteItems(workspaceId, quoteId, items.map(mapLocalQuoteItemToSupabaseItem)),
    onSuccess: invalidate,
  });

  const approveMutation = useMutation({
    mutationFn: (quoteId: string) => quotesRepository.approveQuote(workspaceId, quoteId),
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: (quoteId: string) => quotesRepository.rejectQuote(workspaceId, quoteId),
    onSuccess: invalidate,
  });

  return {
    quotes: query.data ?? [],
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh: () => query.refetch(),

    createQuoteWithItems: async (quote: Quote, items: QuoteItem[]) => {
      const supa = await createMutation.mutateAsync({ quote, items });
      const newQuote = mapSupabaseQuoteToLocalQuote(supa);
      // A RPC devolve só a linha-pai; os itens já são conhecidos localmente
      // (acabaram de ser enviados) — evita um round-trip extra só pra reler.
      newQuote.items = items;
      return newQuote;
    },
    updateQuote: (quoteId: string, patch: Partial<Quote>) =>
      updateMutation.mutateAsync({ quoteId, patch }),
    archiveQuote: (quoteId: string, archived: boolean) =>
      archiveMutation.mutateAsync({ quoteId, archived }),
    softDeleteQuote: (quoteId: string, reason?: string) =>
      softDeleteMutation.mutateAsync({ quoteId, reason }),
    replaceQuoteItems: (quoteId: string, items: QuoteItem[]) =>
      replaceItemsMutation.mutateAsync({ quoteId, items }),
    approveQuote: (quoteId: string) => approveMutation.mutateAsync(quoteId),
    rejectQuote: (quoteId: string) => rejectMutation.mutateAsync(quoteId),
  };
}
