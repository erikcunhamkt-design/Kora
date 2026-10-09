// Etapa 9 · item 3 — repositório do consentimento: tabela ausente é estado normal
// (migration §8-b pendente), gate do atesto antes de escrever, revogação sem
// apagar a linha.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const eq = vi.fn();
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn();
  const from = vi.fn(() => ({ select, upsert }));
  return { eq, select, upsert, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import {
  aiKnowledgeConsentsRepository,
  isMissingTableError,
  KnowledgeConsentGateError,
} from "@/repositories/aiKnowledgeConsentsRepository";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockResolvedValue({ data: [], error: null });
  mocks.upsert.mockResolvedValue({ error: null });
});

describe("isMissingTableError", () => {
  it("reconhece 42P01, PGRST205 e as mensagens típicas", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingTableError({ message: 'relation "public.ai_knowledge_consents" does not exist' })).toBe(true);
    expect(isMissingTableError({ message: "Could not find the table 'public.ai_knowledge_consents' in the schema cache" })).toBe(true);
  });

  it("outros erros e ausência de erro não são 'tabela ausente'", () => {
    expect(isMissingTableError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });
});

describe("list", () => {
  it("lê as linhas do workspace e devolve available=true", async () => {
    mocks.eq.mockResolvedValue({
      data: [{ category: "catalog", enabled: true, legal_basis_ack: false, revoked_at: null }],
      error: null,
    });
    const state = await aiKnowledgeConsentsRepository.list("ws-1");

    expect(mocks.from).toHaveBeenCalledWith("ai_knowledge_consents");
    expect(mocks.eq).toHaveBeenCalledWith("workspace_id", "ws-1");
    expect(state).toEqual({
      available: true,
      consents: [{ category: "catalog", enabled: true, legalBasisAck: false, revokedAt: null }],
    });
  });

  it("DEGRADAÇÃO: tabela ausente -> available=false, sem lançar", async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { code: "42P01", message: 'relation "x" does not exist' } });
    await expect(aiKnowledgeConsentsRepository.list("ws-1")).resolves.toEqual({ available: false, consents: [] });
  });

  it("outro erro (ex.: RLS) é lançado normalizado, não engolido como 'indisponível'", async () => {
    mocks.eq.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied for table" } });
    await expect(aiKnowledgeConsentsRepository.list("ws-1")).rejects.toBeInstanceOf(Error);
  });
});

describe("setEnabled", () => {
  it("ligar a categoria A: upsert por (workspace, categoria) com autoria e sem atesto", async () => {
    await aiKnowledgeConsentsRepository.setEnabled("ws-1", "catalog", true, "user-1");

    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const [values, options] = mocks.upsert.mock.calls[0] as [Record<string, unknown>, { onConflict: string }];
    expect(options).toEqual({ onConflict: "workspace_id,category" });
    expect(values).toMatchObject({
      workspace_id: "ws-1", category: "catalog", enabled: true, legal_basis_ack: false, enabled_by: "user-1", revoked_at: null,
    });
    expect(typeof values.enabled_at).toBe("string");
  });

  it("desligar: grava enabled=false + revoked_at (nunca apaga a linha)", async () => {
    await aiKnowledgeConsentsRepository.setEnabled("ws-1", "catalog", false, "user-1");

    const [values] = mocks.upsert.mock.calls[0] as [Record<string, unknown>];
    expect(values).toMatchObject({ workspace_id: "ws-1", category: "catalog", enabled: false });
    expect(typeof values.revoked_at).toBe("string");
    expect(values).not.toHaveProperty("enabled_by");
  });

  it("GATE: C/D/E não ligam sem atesto — nem chega a escrever", async () => {
    for (const category of ["crm", "conversations", "financial"] as const) {
      await expect(aiKnowledgeConsentsRepository.setEnabled("ws-1", category, true, "user-1")).rejects.toBeInstanceOf(
        KnowledgeConsentGateError,
      );
    }
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("desligar C/D/E é sempre permitido (revogar nunca é bloqueado pelo atesto)", async () => {
    await expect(aiKnowledgeConsentsRepository.setEnabled("ws-1", "crm", false, "user-1")).resolves.toBeUndefined();
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });

  it("erro de escrita é lançado", async () => {
    mocks.upsert.mockResolvedValue({ error: { code: "42501", message: "new row violates row-level security policy" } });
    await expect(aiKnowledgeConsentsRepository.setEnabled("ws-1", "catalog", true, "user-1")).rejects.toBeInstanceOf(Error);
  });
});
