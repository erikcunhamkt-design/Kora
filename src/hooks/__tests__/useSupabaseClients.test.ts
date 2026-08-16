// G60 (docs/architecture/kora-hub-auditoria-e-plano.md) — G30 nas 4 mutations de
// useSupabaseClients.ts (transferido de volta pra Lane D — pacote Clientes da Lane C é
// doc-only, não toca este arquivo). Mesmo molde de useSupabaseProjects.test.ts/
// useSupabaseFinanceTransactions.test.ts: cada mutation deve gravar a resposta da
// própria escrita no cache via setQueryData, nunca depender de invalidate()+refetch.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientsRepository } from "@/repositories/clientsRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientsRepository", () => ({
  clientsRepository: {
    listClients: vi.fn(),
    createClient: vi.fn(),
    updateClient: vi.fn(),
    archiveClient: vi.fn(),
    deleteClient: vi.fn(),
  },
}));

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sc-1", workspace_id: "ws1", name: "Cliente A", archived: false,
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
});

describe("useSupabaseClients · G30 (G60) — addClient escreve o cache com a resposta do próprio INSERT", () => {
  it("clients reflete o cliente criado mesmo sem nenhum refetch subsequente", async () => {
    vi.mocked(clientsRepository.listClients).mockResolvedValue([baseRow({ id: "sc-1" })] as never);
    vi.mocked(clientsRepository.createClient).mockResolvedValue(baseRow({ id: "sc-2", name: "Cliente Novo" }) as never);

    const { result } = renderHook(() => useSupabaseClients(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clients).toHaveLength(1);

    await act(async () => {
      await result.current.addClient({ name: "Cliente Novo" });
    });

    // listClients nunca foi re-chamado pra confirmar a criação — a UI usa a
    // resposta do próprio INSERT, não um refetch.
    expect(clientsRepository.listClients).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.clients.map((c) => c.id)).toContain("sc-2"));
    expect(result.current.clients).toHaveLength(2);
  });

  it("cliente criado aparece primeiro na lista (mais recente primeiro)", async () => {
    vi.mocked(clientsRepository.listClients).mockResolvedValue([baseRow({ id: "sc-1" })] as never);
    vi.mocked(clientsRepository.createClient).mockResolvedValue(baseRow({ id: "sc-2" }) as never);

    const { result } = renderHook(() => useSupabaseClients(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addClient({ name: "Cliente Novo" });
    });

    await waitFor(() => expect(result.current.clients[0]?.id).toBe("sc-2"));
  });
});

describe("useSupabaseClients · G30 (G60) — updateClient/archiveClient escrevem sem refetch", () => {
  it("updateClient reflete sem refetch e preserva as demais linhas do cache", async () => {
    vi.mocked(clientsRepository.listClients).mockResolvedValue([
      baseRow({ id: "sc-1", name: "A" }),
      baseRow({ id: "sc-2", name: "B" }),
    ] as never);
    vi.mocked(clientsRepository.updateClient).mockResolvedValue(baseRow({ id: "sc-1", name: "A Editado" }) as never);

    const { result } = renderHook(() => useSupabaseClients(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateClient("sc-1", { name: "A Editado" });
    });

    expect(clientsRepository.listClients).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.clients.find((c) => c.id === "sc-1")?.name).toBe("A Editado"));
    expect(result.current.clients).toHaveLength(2);
    expect(result.current.clients.find((c) => c.id === "sc-2")?.name).toBe("B");
  });

  it("archiveClient atualiza a linha in-place — cliente arquivado continua na lista (listClients não filtra archived)", async () => {
    vi.mocked(clientsRepository.listClients).mockResolvedValue([baseRow({ id: "sc-1", archived: false })] as never);
    vi.mocked(clientsRepository.archiveClient).mockResolvedValue(baseRow({ id: "sc-1", archived: true }) as never);

    const { result } = renderHook(() => useSupabaseClients(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.archiveClient("sc-1", true);
    });

    expect(clientsRepository.listClients).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.clients.find((c) => c.id === "sc-1")?.archived).toBe(true));
    expect(result.current.clients).toHaveLength(1);
  });
});

describe("useSupabaseClients · G30 (G60) — deleteClient remove do cache pelo id de entrada (hard delete devolve só true)", () => {
  it("cliente excluído some da lista sem refetch", async () => {
    vi.mocked(clientsRepository.listClients).mockResolvedValue([
      baseRow({ id: "sc-1" }),
      baseRow({ id: "sc-2" }),
    ] as never);
    vi.mocked(clientsRepository.deleteClient).mockResolvedValue(true);

    const { result } = renderHook(() => useSupabaseClients(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.clients).toHaveLength(2);

    await act(async () => {
      await result.current.deleteClient("sc-1");
    });

    expect(clientsRepository.listClients).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.clients).toHaveLength(1));
    expect(result.current.clients[0].id).toBe("sc-2");
  });
});
