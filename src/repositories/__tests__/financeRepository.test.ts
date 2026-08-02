// Etapa 5 · Fatia 6 (finance) — prova a GUARDA de source_local_id e a ÁRVORE DE
// DECISÃO de importTransaction (docs/qa/etapa-5-fatia-6-finance.md §6): transação
// quote-linked usa o contrato de negócio já existente (findReceivableByQuote/
// createReceivableFromQuote, Etapa 3); qualquer outra usa o upsert geral, novo,
// não-parcial. Os dois nunca competem pela mesma operação.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const upsertSingle = vi.fn();
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));

  const updateSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEqWorkspace = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqWorkspace }));
  const update = vi.fn(() => ({ eq: updateEqId }));

  // Chain for listReceivables: select("*").eq(workspace).eq(type).is(deleted_at).order(...)
  const listOrder = vi.fn();
  const listIs = vi.fn(() => ({ order: listOrder }));
  const listEqType = vi.fn(() => ({ is: listIs }));
  const listEqWorkspace = vi.fn(() => ({ eq: listEqType }));
  const select = vi.fn(() => ({ eq: listEqWorkspace }));

  const from = vi.fn(() => ({ upsert, update, select }));
  return {
    upsertSingle, upsert, upsertSelect,
    updateSingle, update, updateSelect, updateEqId, updateEqWorkspace,
    select, listEqWorkspace, listEqType, listIs, listOrder,
    from,
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { financeRepository } from "@/repositories/financeRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("financeRepository.importTransaction — guarda de source_local_id (código, não só o índice)", () => {
  it("rejeita source_local_id vazio ANTES de qualquer chamada ao banco", async () => {
    await expect(
      financeRepository.importTransaction("ws1", "", { type: "expense", source: "manual" }),
    ).rejects.toThrow(/source_local_id/);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejeita source_local_id só com espaços em branco", async () => {
    await expect(
      financeRepository.importTransaction("ws1", "   ", { type: "expense", source: "manual" }),
    ).rejects.toThrow(/source_local_id/);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("financeRepository.importTransaction — árvore de decisão: caminho GERAL", () => {
  it("transação sem fan-in de quote usa upsert(onConflict: workspace_id,source_local_id)", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "tx-1" }, error: null });

    await financeRepository.importTransaction("ws1", "install-x:tx-local-1", {
      type: "payable",
      source: "manual",
      title: "Adobe Creative Cloud",
      amount: 290,
    });

    expect(mocks.from).toHaveBeenCalledWith("financial_transactions");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws1",
        source_local_id: "install-x:tx-local-1",
        type: "payable",
        source: "manual",
      }),
      { onConflict: "workspace_id,source_local_id" },
    );
  });

  it("receivable SEM quote_id também usa o caminho geral (não é quote-linked de verdade)", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "tx-2" }, error: null });

    await financeRepository.importTransaction("ws1", "install-x:tx-local-2", {
      type: "receivable",
      source: "quote",
      quote_id: null,
      title: "Sem quote de verdade",
      amount: 50,
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source_local_id: "install-x:tx-local-2" }),
      { onConflict: "workspace_id,source_local_id" },
    );
  });
});

describe("financeRepository.importTransaction — árvore de decisão: caminho QUOTE-LINKED", () => {
  it("type=receivable + source=quote + quote_id resolvido: usa findReceivableByQuote, NUNCA upsert(onConflict)", async () => {
    const findSpy = vi.spyOn(financeRepository, "findReceivableByQuote").mockResolvedValue([]);
    const createSpy = vi.spyOn(financeRepository, "createReceivableFromQuote")
      .mockResolvedValue({ id: "ft-novo" } as never);

    await financeRepository.importTransaction("ws1", "install-x:tx-local-3", {
      type: "receivable",
      source: "quote",
      quote_id: "quote-uuid-1",
      title: "Recebível ligado a quote",
      amount: 100,
    });

    expect(findSpy).toHaveBeenCalledWith("ws1", "quote-uuid-1");
    expect(createSpy).toHaveBeenCalledWith(
      "ws1",
      expect.objectContaining({ quote_id: "quote-uuid-1", source_local_id: "install-x:tx-local-3" }),
    );
    // O índice geral NUNCA é usado nesta linha — é o contrato de negócio da Etapa 3 que decide.
    expect(mocks.upsert).not.toHaveBeenCalled();

    findSpy.mockRestore();
    createSpy.mockRestore();
  });

  it("recebível JÁ existente para a mesma quote: reconhece via findReceivableByQuote, faz backfill do source_local_id, NUNCA duplica", async () => {
    const findSpy = vi.spyOn(financeRepository, "findReceivableByQuote").mockResolvedValue([
      { id: "ft-existente", quote_id: "quote-uuid-1", source_local_id: null } as never,
    ]);
    const createSpy = vi.spyOn(financeRepository, "createReceivableFromQuote");
    mocks.updateSingle.mockResolvedValue({
      data: { id: "ft-existente", source_local_id: "install-x:tx-local-4" },
      error: null,
    });

    const result = await financeRepository.importTransaction("ws1", "install-x:tx-local-4", {
      type: "receivable",
      source: "quote",
      quote_id: "quote-uuid-1",
      title: "Recebível duplicado (tentativa)",
      amount: 100,
    });

    expect(createSpy).not.toHaveBeenCalled(); // nunca cria um segundo recebível pra mesma quote
    expect(mocks.update).toHaveBeenCalledWith({ source_local_id: "install-x:tx-local-4" });
    expect(mocks.updateEqId).toHaveBeenCalledWith("id", "ft-existente");
    expect(result).toEqual({ id: "ft-existente", source_local_id: "install-x:tx-local-4" });

    findSpy.mockRestore();
  });

  it("recebível já existente E já com source_local_id: devolve sem tocar o banco de novo (idempotente)", async () => {
    const findSpy = vi.spyOn(financeRepository, "findReceivableByQuote").mockResolvedValue([
      { id: "ft-existente", quote_id: "quote-uuid-1", source_local_id: "install-x:outro-local-id" } as never,
    ]);

    const result = await financeRepository.importTransaction("ws1", "install-x:tx-local-5", {
      type: "receivable",
      source: "quote",
      quote_id: "quote-uuid-1",
      title: "Reimport idempotente",
      amount: 100,
    });

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(result).toEqual({ id: "ft-existente", quote_id: "quote-uuid-1", source_local_id: "install-x:outro-local-id" });

    findSpy.mockRestore();
  });
});

// G20 — listReceivables devolvia recebíveis E pagáveis misturados (nenhum filtro de
// `type`); SupabaseOperationalDashboardCard somava os dois como "Recebíveis". Ver
// docs/architecture/kora-hub-auditoria-e-plano.md.
describe("financeRepository.listReceivables — filtra por type (G20)", () => {
  it("consulta financial_transactions com type=receivable, nunca devolvendo pagáveis junto", async () => {
    mocks.listOrder.mockResolvedValue({
      data: [{ id: "ft-1", type: "receivable", status: "pending", amount: 100 }],
      error: null,
    });

    const result = await financeRepository.listReceivables("ws1");

    expect(mocks.from).toHaveBeenCalledWith("financial_transactions");
    expect(mocks.select).toHaveBeenCalledWith("*");
    expect(mocks.listEqWorkspace).toHaveBeenCalledWith("workspace_id", "ws1");
    expect(mocks.listEqType).toHaveBeenCalledWith("type", "receivable");
    expect(mocks.listIs).toHaveBeenCalledWith("deleted_at", null);
    expect(result).toEqual([{ id: "ft-1", type: "receivable", status: "pending", amount: 100 }]);
  });
});
