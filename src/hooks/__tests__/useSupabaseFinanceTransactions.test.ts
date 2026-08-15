// Etapa 5 · Financeiro Fatia N (item 2) — hook de leitura real (React Query
// real, só o repository/useClientsDataSource mockados), mesmo padrão de
// useSupabaseOpportunityQuotes.test.tsx/useSupabaseProjects.test.tsx —
// exercita a integração real em vez de mockar o hook inteiro.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseFinanceTransactions } from "@/hooks/useSupabaseFinanceTransactions";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { financeRepository } from "@/repositories/financeRepository";
import type { SupabaseFinancialTransaction } from "@/repositories/financeRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/repositories/financeRepository", () => ({
  financeRepository: { listTransactions: vi.fn() },
}));

function makeRow(overrides: Partial<SupabaseFinancialTransaction> = {}): SupabaseFinancialTransaction {
  return {
    id: "sft-1", workspace_id: "ws1", type: "receivable", status: "pending",
    title: "Recebível X", amount: 100, source: "manual", is_demo: false, archived: false,
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
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);
});

describe("useSupabaseFinanceTransactions · leitura opt-in, read-only (Fatia N)", () => {
  it("sem workspace ativo, não dispara fetch nenhum (enabled: !!workspaceId)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: false, error: null,
    } as never);

    renderHook(() => useSupabaseFinanceTransactions(), { wrapper });

    expect(financeRepository.listTransactions).not.toHaveBeenCalled();
  });

  it("carrega e mapeia receitas E despesas juntas pro formato Transaction local", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([
      makeRow({ id: "sft-1", type: "receivable" }),
      makeRow({ id: "sft-2", type: "payable" }),
    ]);

    const { result } = renderHook(() => useSupabaseFinanceTransactions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(financeRepository.listTransactions).toHaveBeenCalledWith("ws1");
    expect(result.current.transactions).toHaveLength(2);
    expect(result.current.transactions.map((t) => t.type)).toEqual(["income", "expense"]);
  });

  it("resolve clientName via useClientsDataSource — mesmo padrão de clientNameById de projects", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{ id: "client-uuid-1", name: "Acme Corp" }],
    } as never);
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([
      makeRow({ client_id: "client-uuid-1" }),
    ]);

    const { result } = renderHook(() => useSupabaseFinanceTransactions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.transactions[0].clientName).toBe("Acme Corp");
  });

  it("erro do repository vira mensagem amigável, nunca quebra o hook", async () => {
    vi.mocked(financeRepository.listTransactions).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSupabaseFinanceTransactions(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.transactions).toEqual([]);
  });
});
