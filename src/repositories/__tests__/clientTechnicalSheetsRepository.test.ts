// Etapa 5 · Ficha técnica (teste de fogo do padrão "Espelho Reversível").
// Prova o CONTRATO de idempotência do repository sem tocar a rede: o upsert precisa
// mirar o conflito em `client_id` (casado com o UNIQUE(client_id) da migração
// 20260530020000) para que um segundo import do mesmo cliente vire UPDATE da mesma
// linha — nunca um INSERT duplicado. Também documenta a leitura server-side (point read
// por workspace_id + client_id), invariante (c) do molde.
//
// Ver docs/architecture/espelho-reversivel.md e docs/qa/etapa-5-ficha-tecnica.md.
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock encadeável do supabase-js. vi.hoisted garante que as fns existam antes do
// vi.mock (que é içado para o topo do arquivo).
const mocks = vi.hoisted(() => {
  const upsertSingle = vi.fn();
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));

  const getMaybeSingle = vi.fn();
  const getEqClient = vi.fn(() => ({ maybeSingle: getMaybeSingle }));
  const getEqWorkspace = vi.fn(() => ({ eq: getEqClient }));
  const select = vi.fn(() => ({ eq: getEqWorkspace }));

  const from = vi.fn(() => ({ upsert, select }));
  return { upsertSingle, upsert, getMaybeSingle, getEqClient, getEqWorkspace, select, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clientTechnicalSheetsRepository.upsertTechnicalSheet — contrato de idempotência", () => {
  it("mira o conflito em client_id e escopa a linha para workspace + client", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "sheet-1", client_id: "c1" }, error: null });

    await clientTechnicalSheetsRepository.upsertTechnicalSheet("ws1", "c1", {
      branding: { slogan: "Sempre" },
    });

    expect(mocks.from).toHaveBeenCalledWith("client_technical_sheets");
    // onConflict:"client_id" + UNIQUE(client_id) = repetição vira UPDATE, não duplicata.
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws1",
        client_id: "c1",
        branding: { slogan: "Sempre" },
        updated_at: expect.any(String),
      }),
      { onConflict: "client_id" },
    );
  });

  it("mantém a MESMA chave de conflito em imports repetidos (2x => mesma linha, zero duplicata)", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "sheet-1", client_id: "c1" }, error: null });

    await clientTechnicalSheetsRepository.upsertTechnicalSheet("ws1", "c1", { persona: { name: "A" } });
    await clientTechnicalSheetsRepository.upsertTechnicalSheet("ws1", "c1", { persona: { name: "B" } });

    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    // Idempotência é POR CHAVE (client_id), não por dedupe no app: os dois upserts do
    // mesmo cliente resolvem na mesma linha no banco.
    expect(mocks.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ client_id: "c1" }),
      { onConflict: "client_id" },
    );
    expect(mocks.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ client_id: "c1" }),
      { onConflict: "client_id" },
    );
  });

  it("devolve a linha selecionada após o upsert", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "sheet-9", client_id: "c9" }, error: null });

    const row = await clientTechnicalSheetsRepository.upsertTechnicalSheet("ws1", "c9", {});

    expect(row).toEqual({ id: "sheet-9", client_id: "c9" });
  });
});

describe("clientTechnicalSheetsRepository.getTechnicalSheet — leitura server-side (point read)", () => {
  it("lê UMA linha filtrando por workspace_id + client_id (sem carregar tudo e filtrar)", async () => {
    mocks.getMaybeSingle.mockResolvedValue({ data: { id: "sheet-1", client_id: "c1" }, error: null });

    const row = await clientTechnicalSheetsRepository.getTechnicalSheet("ws1", "c1");

    expect(mocks.from).toHaveBeenCalledWith("client_technical_sheets");
    expect(mocks.select).toHaveBeenCalledWith("*");
    expect(mocks.getEqWorkspace).toHaveBeenCalledWith("workspace_id", "ws1");
    expect(mocks.getEqClient).toHaveBeenCalledWith("client_id", "c1");
    // maybeSingle = point read indexado; nunca um list + filtro no cliente.
    expect(mocks.getMaybeSingle).toHaveBeenCalledTimes(1);
    expect(row).toEqual({ id: "sheet-1", client_id: "c1" });
  });
});
