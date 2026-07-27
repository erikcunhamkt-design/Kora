// Testes do hook useLocalQuotesImport — migrados de Jest para Vitest.
// (Antes: jest.mock + @testing-library/react-hooks, pacote deprecado/não instalado,
//  por isso o arquivo estava em quarentena via vitest.config exclude.)
// Agora: vi.mock + renderHook/act/waitFor do @testing-library/react.
//
// A dedupe (duplicate por code/título/email) e o status "blocked" voltaram a ser
// alcançáveis após o fix no hook (status inicia como "" em vez de "new"), então
// os cenários correspondentes agora são cobertos aqui.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useLocalQuotesImport } from "@/hooks/useLocalQuotesImport";
import { useQuotes, type Quote } from "@/hooks/useQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository, type SupabaseQuote } from "@/repositories/quotesRepository";
import { getInstallId } from "@/lib/installId";
import { emitNotification } from "@/lib/notify";

vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/quotesRepository", () => ({
  quotesRepository: {
    listQuotes: vi.fn(),
    importQuoteWithItems: vi.fn(),
  },
}));
vi.mock("@/lib/notify", () => ({ emitNotification: vi.fn() }));

const META_KEY = "kora.quotes.supabaseImport.v1";

// Mirrors the hook's own local ExtendedLocalQuote/RemoteQuote extensions
// (src/hooks/useLocalQuotesImport.ts) for the dedupe-only fields (code,
// leadId, string clientId) that aren't part of the base Quote type — the
// mocked useQuotes()/quotesRepository still need a cast to the base types
// below, same as the hook casts its own remote rows.
type TestLocalQuote = Omit<Quote, "clientId" | "clientEmail"> & {
  clientId?: string;
  // Optional here (unlike the real Quote type) so the "blocked" test can
  // construct a genuinely incomplete quote missing its email.
  clientEmail?: string;
  code?: string;
  leadId?: string;
};
type TestRemoteQuote = SupabaseQuote & { code?: string };

function makeLocalQuote(overrides: Partial<TestLocalQuote> & { id: string }): TestLocalQuote {
  return {
    clientName: "",
    clientEmail: "",
    clientWhatsapp: "",
    title: "",
    description: "",
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 0,
    status: "rascunho",
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeRemoteQuote(overrides: Partial<TestRemoteQuote> & { id: string }): TestRemoteQuote {
  return {
    workspace_id: "ws1",
    title: "",
    subtotal: 0,
    discount: 0,
    total: 0,
    status: "aprovado",
    archived: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// id "1" casa com o remoto r1 (título+cliente+total) => é duplicado.
// id "3" NÃO tem correspondente remoto => é "new" (usado nos testes de import).
function makeLocalQuotes(): TestLocalQuote[] {
  return [
    makeLocalQuote({ id: "1", title: "Orc 1", clientName: "Cliente A", clientEmail: "a@example.com", total: 100, isDemo: false, clientId: "c1" }),
    makeLocalQuote({ id: "2", title: "Orc 2", clientName: "Cliente B", clientEmail: "b@example.com", total: 200, isDemo: true }), // demo
    makeLocalQuote({ id: "3", title: "Orc 3", clientName: "Cliente C", clientEmail: "c@example.com", total: 150, isDemo: false }),
  ];
}

function makeRemoteQuotes(): TestRemoteQuote[] {
  return [
    makeRemoteQuote({ id: "r1", title: "Orc 1", client_name: "Cliente A", client_email: "a@example.com", total: 100 }),
    makeRemoteQuote({ id: "r2", title: "Orc 4", client_name: "Cliente D", client_email: "d@example.com", total: 300 }),
  ];
}

function mockLocalQuotes(quotes: TestLocalQuote[]) {
  // addQuote/updateStatus/updateQuote/duplicateQuote/deleteQuote/setQuotes are
  // unused by these tests — no-op stubs just to satisfy useQuotes()'s return shape.
  vi.mocked(useQuotes).mockReturnValue({
    quotes: quotes as unknown as Quote[],
    addQuote: vi.fn(),
    updateStatus: vi.fn(),
    updateQuote: vi.fn(),
    duplicateQuote: vi.fn(),
    deleteQuote: vi.fn(),
    setQuotes: vi.fn(),
  });
}

function mockRemoteQuotes(quotes: TestRemoteQuote[]) {
  vi.mocked(quotesRepository.listQuotes).mockResolvedValue(quotes as unknown as SupabaseQuote[]);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mockLocalQuotes(makeLocalQuotes());
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: {
      id: "ws1",
      name: "Test Workspace",
      slug: "test-workspace",
      owner_id: "owner1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      currency: "BRL",
      locale: "pt-BR",
      timezone: null,
    },
    membership: null,
    loading: false,
    error: null,
  });
  mockRemoteQuotes(makeRemoteQuotes());
  vi.mocked(quotesRepository.importQuoteWithItems).mockImplementation(
    async (_ws, _sourceLocalId, quote) => ({
      id: "new-id",
      workspace_id: "ws1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      ...quote,
    }),
  );
});

describe("useLocalQuotesImport", () => {
  it("analisa os orçamentos locais e ignora demos", async () => {
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const ids = result.current.candidates.map((c) => c.localQuote.id);
    expect(ids).toContain("1");
    expect(ids).toContain("3");
    expect(ids).not.toContain("2"); // demo ignorado
  });

  it("analyze não sobrescreve a metadata de import já existente", async () => {
    localStorage.setItem(
      META_KEY,
      JSON.stringify({
        lastImportedAt: "2024-01-01T00:00:00Z",
        importedLocalIds: ["1"],
        skippedLocalIds: [],
        importedMap: { "1": "r1" },
      }),
    );
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const meta = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    expect(meta.importedMap["1"]).toBe("r1"); // preservado
    expect(meta.lastImportedAt).toBe("2024-01-01T00:00:00Z");
  });

  it("classifica como 'imported' o que já está no importedMap (tem prioridade sobre dedupe)", async () => {
    // id "1" está no importedMap E casaria como duplicado; 'imported' vence.
    localStorage.setItem(
      META_KEY,
      JSON.stringify({ lastImportedAt: "", importedLocalIds: [], skippedLocalIds: [], importedMap: { "1": "rX" } }),
    );
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const byId = Object.fromEntries(result.current.candidates.map((c) => [c.localQuote.id, c.status]));
    expect(byId["1"]).toBe("imported");
    expect(byId["3"]).toBe("new");
  });

  it("classifica como 'duplicate' quando casa com o remoto por título+cliente+total", async () => {
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const byId = Object.fromEntries(result.current.candidates.map((c) => [c.localQuote.id, c.status]));
    expect(byId["1"]).toBe("duplicate"); // Orc 1 / Cliente A / 100 == remoto r1
    expect(byId["3"]).toBe("new");
  });

  it("classifica como 'duplicate' quando existe o mesmo code no remoto", async () => {
    const locals = makeLocalQuotes();
    locals[2].code = "CODE123"; // id "3"
    mockLocalQuotes(locals);
    mockRemoteQuotes([
      ...makeRemoteQuotes(),
      makeRemoteQuote({ id: "r3", code: "CODE123", title: "Other", client_name: "X", client_email: "x@x.com", total: 10 }),
    ]);
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const byId = Object.fromEntries(result.current.candidates.map((c) => [c.localQuote.id, c.status]));
    expect(byId["3"]).toBe("duplicate");
  });

  it("classifica como 'blocked' um orçamento sem dados essenciais", async () => {
    const locals = makeLocalQuotes();
    locals[2].clientEmail = undefined; // id "3" sem email
    mockLocalQuotes(locals);
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const byId = Object.fromEntries(result.current.candidates.map((c) => [c.localQuote.id, c.status]));
    expect(byId["3"]).toBe("blocked");
  });

  it("mapeia client_id e opportunity_id a partir dos mapas locais ao chamar o RPC", async () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { c1: "supClient1" } }));
    localStorage.setItem("kora.crm.supabaseImport.v1", JSON.stringify({ importedMap: { lead99: "supOpp99" } }));
    const locals = makeLocalQuotes();
    locals[2].clientId = "c1"; // id "3" (não-duplicado) ganha client + lead p/ o mapeamento
    locals[2].leadId = "lead99";
    mockLocalQuotes(locals);

    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]);
    });

    // Assinatura do RPC: (workspaceId, sourceLocalId, quote, items).
    const call = vi.mocked(quotesRepository.importQuoteWithItems).mock.calls[0];
    const quote = call[2];
    expect(quote.client_id).toBe("supClient1");
    expect(quote.opportunity_id).toBe("supOpp99");
  });

  it("monta source_local_id namespacado por installId ao chamar o RPC (B.3)", async () => {
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]);
    });
    const call = vi.mocked(quotesRepository.importQuoteWithItems).mock.calls[0];
    expect(call[0]).toBe("ws1"); // workspaceId
    expect(call[1]).toBe(`${getInstallId()}:3`); // sourceLocalId = installId:localId
  });

  it("import bem-sucedido (via RPC) registra importedMap + importedLocalIds", async () => {
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]); // id "3" é 'new'
    });
    const meta = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    expect(meta.importedMap["3"]).toBe("new-id");
    expect(meta.importedLocalIds).toContain("3");
  });

  it("reimport de uma quote soft-deleted na nuvem (item 9): avisa, não comemora um sucesso falso", async () => {
    // Etapa 5 · Fatia 10 (item 9, §9 do doc) — a RPC não limpa deleted_at no
    // ON CONFLICT DO UPDATE (decisão deliberada: excluir é ação explícita do
    // usuário, reimport não ressuscita sozinho). O reimport "funciona"
    // (atualiza os campos, grava no importedMap), mas a quote continua
    // invisível — a notificação precisa refletir isso, nunca um "sucesso"
    // puro e simples (lição O2/O3/O4 aplicada a este caso específico).
    vi.mocked(quotesRepository.importQuoteWithItems).mockResolvedValue({
      id: "new-id",
      workspace_id: "ws1",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      title: "Orc 3",
      subtotal: 150,
      discount: 0,
      total: 150,
      status: "draft",
      archived: false,
      deleted_at: "2024-06-01T00:00:00Z",
    } as SupabaseQuote);

    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]);
    });

    // Ainda registra a metadata (o RPC de fato rodou e devolveu um id) —
    // "avisar" não é o mesmo que "tratar como se tivesse falhado".
    const meta = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    expect(meta.importedMap["3"]).toBe("new-id");

    expect(vi.mocked(emitNotification)).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Orçamento reimportado, mas continua excluído",
        type: "warning",
      }),
    );
    expect(vi.mocked(emitNotification)).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: "Orçamento importado", type: "success" }),
    );
  });

  it("falha no RPC marca como skipped e não como imported (nada gravado no map)", async () => {
    vi.mocked(quotesRepository.importQuoteWithItems).mockRejectedValue(new Error("rpc fail"));
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]);
    });
    const meta = JSON.parse(localStorage.getItem(META_KEY) ?? "{}");
    expect(meta.importedMap["3"]).toBeUndefined();
    expect(meta.skippedLocalIds).toContain("3");
  });

  it("preserva quantidade fracionária no payload de itens enviado ao RPC (Q5b)", async () => {
    const locals = makeLocalQuotes();
    locals[2].items = [{ id: "it1", name: "Consultoria", quantity: 1.5, unitPrice: 100 }];
    mockLocalQuotes(locals);
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]);
    });
    const call = vi.mocked(quotesRepository.importQuoteWithItems).mock.calls[0];
    const items = call[3];
    expect(items[0].quantity).toBe(1.5); // NÃO arredonda mais a inteiro (Q5b)
  });

  it("Q4: marca clientOrphan quando o cliente local não está no import-map", async () => {
    const locals = makeLocalQuotes();
    locals[2].clientId = "c-nao-mapeado"; // id "3" (new), sem entrada em kora.clients.supabaseImport.v1
    mockLocalQuotes(locals);
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const c3 = result.current.candidates.find((c) => c.localQuote.id === "3");
    expect(c3!.clientOrphan).toBe(true);
    expect(c3!.money).toBeDefined(); // Q5: relatório monetário sempre presente
  });
});
