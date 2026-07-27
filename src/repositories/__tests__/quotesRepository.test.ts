// Etapa 5 · Fatia 10 (item 2, Q9 reverso) — prova que updateStatus traduz SEMPRE via
// translateLocalStatusToCloud (quoteMapper.ts), a mesma função usada na leitura — nunca
// um literal hardcoded à parte (era o problema de approveQuote/rejectQuote).
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const updateSingle = vi.fn(() => Promise.resolve({ data: { id: "q1" }, error: null }));
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateEqWorkspace = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqWorkspace }));
  const update = vi.fn(() => ({ eq: updateEqId }));
  const from = vi.fn(() => ({ update }));
  return { update, updateEqId, updateEqWorkspace, updateSelect, updateSingle, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { quotesRepository } from "@/repositories/quotesRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quotesRepository.updateStatus — traduz via translateLocalStatusToCloud", () => {
  it("aprovado -> status 'approved', archived false, approved_at preenchido + rejected_at limpo (paridade com o antigo approveQuote)", async () => {
    await quotesRepository.updateStatus("ws1", "q1", "aprovado");
    expect(mocks.from).toHaveBeenCalledWith("quotes");
    expect(mocks.update).toHaveBeenCalledWith({
      status: "approved",
      archived: false,
      approved_at: expect.any(String),
      rejected_at: null,
    });
  });

  it("recusado -> status 'rejected', archived false, rejected_at preenchido + approved_at limpo (paridade com o antigo rejectQuote)", async () => {
    await quotesRepository.updateStatus("ws1", "q1", "recusado");
    expect(mocks.update).toHaveBeenCalledWith({
      status: "rejected",
      archived: false,
      rejected_at: expect.any(String),
      approved_at: null,
    });
  });

  it("enviado -> status 'sent', archived false", async () => {
    await quotesRepository.updateStatus("ws1", "q1", "enviado");
    expect(mocks.update).toHaveBeenCalledWith({ status: "sent", archived: false });
  });

  it("arquivado -> archived true, status neutro 'draft' (não preserva o status anterior)", async () => {
    await quotesRepository.updateStatus("ws1", "q1", "arquivado");
    expect(mocks.update).toHaveBeenCalledWith({ status: "draft", archived: true });
  });

  it("rascunho (ex.: restaurar) -> status 'draft', archived false", async () => {
    await quotesRepository.updateStatus("ws1", "q1", "rascunho");
    expect(mocks.update).toHaveBeenCalledWith({ status: "draft", archived: false });
  });

  it("qualifica pelo id e pelo workspace, na mesma ordem de updateQuote", async () => {
    await quotesRepository.updateStatus("ws-x", "quote-y", "aprovado");
    expect(mocks.updateEqId).toHaveBeenCalledWith("id", "quote-y");
    expect(mocks.updateEqWorkspace).toHaveBeenCalledWith("workspace_id", "ws-x");
  });
});
