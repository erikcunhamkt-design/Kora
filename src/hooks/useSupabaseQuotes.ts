// @ts-nocheck
// Hook for Supabase Quotes
import { useCallback, useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { mapLocalQuoteToSupabaseQuote, mapSupabaseQuoteToLocalQuote, mapLocalQuoteItemToSupabaseItem, mapSupabaseQuoteItemToLocalItem } from "@/services/quotes/quoteMapper";
import type { Quote, QuoteItem } from "@/hooks/useQuotes";

export function useSupabaseQuotes() {
  const { workspace } = useCurrentWorkspace();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id ?? "";

  const fetchQuotes = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const supabaseQuotes = await quotesRepository.listQuotes(workspaceId);
      const localQuotes = supabaseQuotes.map(mapSupabaseQuoteToLocalQuote);
      // For each quote, fetch its items
      const promises = supabaseQuotes.map(async (sq) => {
        const items = await quotesRepository.listQuoteItems(workspaceId, sq.id);
        return { sq, items };
      });
      const results = await Promise.all(promises);
      const enriched = results.map(({ sq, items }) => {
        const q = mapSupabaseQuoteToLocalQuote(sq);
        q.items = items.map(mapSupabaseQuoteItemToLocalItem);
        return q;
      });
      setQuotes(enriched);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error loading quotes");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const refresh = fetchQuotes;

  // CRUD wrappers
  const createQuote = useCallback(async (quote: Quote) => {
    if (!workspaceId) return;
    const supa = await quotesRepository.createQuote(workspaceId, mapLocalQuoteToSupabaseQuote(quote));
    const newQuote = mapSupabaseQuoteToLocalQuote(supa);
    newQuote.items = [];
    setQuotes((prev) => [newQuote, ...prev]);
    return newQuote;
  }, [workspaceId]);

  const updateQuote = useCallback(async (quoteId: string, patch: Partial<Quote>) => {
    if (!workspaceId) return;
    // Map patch to Supabase fields (only include defined properties)
    const supaPatch: Partial<SupabaseQuote> = {};
    if (patch.title) supaPatch.title = patch.title;
    if (patch.description) supaPatch.description = patch.description;
    if (patch.status) supaPatch.status = patch.status;
    // ... add other fields as needed
    const updated = await quotesRepository.updateQuote(workspaceId, quoteId, supaPatch);
    const local = mapSupabaseQuoteToLocalQuote(updated);
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, ...local } : q)));
  }, [workspaceId]);

  const archiveQuote = useCallback(async (quoteId: string, archived: boolean) => {
    if (!workspaceId) return;
    const updated = await quotesRepository.archiveQuote(workspaceId, quoteId, archived);
    const local = mapSupabaseQuoteToLocalQuote(updated);
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, ...local } : q)));
  }, [workspaceId]);

  const softDeleteQuote = useCallback(async (quoteId: string, reason?: string) => {
    if (!workspaceId) return;
    const deleted = await quotesRepository.softDeleteQuote(workspaceId, quoteId, reason);
    // Mark as deleted locally (could add a flag)
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: "arquivado" as const } : q)));
  }, [workspaceId]);

  const replaceQuoteItems = useCallback(async (quoteId: string, items: QuoteItem[]) => {
    if (!workspaceId) return;
    const supaItems = items.map(mapLocalQuoteItemToSupabaseItem);
    const updated = await quotesRepository.replaceQuoteItems(workspaceId, quoteId, supaItems);
    const localItems = updated.map(mapSupabaseQuoteItemToLocalItem);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, items: localItems } : q))
    );
  }, [workspaceId]);

  const approveQuote = useCallback(async (quoteId: string) => {
    if (!workspaceId) return;
    const updated = await quotesRepository.approveQuote(workspaceId, quoteId);
    const local = mapSupabaseQuoteToLocalQuote(updated);
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, ...local } : q)));
  }, [workspaceId]);

  const rejectQuote = useCallback(async (quoteId: string) => {
    if (!workspaceId) return;
    const updated = await quotesRepository.rejectQuote(workspaceId, quoteId);
    const local = mapSupabaseQuoteToLocalQuote(updated);
    setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, ...local } : q)));
  }, [workspaceId]);

  return {
    quotes,
    loading,
    error,
    refresh,
    createQuote,
    updateQuote,
    archiveQuote,
    softDeleteQuote,
    replaceQuoteItems,
    approveQuote,
    rejectQuote,
  };
}