// G82 — useSupabaseTechnicalSheet resolvia supabaseClientId só pelo mapa
// local→uuid; com a lista de Clientes em nuvem (id = uuid), a chave nunca
// casava e a query ficava desabilitada. Fixtures com uuid REAL, hook REAL
// (só o repository é mockado).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientTechnicalSheetsRepository", () => ({
  clientTechnicalSheetsRepository: { getTechnicalSheet: vi.fn() },
}));

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: qc }, children);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(clientTechnicalSheetsRepository.getTechnicalSheet).mockResolvedValue(
    { id: "sheet-1", client_id: UUID, workspace_id: "ws1", branding: { slogan: "x" }, created_at: "", updated_at: "" } as never,
  );
});

describe("useSupabaseTechnicalSheet — G82", () => {
  it("cliente com id uuid (lista em nuvem), SEM entrada no mapa legado: resolve o vínculo e busca a ficha com o próprio uuid", async () => {
    const { result } = renderHook(() => useSupabaseTechnicalSheet(UUID), { wrapper });

    expect(result.current.supabaseClientId).toBe(UUID);
    await waitFor(() => expect(result.current.sheet?.id).toBe("sheet-1"));
    expect(clientTechnicalSheetsRepository.getTechnicalSheet).toHaveBeenCalledWith("ws1", UUID);
  });

  it("regressão: id numérico local mapeado continua resolvendo pelo mapa local→uuid", async () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "7": UUID } }));
    const { result } = renderHook(() => useSupabaseTechnicalSheet(7), { wrapper });

    expect(result.current.supabaseClientId).toBe(UUID);
    await waitFor(() => expect(result.current.sheet?.id).toBe("sheet-1"));
    expect(clientTechnicalSheetsRepository.getTechnicalSheet).toHaveBeenCalledWith("ws1", UUID);
  });

  it("regressão: id numérico local NÃO mapeado ⇒ sem vínculo, query desabilitada (nunca usa o id local cru)", () => {
    const { result } = renderHook(() => useSupabaseTechnicalSheet(99), { wrapper });

    expect(result.current.supabaseClientId).toBeNull();
    expect(clientTechnicalSheetsRepository.getTechnicalSheet).not.toHaveBeenCalled();
  });
});
