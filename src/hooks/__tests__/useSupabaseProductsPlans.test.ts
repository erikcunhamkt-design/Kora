// G94 / CT2 — hooks de produtos e planos comerciais na nuvem. Sem UI/flip: nada consome ainda.
// Prova: leitura mapeada (id uuid, itens de plano uuid), G32 (sem workspace ⇒ nenhuma query),
// G30 (resposta da escrita no cache, sem refetch), G56 (source_local_id nativo), descarte de itens de
// plano contado, e DEGRADAÇÃO (tabela ausente ⇒ vazio + erro legível). Fixtures com uuid real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseProducts } from "@/hooks/useSupabaseProducts";
import { useSupabaseCommercialPlans } from "@/hooks/useSupabaseCommercialPlans";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { productsRepository, type SupabaseProduct } from "@/repositories/productsRepository";
import { commercialPlansRepository, type SupabaseCommercialPlan } from "@/repositories/commercialPlansRepository";
import { CatalogUnavailableError, toCatalogError } from "@/repositories/catalogRepositoryShared";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/productsRepository", () => ({
  productsRepository: { listProducts: vi.fn(), importProduct: vi.fn(), updateProduct: vi.fn(), softDeleteProduct: vi.fn() },
}));
vi.mock("@/repositories/commercialPlansRepository", () => ({
  commercialPlansRepository: { listPlans: vi.fn(), importPlan: vi.fn(), updatePlan: vi.fn(), softDeletePlan: vi.fn() },
}));

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const P_A = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const P_B = "11111111-2222-4333-8444-555555555555";
const SVC = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";

const prodRow = (o: Partial<SupabaseProduct> = {}): SupabaseProduct => ({
  id: P_A, workspace_id: WS, category_id: null, name: "Pack", description: "d", price: 149, cost: 20, stock: 5,
  type: "digital", status: "active", is_demo: false, source_local_id: "native:1", deleted_at: null,
  created_at: "2026-10-18T00:00:00Z", updated_at: "2026-10-18T00:00:00Z", ...o,
});

const planRow = (o: Partial<SupabaseCommercialPlan> = {}): SupabaseCommercialPlan => ({
  id: P_A, workspace_id: WS, name: "Studio Pro", description: "c", billing_cycle: "monthly", price: 3800,
  items: [{ refId: SVC, kind: "service", name: "Social" }], highlight: true, status: "active", is_demo: false,
  source_local_id: "native:p", deleted_at: null, created_at: "2026-10-18T00:00:00Z", updated_at: "2026-10-18T00:00:00Z", ...o,
});

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: WS } } as never);
  vi.mocked(productsRepository.listProducts).mockResolvedValue([prodRow()]);
  vi.mocked(commercialPlansRepository.listPlans).mockResolvedValue([planRow()]);
});

describe("useSupabaseProducts", () => {
  it("leitura mapeada pro shape local (id uuid string, type/status literais, cost/stock numéricos)", async () => {
    const { result } = renderHook(() => useSupabaseProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.products).toHaveLength(1));
    expect(result.current.products[0]).toMatchObject({ id: P_A, name: "Pack", price: 149, cost: 20, stock: 5, type: "digital", status: "active" });
    expect(result.current.unavailable).toBe(false);
  });

  it("[G32] sem workspace: nenhuma query dispara", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);
    const { result } = renderHook(() => useSupabaseProducts(), { wrapper: makeWrapper() });
    expect(result.current.products).toEqual([]);
    expect(productsRepository.listProducts).not.toHaveBeenCalled();
  });

  it("degradação: tabela ausente ⇒ lista vazia + unavailable + erro legível, sem retry em loop", async () => {
    vi.mocked(productsRepository.listProducts).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    const { result } = renderHook(() => useSupabaseProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.products).toEqual([]);
    expect(result.current.error).toMatch(/não está disponível/i);
    expect(productsRepository.listProducts).toHaveBeenCalledTimes(1);
  });

  it("G95: erro de leitura que NÃO é tabela ausente ⇒ `error` com a causa real, e unavailable = false", async () => {
    vi.mocked(productsRepository.listProducts).mockRejectedValue(
      toCatalogError({ code: "42501", message: "permission denied for table products" }),
    );
    const { result } = renderHook(() => useSupabaseProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.unavailable).toBe(false);
    expect(result.current.error).toContain("permission denied for table products");
  });

  it("[G30/G37/G56] create: payload completo, source_local_id nativo, resposta vai pro cache sem refetch; update/remove idem", async () => {
    vi.mocked(productsRepository.importProduct).mockResolvedValue(prodRow({ id: P_B, name: "Novo" }));
    vi.mocked(productsRepository.updateProduct).mockResolvedValue(prodRow({ price: 200 }));
    vi.mocked(productsRepository.softDeleteProduct).mockResolvedValue(prodRow({ deleted_at: "2026-10-18T01:00:00Z" }));
    const { result } = renderHook(() => useSupabaseProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.products).toHaveLength(1));

    await act(async () => {
      await result.current.createProduct({ name: "Novo", description: "d", price: 10, cost: 2, stock: 3, type: "addon", status: "active" });
    });
    const [ws, src, payload] = vi.mocked(productsRepository.importProduct).mock.calls[0];
    expect(ws).toBe(WS);
    expect(src).toMatch(/^native:/);
    expect(payload).toMatchObject({ type: "addon", cost: 2, stock: 3, is_demo: false });
    expect(productsRepository.listProducts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual([P_B, P_A]));

    await act(async () => { await result.current.updateProduct(P_A, { price: 200 }); });
    expect(vi.mocked(productsRepository.updateProduct).mock.calls[0]).toEqual([WS, P_A, { price: 200 }]);
    await waitFor(() => expect(result.current.products.find((p) => p.id === P_A)?.price).toBe(200));

    await act(async () => { await result.current.removeProduct(P_A); });
    await waitFor(() => expect(result.current.products.map((p) => p.id)).toEqual([P_B]));
  });
});

describe("useSupabaseCommercialPlans", () => {
  it("leitura mapeada: itens com refId uuid, ciclo/status literais", async () => {
    const { result } = renderHook(() => useSupabaseCommercialPlans(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.plans).toHaveLength(1));
    expect(result.current.plans[0]).toMatchObject({
      id: P_A, billingCycle: "monthly", highlight: true, items: [{ refId: SVC, kind: "service", name: "Social" }],
    });
  });

  it("degradação: tabela ausente ⇒ vazio + erro legível", async () => {
    vi.mocked(commercialPlansRepository.listPlans).mockRejectedValue(new CatalogUnavailableError("42P01"));
    const { result } = renderHook(() => useSupabaseCommercialPlans(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.plans).toEqual([]);
    expect(result.current.error).toMatch(/não está disponível/i);
  });

  it("create: item cujo refId NÃO é uuid é DESCARTADO e a mutation devolve a contagem — nunca grava id local", async () => {
    vi.mocked(commercialPlansRepository.importPlan).mockResolvedValue(planRow({ id: P_B }));
    const { result } = renderHook(() => useSupabaseCommercialPlans(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.plans).toHaveLength(1));

    let out: Awaited<ReturnType<typeof result.current.createPlan>> | undefined;
    await act(async () => {
      out = await result.current.createPlan({
        name: "Novo", description: "", billingCycle: "yearly", price: 10, highlight: false, status: "active",
        items: [{ refId: SVC, kind: "service", name: "ok" }, { refId: "svc-local-1", kind: "service", name: "local" }],
      });
    });

    const [, src, payload] = vi.mocked(commercialPlansRepository.importPlan).mock.calls[0];
    expect(src).toMatch(/^native:/);
    expect((payload as { items: unknown[] }).items).toEqual([{ refId: SVC, kind: "service", name: "ok" }]);
    expect(JSON.stringify(payload)).not.toContain("svc-local-1");
    expect(out?.discarded.map((d) => d.refId)).toEqual(["svc-local-1"]);
    expect(commercialPlansRepository.listPlans).toHaveBeenCalledTimes(1); // [G30] sem refetch
    await waitFor(() => expect(result.current.plans.map((p) => p.id)).toEqual([P_B, P_A]));
  });

  it("update: só os campos do patch; remove = soft delete e some da lista", async () => {
    vi.mocked(commercialPlansRepository.updatePlan).mockResolvedValue(planRow({ highlight: false }));
    vi.mocked(commercialPlansRepository.softDeletePlan).mockResolvedValue(planRow({ deleted_at: "2026-10-18T01:00:00Z" }));
    const { result } = renderHook(() => useSupabaseCommercialPlans(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.plans).toHaveLength(1));

    await act(async () => { await result.current.updatePlan(P_A, { highlight: false }); });
    expect(vi.mocked(commercialPlansRepository.updatePlan).mock.calls[0]).toEqual([WS, P_A, { highlight: false }]);
    await waitFor(() => expect(result.current.plans[0].highlight).toBe(false));

    await act(async () => { await result.current.removePlan(P_A); });
    await waitFor(() => expect(result.current.plans).toHaveLength(0));
  });
});
