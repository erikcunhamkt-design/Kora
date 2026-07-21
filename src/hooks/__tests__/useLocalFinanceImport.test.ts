// Etapa 5 · Fatia 6 (finance) — testes do hook: candidatos (demo ignorado, órfãs
// calculadas), map gravado SÓ APÓS sucesso, e isolamento de erro entre candidatos.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useLocalFinanceImport } from "@/hooks/useLocalFinanceImport";
import { useFinance } from "@/hooks/useFinance";
import { useQuotes } from "@/hooks/useQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository } from "@/repositories/financeRepository";
import { getInstallId } from "@/lib/installId";

vi.mock("@/hooks/useFinance", () => ({ useFinance: vi.fn() }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/financeRepository", () => ({
  financeRepository: { importTransaction: vi.fn() },
}));
vi.mock("@/lib/notify", () => ({ emitNotification: vi.fn() }));

const META_KEY = "kora.finance.supabaseImport.v1";

function makeLocalTransactions() {
  return [
    {
      id: "tx-1", type: "expense", title: "Adobe", amount: 290, category: "Ferramentas",
      dueDate: "2026-08-01", status: "pending", paymentMethod: "card", recurrence: "none",
      source: "manual", createdAt: "2026-07-01T00:00:00Z", isDemo: false,
    },
    {
      id: "tx-2", type: "income", title: "Demo", amount: 100, category: "Serviços",
      dueDate: "2026-08-01", status: "pending", paymentMethod: "pix", recurrence: "none",
      source: "manual", createdAt: "2026-06-01T00:00:00Z", isDemo: true, // deve ser ignorada
    },
    {
      id: "tx-3", type: "income", title: "Recebível X", amount: 100, category: "Serviços",
      clientId: 999, quoteId: "qt-desconhecida", opportunityId: 999, // órfãs de propósito
      dueDate: "2026-08-01", status: "pending", paymentMethod: "pix", recurrence: "none",
      source: "quote", createdAt: "2026-07-02T00:00:00Z", isDemo: false,
    },
    {
      id: "tx-4", type: "expense", title: "Já importada", amount: 50, category: "Ferramentas",
      dueDate: "2026-08-01", status: "pending", paymentMethod: "card", recurrence: "none",
      source: "manual", createdAt: "2026-06-15T00:00:00Z", isDemo: false,
    },
  ];
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useFinance).mockReturnValue({ transactions: makeLocalTransactions() } as never);
  vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  // tx-4 já foi importada numa rodada anterior
  localStorage.setItem(META_KEY, JSON.stringify({
    lastImportedAt: "2026-07-01T00:00:00Z",
    importedLocalIds: ["tx-4"],
    skippedLocalIds: [],
    importedMap: { "tx-4": "cloud-uuid-tx-4" },
  }));
});

describe("useLocalFinanceImport — candidatos", () => {
  it("ignora transações demo e classifica new/imported corretamente", async () => {
    const { result } = renderHook(() => useLocalFinanceImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const ids = result.current.candidates.map((c) => c.localTransaction.id);
    expect(ids).not.toContain("tx-2"); // demo, ignorada
    expect(ids).toEqual(["tx-1", "tx-3", "tx-4"]);

    const tx4 = result.current.candidates.find((c) => c.localTransaction.id === "tx-4");
    expect(tx4?.status).toBe("imported");
    const tx1 = result.current.candidates.find((c) => c.localTransaction.id === "tx-1");
    expect(tx1?.status).toBe("new");
  });

  it("calcula clientOrphan/quoteOrphan/opportunityOrphan quando os ids locais não estão mapeados", async () => {
    const { result } = renderHook(() => useLocalFinanceImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    const tx3 = result.current.candidates.find((c) => c.localTransaction.id === "tx-3");
    expect(tx3?.clientOrphan).toBe(true);
    expect(tx3?.quoteOrphan).toBe(true);
    expect(tx3?.opportunityOrphan).toBe(true);
  });
});

describe("useLocalFinanceImport — importSelected grava o map SÓ APÓS sucesso", () => {
  it("sucesso: grava importedMap com o id retornado pela nuvem", async () => {
    vi.mocked(financeRepository.importTransaction).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalFinanceImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["tx-1"]);
    });

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["tx-1"]).toBe("cloud-uuid-novo");
  });

  it("monta source_local_id namespacado por installId ao chamar o repository", async () => {
    vi.mocked(financeRepository.importTransaction).mockResolvedValue({ id: "cloud-uuid-novo" } as never);

    const { result } = renderHook(() => useLocalFinanceImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    await act(async () => {
      await result.current.importSelected(["tx-1"]);
    });

    const call = vi.mocked(financeRepository.importTransaction).mock.calls[0];
    expect(call[0]).toBe("ws1");
    expect(call[1]).toBe(`${getInstallId()}:tx-1`);
  });

  it("falha: NÃO grava importedMap, e o erro de um candidato não afeta o outro", async () => {
    vi.mocked(financeRepository.importTransaction).mockImplementation(async (_ws, _sourceLocalId, input) => {
      if (input.title === "Adobe") throw new Error("network down");
      return { id: "cloud-uuid-ok" } as never;
    });

    const { result } = renderHook(() => useLocalFinanceImport());
    await waitFor(() => expect(result.current.candidates.length).toBeGreaterThan(0));

    let importResult;
    await act(async () => {
      importResult = await result.current.importSelected(["tx-1", "tx-3"]);
    });

    expect(importResult.successIds).toEqual(["tx-3"]);
    expect(importResult.failedIds).toEqual(["tx-1"]);

    const meta = JSON.parse(localStorage.getItem(META_KEY) || "{}");
    expect(meta.importedMap["tx-1"]).toBeUndefined(); // falhou, nada gravado
    expect(meta.importedMap["tx-3"]).toBe("cloud-uuid-ok"); // sucesso, gravado
  });
});
