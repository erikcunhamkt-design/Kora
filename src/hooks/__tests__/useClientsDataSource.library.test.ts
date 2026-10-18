// G94 · M2 — leitura ponta a ponta da Biblioteca do cliente via
// useClientsDataSource: mapCloudLibraryAssets + withLocalLibrary compostos
// (mapper + precedência), não testados isoladamente. Fixtures com uuid real
// (classe G67/G82).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useClients } from "@/hooks/useClients";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { writeClientLibrary } from "@/services/clients/clientLibraryLocalStore";
import type { ClientAsset } from "@/types/domain";

vi.mock("@/hooks/useClients", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClients")>("@/hooks/useClients");
  return { ...actual, useClients: vi.fn() };
});
vi.mock("@/hooks/useSupabaseClients", () => ({ useSupabaseClients: vi.fn() }));

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

function asset(id: string, title = id): ClientAsset {
  return {
    id, title, type: "drive", url: `https://example.com/${id}`, accessStatus: "liberado",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  } as ClientAsset;
}

function setup(cloudRow: Record<string, unknown>) {
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useSupabaseClients).mockReturnValue({
    workspace: { id: "ws1" }, workspaceLoading: false, clients: [cloudRow], loading: false, error: null,
    addClient: vi.fn(), updateClient: vi.fn(), updateClientLibrary: vi.fn(), archiveClient: vi.fn(),
    deleteClient: vi.fn(), refreshClients: vi.fn(),
  } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useClientsDataSource · precedência de leitura da Biblioteca (G94/M2)", () => {
  it("coluna library_assets presente e preenchida na nuvem: vence, mesmo com store M0 divergente", () => {
    writeClientLibrary(UUID, [asset("m0-1", "Do store M0")]);
    setup({ id: UUID, name: "Cliente", library_assets: [asset("cloud-1", "Da nuvem")] });

    const { result } = renderHook(() => useClientsDataSource());

    expect(result.current.clients[0].assets?.map((a) => a.title)).toEqual(["Da nuvem"]);
  });

  it("coluna existe mas vazia ([]): terminal, NÃO ressuscita o store M0 (usuário esvaziou de propósito)", () => {
    writeClientLibrary(UUID, [asset("m0-1", "Do store M0")]);
    setup({ id: UUID, name: "Cliente", library_assets: [] });

    const { result } = renderHook(() => useClientsDataSource());

    expect(result.current.clients[0].assets).toEqual([]);
  });

  it("coluna AUSENTE da linha (schema pendente): cai pro store M0, comportamento de hoje preservado", () => {
    writeClientLibrary(UUID, [asset("m0-1", "Do store M0")]);
    setup({ id: UUID, name: "Cliente" }); // sem library_assets

    const { result } = renderHook(() => useClientsDataSource());

    expect(result.current.clients[0].assets?.map((a) => a.title)).toEqual(["Do store M0"]);
  });

  it("coluna ausente E sem nada no store M0: sem Biblioteca, sem quebrar", () => {
    setup({ id: UUID, name: "Cliente" });

    const { result } = renderHook(() => useClientsDataSource());

    expect(result.current.clients[0].assets).toBeUndefined();
  });

  it("item inválido na coluna da nuvem (sem title) é descartado, válidos ficam (roundtrip)", () => {
    setup({
      id: UUID, name: "Cliente",
      library_assets: [asset("cloud-1", "Válido"), { id: "x", url: "https://x.com" }],
    });

    const { result } = renderHook(() => useClientsDataSource());

    expect(result.current.clients[0].assets?.map((a) => a.title)).toEqual(["Válido"]);
  });
});
