// G94 · M1 — clientsRepository.updateClientLibrary: grava library_assets
// quando a coluna existe; sobe LibraryUnavailableError quando a coluna
// ainda não existe (schema pendente) em vez do erro genérico do Postgres.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eqWorkspace = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorkspace }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return { single, select, eqWorkspace, eqId, update, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { clientsRepository } from "@/repositories/clientsRepository";
import { isLibraryUnavailable } from "@/repositories/clientLibraryRepositoryShared";

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const ASSET = {
  id: "87ebd1d2-0000-0000-0000-000000000001", title: "Drive", type: "drive",
  url: "https://drive.example.com", accessStatus: "liberado",
  createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("clientsRepository.updateClientLibrary", () => {
  it("coluna existe: grava e devolve a linha atualizada (uuid real)", async () => {
    mocks.single.mockResolvedValue({ data: { id: UUID, library_assets: [ASSET] }, error: null });

    const result = await clientsRepository.updateClientLibrary("ws1", UUID, [ASSET]);

    expect(mocks.from).toHaveBeenCalledWith("clients");
    expect(mocks.update).toHaveBeenCalledWith({ library_assets: [ASSET] });
    expect(mocks.eqId).toHaveBeenCalledWith("id", UUID);
    expect(mocks.eqWorkspace).toHaveBeenCalledWith("workspace_id", "ws1");
    expect(result).toEqual({ id: UUID, library_assets: [ASSET] });
  });

  it("coluna AUSENTE (PGRST204): sobe LibraryUnavailableError, não o erro genérico", async () => {
    mocks.single.mockResolvedValue({
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'library_assets' column of 'clients' in the schema cache" },
    });

    expect.assertions(1);
    try {
      await clientsRepository.updateClientLibrary("ws1", UUID, [ASSET]);
    } catch (err) {
      expect(isLibraryUnavailable(err)).toBe(true);
    }
  });

  it("outro erro (ex.: permissão) vira AppError normalizado, NÃO LibraryUnavailableError", async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });

    expect.assertions(1);
    try {
      await clientsRepository.updateClientLibrary("ws1", UUID, [ASSET]);
    } catch (err) {
      expect(isLibraryUnavailable(err)).toBe(false);
    }
  });
});
