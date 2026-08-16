// G60 (docs/architecture/kora-hub-auditoria-e-plano.md) — G30 varrendo as 6
// mutations de useSupabaseQuotes.ts (nenhuma tinha teste próprio nem fix
// antes desta rodada — só era exercitado indiretamente via mocks em
// QuotesSection.test.tsx/SupabaseQuotesViewerCard.test.tsx, que substituem
// o hook inteiro). Mesmo sintoma de G30: mutation só invalidava e esperava
// um refetch; um GET subsequente com qualquer lag reverte o cache pro valor
// antigo até o próximo refetch.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository, type SupabaseQuote, type SupabaseQuoteItem } from "@/repositories/quotesRepository";
import type { Quote, QuoteItem } from "@/hooks/useQuotes";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/quotesRepository", () => ({
  quotesRepository: {
    listQuotes: vi.fn(),
    listQuoteItemsForQuotes: vi.fn(),
    importQuoteWithItems: vi.fn(),
    updateStatus: vi.fn(),
    updateQuote: vi.fn(),
    archiveQuote: vi.fn(),
    softDeleteQuote: vi.fn(),
    replaceQuoteItems: vi.fn(),
  },
}));

function baseSupabaseQuote(overrides: Partial<SupabaseQuote> = {}): SupabaseQuote {
  return {
    id: "sq-1", workspace_id: "ws1", title: "Orçamento A", subtotal: 100, discount: 0, total: 100,
    status: "rascunho", created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    archived: false,
    ...overrides,
  };
}

function baseLocalQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "", clientName: "Cliente X", clientEmail: "", clientWhatsapp: "", title: "Orçamento Novo",
    description: "", items: [], subtotal: 100, discount: 0, total: 100, paymentCondition: "",
    deliveryDeadline: "", validityDays: 0, status: "rascunho", createdAt: "", isDemo: false,
    ...overrides,
  } as Quote;
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
  vi.mocked(quotesRepository.listQuoteItemsForQuotes).mockResolvedValue({});
});

describe("useSupabaseQuotes · G30 (G60) — createQuoteWithItems escreve o cache com a resposta do próprio INSERT", () => {
  it("quotes reflete o orçamento criado mesmo sem nenhum refetch subsequente", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([baseSupabaseQuote({ id: "sq-1" })]);
    vi.mocked(quotesRepository.importQuoteWithItems).mockResolvedValue(
      baseSupabaseQuote({ id: "sq-2", title: "Orçamento Novo" }),
    );

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quotes).toHaveLength(1);

    const item: QuoteItem = { id: "i1", name: "Serviço", quantity: 1, unitPrice: 100 };
    await act(async () => {
      await result.current.createQuoteWithItems(baseLocalQuote(), [item]);
    });

    // listQuotes nunca foi re-chamado pra confirmar a criação — a UI usa a
    // resposta do próprio INSERT (RPC), não um refetch.
    expect(quotesRepository.listQuotes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.quotes.map((q) => q.id)).toContain("sq-2"));
  });

  it("orçamento criado entra com os itens já enviados (RPC devolve só a linha-pai)", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([]);
    vi.mocked(quotesRepository.importQuoteWithItems).mockResolvedValue(baseSupabaseQuote({ id: "sq-2" }));

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const item: QuoteItem = { id: "i1", name: "Serviço", quantity: 2, unitPrice: 50 };
    await act(async () => {
      await result.current.createQuoteWithItems(baseLocalQuote(), [item]);
    });

    await waitFor(() => expect(result.current.quotes[0]?.items).toHaveLength(1));
    expect(result.current.quotes[0]?.items[0]).toMatchObject({ name: "Serviço", quantity: 2, unitPrice: 50 });
  });
});

describe("useSupabaseQuotes · G30 (G60) — mutations de patch (status/update/archive) preservam items e escrevem sem refetch", () => {
  it("updateStatus reflete o status novo sem refetch e preserva os items já carregados", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([baseSupabaseQuote({ id: "sq-1" })]);
    vi.mocked(quotesRepository.listQuoteItemsForQuotes).mockResolvedValue({
      "sq-1": [{ id: "i1", quote_id: "sq-1", name: "Item A", quantity: 1, unit_price: 10, created_at: "", updated_at: "" }],
    });
    vi.mocked(quotesRepository.updateStatus).mockResolvedValue(baseSupabaseQuote({ id: "sq-1", status: "enviado" }));

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quotes[0].items).toHaveLength(1);

    await act(async () => {
      await result.current.updateStatus("sq-1", "enviado");
    });

    expect(quotesRepository.listQuotes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.quotes[0].status).toBe("enviado"));
    // mapSupabaseQuoteToLocalQuote sempre devolve items: [] — a mutation não
    // pode deixar isso vazar pro cache e apagar os itens já carregados.
    expect(result.current.quotes[0].items).toHaveLength(1);
  });

  it("updateQuote (título/descrição) reflete sem refetch", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([baseSupabaseQuote({ id: "sq-1" })]);
    vi.mocked(quotesRepository.updateQuote).mockResolvedValue(baseSupabaseQuote({ id: "sq-1", title: "Título Editado" }));

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateQuote("sq-1", { title: "Título Editado" });
    });

    expect(quotesRepository.listQuotes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.quotes[0].title).toBe("Título Editado"));
  });

  it("archiveQuote reflete sem refetch e preserva as demais linhas do cache", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([
      baseSupabaseQuote({ id: "sq-1" }),
      baseSupabaseQuote({ id: "sq-2" }),
    ]);
    vi.mocked(quotesRepository.archiveQuote).mockResolvedValue(baseSupabaseQuote({ id: "sq-1", archived: true }));

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.archiveQuote("sq-1", true);
    });

    expect(quotesRepository.listQuotes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.quotes.find((q) => q.id === "sq-1")?.status).toBeDefined());
    expect(result.current.quotes).toHaveLength(2);
  });
});

describe("useSupabaseQuotes · G30 (G60) — softDeleteQuote remove a linha do cache (listQuotes filtra deleted_at)", () => {
  it("orçamento excluído some da lista sem refetch", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([
      baseSupabaseQuote({ id: "sq-1" }),
      baseSupabaseQuote({ id: "sq-2" }),
    ]);
    vi.mocked(quotesRepository.softDeleteQuote).mockResolvedValue(baseSupabaseQuote({ id: "sq-1" }));

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.quotes).toHaveLength(2);

    await act(async () => {
      await result.current.softDeleteQuote("sq-1", "motivo");
    });

    expect(quotesRepository.listQuotes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.quotes).toHaveLength(1));
    expect(result.current.quotes[0].id).toBe("sq-2");
  });
});

describe("useSupabaseQuotes · G30 (G60) — replaceQuoteItems substitui só os items, preserva os demais campos", () => {
  it("items refletem os novos sem refetch; título/status da quote ficam intocados", async () => {
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([baseSupabaseQuote({ id: "sq-1", title: "Original" })]);
    const newItems: SupabaseQuoteItem[] = [
      { id: "i-new", quote_id: "sq-1", name: "Item Novo", quantity: 3, unit_price: 20, created_at: "", updated_at: "" },
    ];
    vi.mocked(quotesRepository.replaceQuoteItems).mockResolvedValue(newItems);

    const { result } = renderHook(() => useSupabaseQuotes(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const item: QuoteItem = { id: "tmp", name: "Item Novo", quantity: 3, unitPrice: 20 };
    await act(async () => {
      await result.current.replaceQuoteItems("sq-1", [item]);
    });

    expect(quotesRepository.listQuotes).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.quotes[0].items).toHaveLength(1));
    expect(result.current.quotes[0].items[0]).toMatchObject({ name: "Item Novo", quantity: 3, unitPrice: 20 });
    expect(result.current.quotes[0].title).toBe("Original");
  });
});
