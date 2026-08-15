// Etapa 9 · item 2 — repository do "Cérebro". Tabela ainda não aplicada
// (migration escrita, não aplicada — ver aiBrainRepository.ts, comentário do
// topo), então este teste prova só o CONTRATO do repository (chamadas certas
// na ordem certa, erro propagado) — não pode provar contra um banco real.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eqWorkspace = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq: eqWorkspace }));

  const upsertSingle = vi.fn();
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));

  const from = vi.fn(() => ({ select, upsert }));
  return { maybeSingle, eqWorkspace, select, upsertSingle, upsertSelect, upsert, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { aiBrainRepository } from "@/repositories/aiBrainRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("aiBrainRepository.getByWorkspace", () => {
  it("busca por workspace_id, devolve null quando não há perfil (maybeSingle)", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await aiBrainRepository.getByWorkspace("ws1");
    expect(mocks.from).toHaveBeenCalledWith("ai_brain_profiles");
    expect(mocks.eqWorkspace).toHaveBeenCalledWith("workspace_id", "ws1");
    expect(result).toBeNull();
  });

  it("devolve o perfil quando existe", async () => {
    const row = {
      id: "p1", workspace_id: "ws1", tone: "formal", talk_about: null,
      dont_talk_about: null, products_services: null, limits: null,
      created_at: "2026-01-01", updated_at: "2026-01-01",
    };
    mocks.maybeSingle.mockResolvedValue({ data: row, error: null });
    const result = await aiBrainRepository.getByWorkspace("ws1");
    expect(result).toEqual(row);
  });

  it("propaga erro normalizado", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: { message: "boom", code: "500" } });
    await expect(aiBrainRepository.getByWorkspace("ws1")).rejects.toThrow();
  });
});

describe("aiBrainRepository.upsert", () => {
  it("faz upsert com workspace_id + os 5 campos, onConflict workspace_id", async () => {
    const row = {
      id: "p1", workspace_id: "ws1", tone: "formal", talk_about: "planos",
      dont_talk_about: "concorrentes", products_services: "consultoria", limits: "não fecha venda",
      created_at: "2026-01-01", updated_at: "2026-01-01",
    };
    mocks.upsertSingle.mockResolvedValue({ data: row, error: null });

    const result = await aiBrainRepository.upsert("ws1", {
      tone: "formal",
      talk_about: "planos",
      dont_talk_about: "concorrentes",
      products_services: "consultoria",
      limits: "não fecha venda",
    });

    expect(mocks.from).toHaveBeenCalledWith("ai_brain_profiles");
    expect(mocks.upsert).toHaveBeenCalledWith(
      {
        workspace_id: "ws1",
        tone: "formal",
        talk_about: "planos",
        dont_talk_about: "concorrentes",
        products_services: "consultoria",
        limits: "não fecha venda",
      },
      { onConflict: "workspace_id" },
    );
    expect(result).toEqual(row);
  });

  it("propaga erro normalizado", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: null, error: { message: "boom", code: "500" } });
    await expect(
      aiBrainRepository.upsert("ws1", {
        tone: null, talk_about: null, dont_talk_about: null, products_services: null, limits: null,
      }),
    ).rejects.toThrow();
  });
});
