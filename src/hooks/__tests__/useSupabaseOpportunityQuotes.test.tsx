// Etapa 5 · Fatia 10 · Fase D (incidente #2) — runbook parou no caso 5b: loading
// infinito em LinkedQuotesSection, rede em loop contínuo de
// GET /rest/v1/quotes?... via useSupabaseOpportunityQuotes.
//
// Causa raiz: `refresh: () => query.refetch()` era recriada a cada render (sem
// useCallback/ref). LinkedQuotesSection.tsx coloca `refresh` na dependência de
// um useEffect (padrão pré-existente, não desta fatia) — combinação clássica
// de loop: chamar refresh -> isFetching muda -> re-render -> nova identidade
// de refresh -> efeito roda de novo -> chama refresh de novo, indefinidamente.
//
// Por que os testes existentes não pegaram: LinkedQuotesSection.test.tsx (e
// os demais consumidores) mockam @/hooks/useSupabaseOpportunityQuotes por
// inteiro — o mock devolve um `refresh: vi.fn()` com identidade ESTÁVEL,
// então a instabilidade real do hook nunca era exercida. Este arquivo testa
// o HOOK sem mock (só a camada de repository é mockada), reproduzindo o
// padrão de consumo real (refresh numa dependência de useEffect) e provando
// que a contagem de chamadas ao repository se estabiliza — nunca cresce sem
// parar.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, useEffect, type ReactNode } from "react";

import { useSupabaseOpportunityQuotes } from "@/hooks/useSupabaseOpportunityQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/quotesRepository", () => ({
  quotesRepository: { listQuotesByOpportunity: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

// Reproduz o padrão real de LinkedQuotesSection.tsx:61-66 — um efeito que
// dispara `refresh()` sempre que `opportunityId`/`refresh` mudam.
function useConsumerWithRefreshInDeps(opportunityId?: string) {
  const hook = useSupabaseOpportunityQuotes(opportunityId);
  const { refresh } = hook;
  useEffect(() => {
    if (opportunityId) refresh();
  }, [opportunityId, refresh]);
  return hook;
}

describe("useSupabaseOpportunityQuotes · incidente #2 (Fatia 10, Fase D) — refresh estável", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: {
        id: "ws-1", name: "W", slug: "w", owner_id: "o",
        created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null,
      },
      membership: null, loading: false, error: null,
    });
    vi.mocked(quotesRepository.listQuotesByOpportunity).mockResolvedValue([]);
  });

  it("refresh mantém a mesma identidade entre renders (contrato exigido por consumidores em deps de useEffect)", async () => {
    const { result, rerender } = renderHook(
      ({ opportunityId }: { opportunityId?: string }) => useSupabaseOpportunityQuotes(opportunityId),
      { wrapper, initialProps: { opportunityId: "opp-1" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstRefresh = result.current.refresh;

    rerender({ opportunityId: "opp-1" });
    expect(result.current.refresh).toBe(firstRefresh);

    await result.current.refresh();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.refresh).toBe(firstRefresh);
  });

  it("reprodução do incidente: refresh numa dependência de useEffect não entra em loop de refetch", async () => {
    const { result } = renderHook(
      ({ opportunityId }: { opportunityId?: string }) => useConsumerWithRefreshInDeps(opportunityId),
      { wrapper, initialProps: { opportunityId: "opp-1" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    const callsAfterSettle = vi.mocked(quotesRepository.listQuotesByOpportunity).mock.calls.length;
    expect(callsAfterSettle).toBeGreaterThan(0);

    // Se `refresh` fosse instável (bug original), o efeito re-rodaria a cada
    // render provocado pelo próprio refetch, e essa contagem cresceria sem
    // parar — nunca estabilizaria. Espera e confirma que NÃO cresce mais.
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(vi.mocked(quotesRepository.listQuotesByOpportunity).mock.calls.length).toBe(callsAfterSettle);
  });
});
