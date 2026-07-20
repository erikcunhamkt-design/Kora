// @ts-nocheck
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
import { useQuotes } from "@/hooks/useQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { getInstallId } from "@/lib/installId";

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

// id "1" casa com o remoto r1 (título+cliente+total) => é duplicado.
// id "3" NÃO tem correspondente remoto => é "new" (usado nos testes de import).
function makeLocalQuotes() {
  return [
    { id: "1", title: "Orc 1", clientName: "Cliente A", clientEmail: "a@example.com", total: 100, isDemo: false, clientId: "c1", items: [] },
    { id: "2", title: "Orc 2", clientName: "Cliente B", clientEmail: "b@example.com", total: 200, isDemo: true, items: [] }, // demo
    { id: "3", title: "Orc 3", clientName: "Cliente C", clientEmail: "c@example.com", total: 150, isDemo: false, items: [] },
  ];
}

function makeRemoteQuotes() {
  return [
    { id: "r1", title: "Orc 1", client_name: "Cliente A", client_email: "a@example.com", total: 100 },
    { id: "r2", title: "Orc 4", client_name: "Cliente D", client_email: "d@example.com", total: 300 },
  ];
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useQuotes).mockReturnValue({ quotes: makeLocalQuotes() });
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } });
  vi.mocked(quotesRepository.listQuotes).mockResolvedValue(makeRemoteQuotes());
  vi.mocked(quotesRepository.importQuoteWithItems).mockImplementation(
    async (_ws, _sourceLocalId, quote) => ({ id: "new-id", ...quote }),
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
    const meta = JSON.parse(localStorage.getItem(META_KEY));
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
    vi.mocked(useQuotes).mockReturnValue({ quotes: locals });
    vi.mocked(quotesRepository.listQuotes).mockResolvedValue([
      ...makeRemoteQuotes(),
      { id: "r3", code: "CODE123", title: "Other", client_name: "X", client_email: "x@x.com", total: 10 },
    ]);
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const byId = Object.fromEntries(result.current.candidates.map((c) => [c.localQuote.id, c.status]));
    expect(byId["3"]).toBe("duplicate");
  });

  it("classifica como 'blocked' um orçamento sem dados essenciais", async () => {
    const locals = makeLocalQuotes();
    locals[2].clientEmail = undefined; // id "3" sem email
    vi.mocked(useQuotes).mockReturnValue({ quotes: locals });
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
    vi.mocked(useQuotes).mockReturnValue({ quotes: locals });

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
    const meta = JSON.parse(localStorage.getItem(META_KEY));
    expect(meta.importedMap["3"]).toBe("new-id");
    expect(meta.importedLocalIds).toContain("3");
  });

  it("falha no RPC marca como skipped e não como imported (nada gravado no map)", async () => {
    vi.mocked(quotesRepository.importQuoteWithItems).mockRejectedValue(new Error("rpc fail"));
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    await act(async () => {
      await result.current.importSelected(["3"]);
    });
    const meta = JSON.parse(localStorage.getItem(META_KEY));
    expect(meta.importedMap["3"]).toBeUndefined();
    expect(meta.skippedLocalIds).toContain("3");
  });

  it("preserva quantidade fracionária no payload de itens enviado ao RPC (Q5b)", async () => {
    const locals = makeLocalQuotes();
    locals[2].items = [{ id: "it1", name: "Consultoria", quantity: 1.5, unitPrice: 100 }];
    vi.mocked(useQuotes).mockReturnValue({ quotes: locals });
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
    vi.mocked(useQuotes).mockReturnValue({ quotes: locals });
    const { result } = renderHook(useLocalQuotesImport);
    await waitFor(() => expect(result.current.candidates.length).toBe(2));
    const c3 = result.current.candidates.find((c) => c.localQuote.id === "3");
    expect(c3.clientOrphan).toBe(true);
    expect(c3.money).toBeDefined(); // Q5: relatório monetário sempre presente
  });
});
