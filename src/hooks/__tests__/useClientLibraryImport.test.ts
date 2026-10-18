// G94 · M3 — import do store M0 → clients.library_assets. Candidatos,
// idempotência (reexecutar não duplica/sobrescreve), schema pendente, limite
// de 200 itens. uuid real (classe G67/G82).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClientLibraryImport } from "@/hooks/useClientLibraryImport";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { clientsRepository } from "@/repositories/clientsRepository";
import { LibraryUnavailableError } from "@/repositories/clientLibraryRepositoryShared";
import { writeClientLibrary } from "@/services/clients/clientLibraryLocalStore";
import { CLIENT_LIBRARY_MAX_ITEMS } from "@/services/clients/clientLibraryMapper";
import type { ClientAsset } from "@/types/domain";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useSupabaseClients", () => ({ useSupabaseClients: vi.fn() }));
vi.mock("@/repositories/clientsRepository", () => ({
  clientsRepository: { updateClientLibrary: vi.fn() },
}));

const UUID_A = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const UUID_B = "11111111-2222-4333-8444-555555555555";

function asset(id: string, title = id): ClientAsset {
  return {
    id, title, type: "drive", url: `https://example.com/${id}`, accessStatus: "liberado",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  } as ClientAsset;
}

function setup(cloudClients: Record<string, unknown>[], refreshClients = vi.fn()) {
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(useSupabaseClients).mockReturnValue({ clients: cloudClients, refreshClients } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useClientLibraryImport · candidatos", () => {
  it("cliente com M0 preenchido e nuvem vazia é candidato", () => {
    writeClientLibrary(UUID_A, [asset("m0-1")]);
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [] }]);

    const { result } = renderHook(() => useClientLibraryImport());

    expect(result.current.candidates).toEqual([{ clientId: UUID_A, clientName: "Cliente A", assetCount: 1 }]);
  });

  it("cliente com M0 preenchido mas nuvem JÁ TEM itens: NÃO é candidato (nunca sobrescreve)", () => {
    writeClientLibrary(UUID_A, [asset("m0-1")]);
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [asset("cloud-1")] }]);

    const { result } = renderHook(() => useClientLibraryImport());

    expect(result.current.candidates).toEqual([]);
  });

  it("cliente sem nada no M0: nunca é candidato", () => {
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [] }]);

    const { result } = renderHook(() => useClientLibraryImport());

    expect(result.current.candidates).toEqual([]);
  });

  it("coluna ausente na linha da nuvem (schema pendente) com M0 preenchido: ainda é candidato (tentativa decide o resultado)", () => {
    writeClientLibrary(UUID_A, [asset("m0-1")]);
    setup([{ id: UUID_A, name: "Cliente A" }]); // sem library_assets

    const { result } = renderHook(() => useClientLibraryImport());

    expect(result.current.candidates).toEqual([{ clientId: UUID_A, clientName: "Cliente A", assetCount: 1 }]);
  });
});

describe("useClientLibraryImport · importSelected", () => {
  it("importa com sucesso: chama updateClientLibrary com os itens do M0, conta no relatório", async () => {
    writeClientLibrary(UUID_A, [asset("m0-1")]);
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [] }]);
    vi.mocked(clientsRepository.updateClientLibrary).mockResolvedValue({ id: UUID_A } as never);

    const { result } = renderHook(() => useClientLibraryImport());
    let report;
    await act(async () => { report = await result.current.importSelected([UUID_A]); });

    expect(clientsRepository.updateClientLibrary).toHaveBeenCalledWith("ws1", UUID_A, [asset("m0-1")]);
    expect(report).toEqual({ imported: [{ clientId: UUID_A, clientName: "Cliente A", assetCount: 1 }], failed: [] });
  });

  it("schema pendente (LibraryUnavailableError): conta como falha, sinaliza schemaPending", async () => {
    writeClientLibrary(UUID_A, [asset("m0-1")]);
    setup([{ id: UUID_A, name: "Cliente A" }]);
    vi.mocked(clientsRepository.updateClientLibrary).mockRejectedValue(new LibraryUnavailableError());

    const { result } = renderHook(() => useClientLibraryImport());
    await act(async () => { await result.current.importSelected([UUID_A]); });

    expect(result.current.schemaPending).toBe(true);
    expect(result.current.report?.failed).toEqual([{ clientId: UUID_A, clientName: "Cliente A", reason: "schema pendente" }]);
    expect(result.current.report?.imported).toEqual([]);
  });

  it("idempotente: 2ª chamada pro MESMO cliente não o torna candidato de novo (nuvem já tem itens após a 1ª)", async () => {
    writeClientLibrary(UUID_A, [asset("m0-1")]);
    const refreshClients = vi.fn();
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [] }], refreshClients);
    vi.mocked(clientsRepository.updateClientLibrary).mockResolvedValue({ id: UUID_A } as never);

    const { result, rerender } = renderHook(() => useClientLibraryImport());
    await act(async () => { await result.current.importSelected([UUID_A]); });
    expect(clientsRepository.updateClientLibrary).toHaveBeenCalledTimes(1);

    // Simula o refetch pós-import: a nuvem agora devolve library_assets preenchido.
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [asset("m0-1")] }], refreshClients);
    rerender();

    expect(result.current.candidates).toEqual([]);

    // Reimportar (ex.: o usuário clica de novo) com a mesma seleção não chama o repository outra vez,
    // porque o cliente não está mais na lista de candidatos.
    await act(async () => { await result.current.importSelected([UUID_A]); });
    expect(clientsRepository.updateClientLibrary).toHaveBeenCalledTimes(1);
  });

  it("limite de 200 itens: candidato com M0 acima do limite falha com motivo claro, não grava", async () => {
    const tooMany = Array.from({ length: CLIENT_LIBRARY_MAX_ITEMS + 1 }, (_, i) => asset(`m0-${i}`));
    writeClientLibrary(UUID_A, tooMany);
    setup([{ id: UUID_A, name: "Cliente A", library_assets: [] }]);

    const { result } = renderHook(() => useClientLibraryImport());
    let report;
    await act(async () => { report = await result.current.importSelected([UUID_A]); });

    expect(clientsRepository.updateClientLibrary).not.toHaveBeenCalled();
    expect(report).toEqual({
      imported: [],
      failed: [{ clientId: UUID_A, clientName: "Cliente A", reason: `excede ${CLIENT_LIBRARY_MAX_ITEMS} itens` }],
    });
  });

  it("2 clientes, 1 falha e 1 sucede: relatório reflete os dois independentemente", async () => {
    writeClientLibrary(UUID_A, [asset("m0-a")]);
    writeClientLibrary(UUID_B, [asset("m0-b")]);
    setup([
      { id: UUID_A, name: "Cliente A", library_assets: [] },
      { id: UUID_B, name: "Cliente B", library_assets: [] },
    ]);
    vi.mocked(clientsRepository.updateClientLibrary).mockImplementation((_ws, clientId) =>
      clientId === UUID_A ? Promise.resolve({ id: UUID_A } as never) : Promise.reject(new Error("network down")),
    );

    const { result } = renderHook(() => useClientLibraryImport());
    let report;
    await act(async () => { report = await result.current.importSelected([UUID_A, UUID_B]); });

    expect(report).toEqual({
      imported: [{ clientId: UUID_A, clientName: "Cliente A", assetCount: 1 }],
      failed: [{ clientId: UUID_B, clientName: "Cliente B", reason: "network down" }],
    });
  });
});
