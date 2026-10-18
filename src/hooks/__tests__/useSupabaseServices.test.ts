// G94 / CT1 — hooks de categorias e serviços do catálogo na nuvem. Fatia sem UI/flip: nada consome
// ainda. Prova: leitura mapeada (id uuid, nome da categoria da nuvem), G32 (sem workspace ⇒ nenhuma
// query), G30 (a resposta da própria escrita vai pro cache, sem refetch), G56 (duplicar = linha nova),
// e DEGRADAÇÃO (tabela ausente ⇒ lista vazia + erro legível, nada quebra). Fixtures com uuid real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseServices } from "@/hooks/useSupabaseServices";
import { useSupabaseServiceCategories } from "@/hooks/useSupabaseServiceCategories";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { servicesRepository, type SupabaseService } from "@/repositories/servicesRepository";
import {
  serviceCategoriesRepository,
  type SupabaseServiceCategory,
} from "@/repositories/serviceCategoriesRepository";
import { CatalogUnavailableError } from "@/repositories/catalogRepositoryShared";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/servicesRepository", () => ({
  servicesRepository: { listServices: vi.fn(), importService: vi.fn(), updateService: vi.fn(), softDeleteService: vi.fn() },
}));
vi.mock("@/repositories/serviceCategoriesRepository", () => ({
  serviceCategoriesRepository: {
    listCategories: vi.fn(), importCategory: vi.fn(), updateCategory: vi.fn(), softDeleteCategory: vi.fn(),
  },
}));

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const CAT = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";
const SVC_A = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const SVC_B = "11111111-2222-4333-8444-555555555555";

function svcRow(overrides: Partial<SupabaseService> = {}): SupabaseService {
  return {
    id: SVC_A, workspace_id: WS, category_id: CAT, category: "Branding", name: "Identidade Visual",
    description: "Logo e paleta", price: 3500, billing_type: "único", delivery_days: 15, active: true,
    tags: ["marca"], available_in_quotes: true, show_in_public_catalog: false, notes: null,
    is_demo: false, source_local_id: "native:1", deleted_at: null,
    created_at: "2026-10-17T00:00:00Z", updated_at: "2026-10-17T00:00:00Z", ...overrides,
  };
}

const catRow: SupabaseServiceCategory = {
  id: CAT, workspace_id: WS, name: "Branding (nuvem)", color: "#F81040", is_demo: false,
  source_local_id: "native:c", deleted_at: null, created_at: "2026-10-17T00:00:00Z", updated_at: "2026-10-17T00:00:00Z",
};

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: WS } } as never);
  vi.mocked(servicesRepository.listServices).mockResolvedValue([svcRow()]);
  vi.mocked(serviceCategoriesRepository.listCategories).mockResolvedValue([catRow]);
});

describe("useSupabaseServices — leitura", () => {
  it("devolve serviços mapeados pro shape local: id uuid (string), billingType com acento, nome da categoria da nuvem", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServices(), { wrapper });

    await waitFor(() => expect(result.current.services).toHaveLength(1));

    expect(result.current.services[0]).toMatchObject({
      id: SVC_A, name: "Identidade Visual", billingType: "único", price: 3500, categoryId: CAT,
      category: "Branding (nuvem)", tags: ["marca"],
    });
    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("[G32] sem workspace: nenhuma query dispara (enabled: !!workspaceId)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSupabaseServices(), { wrapper });

    expect(result.current.services).toEqual([]);
    expect(servicesRepository.listServices).not.toHaveBeenCalled();
    expect(serviceCategoriesRepository.listCategories).not.toHaveBeenCalled();
  });
});

describe("degradação — tabela ausente (DDL ainda não aplicado)", () => {
  it("serviços: lista VAZIA + unavailable + erro legível; o hook NÃO lança e a query não repete em loop", async () => {
    vi.mocked(servicesRepository.listServices).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    vi.mocked(serviceCategoriesRepository.listCategories).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSupabaseServices(), { wrapper });

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.services).toEqual([]);
    expect(result.current.error).toMatch(/catálogo na nuvem ainda não está disponível/i);
    expect(servicesRepository.listServices).toHaveBeenCalledTimes(1);
  });

  it("categorias: idem — vazio + erro legível", async () => {
    vi.mocked(serviceCategoriesRepository.listCategories).mockRejectedValue(new CatalogUnavailableError("42P01"));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSupabaseServiceCategories(), { wrapper });

    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.categories).toEqual([]);
    expect(result.current.error).toMatch(/não está disponível/i);
  });

  it("categorias ausentes mas serviços presentes: o rótulo cai no `category` legado (não perde o nome)", async () => {
    vi.mocked(serviceCategoriesRepository.listCategories).mockRejectedValue(new CatalogUnavailableError("42P01"));
    const { wrapper } = makeWrapper();

    const { result } = renderHook(() => useSupabaseServices(), { wrapper });

    await waitFor(() => expect(result.current.services).toHaveLength(1));
    expect(result.current.services[0].category).toBe("Branding");
  });

  it("mutation com tabela ausente lança erro legível (e a lista não muda)", async () => {
    vi.mocked(servicesRepository.importService).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServices(), { wrapper });
    await waitFor(() => expect(result.current.services).toHaveLength(1));

    await expect(
      act(async () => {
        await result.current.createService({
          name: "X", description: "", category: "", price: 1, billingType: "único", deliveryDays: 0, active: true,
        });
      }),
    ).rejects.toThrow(/não está disponível/i);
    expect(result.current.services).toHaveLength(1);
  });
});

describe("useSupabaseServices — escrita (G30/G37/G56)", () => {
  it("[G30] createService: a resposta do INSERT vira o cache — sem refetch da lista; payload completo; source_local_id nativo", async () => {
    vi.mocked(servicesRepository.importService).mockResolvedValue(svcRow({ id: SVC_B, name: "Novo" }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServices(), { wrapper });
    await waitFor(() => expect(result.current.services).toHaveLength(1));

    await act(async () => {
      await result.current.createService({
        name: "Novo", description: "d", category: "Branding", categoryId: CAT, price: 100, billingType: "mensal",
        deliveryDays: 30, active: true, tags: ["x"], availableInQuotes: true, showInPublicCatalog: false, notes: "n",
      });
    });

    const [ws, sourceLocalId, payload] = vi.mocked(servicesRepository.importService).mock.calls[0];
    expect(ws).toBe(WS);
    expect(sourceLocalId).toMatch(/^native:/);
    expect(payload).toMatchObject({ category_id: CAT, billing_type: "mensal", price: 100, tags: ["x"], notes: "n", is_demo: false });
    expect(servicesRepository.listServices).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.services.map((s) => s.id)).toEqual([SVC_B, SVC_A]));
  });

  it("[G30] updateService: só os campos do patch vão; a resposta substitui a linha no cache", async () => {
    vi.mocked(servicesRepository.updateService).mockResolvedValue(svcRow({ price: 150 }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServices(), { wrapper });
    await waitFor(() => expect(result.current.services).toHaveLength(1));

    await act(async () => {
      await result.current.updateService(SVC_A, { price: 150 });
    });

    expect(vi.mocked(servicesRepository.updateService).mock.calls[0]).toEqual([WS, SVC_A, { price: 150 }]);
    expect(servicesRepository.listServices).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.services[0].price).toBe(150));
  });

  it("toggleActive: inverte `active` pelo patch; removeService = soft delete e some da lista", async () => {
    vi.mocked(servicesRepository.updateService).mockResolvedValue(svcRow({ active: false }));
    vi.mocked(servicesRepository.softDeleteService).mockResolvedValue(svcRow({ deleted_at: "2026-10-17T01:00:00Z" }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServices(), { wrapper });
    await waitFor(() => expect(result.current.services).toHaveLength(1));

    await act(async () => { await result.current.toggleActive(SVC_A); });
    expect(vi.mocked(servicesRepository.updateService).mock.calls[0][2]).toEqual({ active: false });
    await waitFor(() => expect(result.current.services[0].active).toBe(false));

    await act(async () => { await result.current.removeService(SVC_A); });
    expect(servicesRepository.softDeleteService).toHaveBeenCalledWith(WS, SVC_A);
    await waitFor(() => expect(result.current.services).toHaveLength(0));
  });

  it("[G56] duplicateService: linha NOVA — nome '(cópia)', source_local_id nativo, nunca upsert sobre a original", async () => {
    vi.mocked(servicesRepository.importService)
      .mockResolvedValueOnce(svcRow({ id: SVC_B, name: "Identidade Visual (cópia)" }));
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServices(), { wrapper });
    await waitFor(() => expect(result.current.services).toHaveLength(1));

    await act(async () => { await result.current.duplicateService(SVC_A); });

    const [, sourceLocalId, payload] = vi.mocked(servicesRepository.importService).mock.calls[0];
    expect(sourceLocalId).toMatch(/^native:/);
    expect(sourceLocalId).not.toBe("native:1"); // ≠ source_local_id da original
    expect(payload).toMatchObject({ name: "Identidade Visual (cópia)", billing_type: "único", price: 3500, category_id: CAT });
    expect(payload).not.toHaveProperty("id");
  });
});

describe("useSupabaseServiceCategories — escrita (G30)", () => {
  it("createCategory: upsert nativo e a resposta vai pro cache; removeCategory = soft delete", async () => {
    vi.mocked(serviceCategoriesRepository.importCategory).mockResolvedValue({ ...catRow, id: SVC_B, name: "Nova" });
    vi.mocked(serviceCategoriesRepository.softDeleteCategory).mockResolvedValue({ ...catRow, deleted_at: "2026-10-17T01:00:00Z" });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSupabaseServiceCategories(), { wrapper });
    await waitFor(() => expect(result.current.categories).toHaveLength(1));

    await act(async () => { await result.current.createCategory({ name: "Nova", color: "#fff" }); });
    expect(vi.mocked(serviceCategoriesRepository.importCategory).mock.calls[0][1]).toMatch(/^native:/);
    expect(serviceCategoriesRepository.listCategories).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.categories.map((c) => c.name)).toEqual(["Nova", "Branding (nuvem)"]));

    await act(async () => { await result.current.removeCategory(CAT); });
    await waitFor(() => expect(result.current.categories.map((c) => c.id)).toEqual([SVC_B]));
  });
});
