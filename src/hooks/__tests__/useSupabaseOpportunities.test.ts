// useSupabaseOpportunities — SOMENTE LEITURA (+ refresh).
//
// As 8 mutations do hook (create/update/moveStage/markWon/markLost/archive/delete/restore) e os
// seus testes de caracterização (R1/R2 da migração pra useMutation, G30) foram removidos como API
// morta: nenhum consumidor as usava — CRM/QuotesSection/Clientes escrevem direto por
// crmOpportunitiesRepository + refresh(). Ver o cabeçalho de useSupabaseOpportunities.ts.
// Ficam os testes da leitura, que ainda é consumida (CRM, G92, import, dashboard).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";

import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { crmOpportunitiesRepository } from "@/repositories/crmOpportunitiesRepository";
import type { SupabaseOpportunity } from "@/repositories/crmOpportunitiesRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/crmOpportunitiesRepository", () => ({
  crmOpportunitiesRepository: { listOpportunities: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

function makeOpportunity(overrides: Partial<SupabaseOpportunity> = {}): SupabaseOpportunity {
  return {
    id: "opp-1", workspace_id: "ws1", client_id: null, title: "Rebranding Acme",
    company: "Acme", contact_name: "Fulano", email: null, phone: null, whatsapp: null,
    stage: "contato", status: "open", source: null, temperature: null, priority: null,
    potential_value: 5000, probability: null, next_action: null, next_action_date: null,
    expected_close_date: null, notes: null, quote_id: null, quote_title: null,
    converted_client_id: null, won_at: null, lost_at: null, lost_reason: null,
    is_demo: false, archived: false, source_local_id: null, tags: null, history: null,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.clear(); } catch { /* jsdom always has it, guard just in case */ }
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([]);
});

describe("useSupabaseOpportunities · leitura (comportamento atual, não escopo da migração)", () => {
  it("sem workspace ativo, não dispara fetch nenhum (enabled: !!workspaceId)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: false, error: null,
    } as never);

    renderHook(() => useSupabaseOpportunities(), { wrapper });

    expect(crmOpportunitiesRepository.listOpportunities).not.toHaveBeenCalled();
  });

  it("carrega as oportunidades do workspace, loading reflete o fetch em andamento", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockResolvedValue([makeOpportunity()] as never);

    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledWith("ws1", { includeArchived: undefined, onlyDeleted: undefined });
    expect(result.current.opportunities).toHaveLength(1);
  });

  it("includeArchived/onlyDeleted viajam pro repository e pra query key (variantes não se misturam)", async () => {
    renderHook(() => useSupabaseOpportunities({ includeArchived: true }), { wrapper });
    renderHook(() => useSupabaseOpportunities({ onlyDeleted: true }), { wrapper });

    await waitFor(() => expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledWith(
      "ws1", { includeArchived: true, onlyDeleted: undefined },
    ));
    expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledWith(
      "ws1", { includeArchived: undefined, onlyDeleted: true },
    );
  });

  it("erro do repository vira Error no estado, opportunities cai pra array vazio, nunca quebra o hook", async () => {
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.opportunities).toEqual([]);
  });

  // API morta removida: nenhum consumidor usava as 8 mutations (CRM/QuotesSection/Clientes escrevem
  // por crmOpportunitiesRepository + refresh). O hook é só leitura — religar uma escrita aqui contornaria
  // a master flag do CRM, o `PipelineStage.type` e o passthrough de uuid (G89/G91).
  it("expõe só leitura (opportunities/loading/error/refresh) — sem mutations", () => {
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });

    expect(Object.keys(result.current).sort()).toEqual(["error", "loading", "opportunities", "refresh"]);
  });

  it("refresh() chama refetch — dispara uma nova chamada ao repository", async () => {
    const { result } = renderHook(() => useSupabaseOpportunities(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(crmOpportunitiesRepository.listOpportunities).mockClear();

    await act(async () => { await result.current.refresh(); });

    expect(crmOpportunitiesRepository.listOpportunities).toHaveBeenCalledTimes(1);
  });
});
