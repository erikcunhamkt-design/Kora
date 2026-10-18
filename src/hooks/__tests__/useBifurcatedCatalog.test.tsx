// G94 / CT4 — hooks bifurcados do catálogo: bifurcação por flag, escrita nativa (uuid real), bloqueio honesto
// com escrita desligada (G76), degradação com tabela ausente e REGRESSÃO LOCAL (default sem provider algum).
// Hooks locais REAIS (localStorage) + repositórios simulados; só o que cruza a rede é mock.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { toast } from "sonner";

import {
  useBifurcatedServices,
  useBifurcatedServiceCategories,
  useBifurcatedProducts,
  useBifurcatedCommercialPlans,
  CATALOG_WRITE_BLOCKED_MESSAGE,
} from "@/hooks/useBifurcatedCatalog";
import { useCatalogMode } from "@/hooks/catalogCloudContext";
import { useCatalogSource } from "@/hooks/useCatalogSource";
import { CatalogDataProvider } from "@/components/vendas/CatalogDataProvider";
import { CATALOG_DATA_SOURCE_KEY, CATALOG_WRITE_FLAG_KEY } from "@/config/flags";
import { serviceCategoriesRepository } from "@/repositories/serviceCategoriesRepository";
import { servicesRepository } from "@/repositories/servicesRepository";
import { productsRepository } from "@/repositories/productsRepository";
import { commercialPlansRepository } from "@/repositories/commercialPlansRepository";
import { CatalogUnavailableError } from "@/repositories/catalogRepositoryShared";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => ({ workspace: { id: "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9" } }) }));
vi.mock("@/repositories/serviceCategoriesRepository", () => ({
  serviceCategoriesRepository: { listCategories: vi.fn(), importCategory: vi.fn(), updateCategory: vi.fn(), softDeleteCategory: vi.fn() },
}));
vi.mock("@/repositories/servicesRepository", () => ({
  servicesRepository: { listServices: vi.fn(), importService: vi.fn(), updateService: vi.fn(), softDeleteService: vi.fn() },
}));
vi.mock("@/repositories/productsRepository", () => ({
  productsRepository: { listProducts: vi.fn(), importProduct: vi.fn(), updateProduct: vi.fn(), softDeleteProduct: vi.fn() },
}));
vi.mock("@/repositories/commercialPlansRepository", () => ({
  commercialPlansRepository: { listPlans: vi.fn(), importPlan: vi.fn(), updatePlan: vi.fn(), softDeletePlan: vi.fn() },
}));

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const CAT = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";
const SVC = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const SVC2 = "0a1b2c3d-1111-4222-8333-444455556666";
const PROD = "11111111-2222-4333-8444-555555555555";
const PLAN = "99999999-8888-4777-8666-555555555555";
const T = "2026-10-18T00:00:00Z";

const base = { workspace_id: WS, source_local_id: "native:x", deleted_at: null, created_at: T, updated_at: T, is_demo: false };
const catRow = (o = {}) => ({ ...base, id: CAT, name: "Branding", color: "#F81040", ...o });
const svcRow = (o = {}) => ({
  ...base, id: SVC, category_id: CAT, category: "Branding", name: "Logo", description: "d", price: 1000, billing_type: "único",
  delivery_days: 7, active: true, tags: [], available_in_quotes: true, show_in_public_catalog: false, notes: null, ...o,
});
const prodRow = (o = {}) => ({
  ...base, id: PROD, category_id: null, name: "Pack", description: "", price: 149, cost: null, stock: null, type: "digital", status: "active", ...o,
});
const planRow = (o = {}) => ({
  ...base, id: PLAN, name: "Studio", description: "", billing_cycle: "monthly", price: 3800,
  items: [{ refId: SVC, kind: "service", name: "Logo" }], highlight: false, status: "active", ...o,
});

function wrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(CatalogDataProvider, null, children));
}

function useAll() {
  return {
    svc: useBifurcatedServices(),
    cats: useBifurcatedServiceCategories(),
    prods: useBifurcatedProducts(),
    plans: useBifurcatedCommercialPlans(),
    mode: useCatalogMode(),
    src: useCatalogSource(),
  };
}

const localServices = () => JSON.parse(localStorage.getItem("orbyt.services.v1") ?? "[]") as Array<{ id: string; name: string }>;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(serviceCategoriesRepository.listCategories).mockResolvedValue([catRow()] as never);
  vi.mocked(servicesRepository.listServices).mockResolvedValue([svcRow()] as never);
  vi.mocked(productsRepository.listProducts).mockResolvedValue([prodRow()] as never);
  vi.mocked(commercialPlansRepository.listPlans).mockResolvedValue([planRow()] as never);
});

const cloudOn = (write: boolean) => {
  localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
  if (write) localStorage.setItem(CATALOG_WRITE_FLAG_KEY, "true");
};

describe("regressão LOCAL (padrão): nada de nuvem", () => {
  it("sem flag e SEM nenhum provider (nem QueryClient): lê e escreve no store local, zero repositório", async () => {
    const { result } = renderHook(() => useAll()); // sem wrapper algum
    expect(result.current.mode.source).toBe("local");
    expect(result.current.mode.requested).toBe("local");
    expect(result.current.svc.services.length).toBeGreaterThan(0); // seeds demo
    expect(result.current.svc.services.every((s) => s.isDemo)).toBe(true);

    let ok: unknown;
    act(() => {
      ok = result.current.svc.addService({
        name: "Novo", description: "", category: "", price: 10, billingType: "único", deliveryDays: 1, active: true,
      });
    });
    expect(ok).toBe(true);
    expect(localServices().some((s) => s.name === "Novo")).toBe(true);
    expect(servicesRepository.listServices).not.toHaveBeenCalled();
    expect(servicesRepository.importService).not.toHaveBeenCalled();
  });

  it("com provider mas flag local: continua sem nenhuma request (hooks de nuvem nem montam)", async () => {
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    expect(result.current.mode.source).toBe("local");
    await new Promise((r) => setTimeout(r, 20));
    expect(servicesRepository.listServices).not.toHaveBeenCalled();
    expect(serviceCategoriesRepository.listCategories).not.toHaveBeenCalled();
    expect(productsRepository.listProducts).not.toHaveBeenCalled();
    expect(commercialPlansRepository.listPlans).not.toHaveBeenCalled();
  });

  it("só o literal \"supabase\" liga a nuvem: valor malformado/\"local\" ⇒ local", () => {
    for (const v of ["local", "true", "SUPABASE", ""]) {
      localStorage.setItem(CATALOG_DATA_SOURCE_KEY, v);
      const { result, unmount } = renderHook(() => useCatalogMode());
      expect(result.current.requested).toBe("local");
      unmount();
    }
  });

  it("mutators locais: editar/duplicar/arquivar/excluir funcionam no store e devolvem true", () => {
    const { result } = renderHook(() => useAll());
    const first = result.current.svc.services[0];
    act(() => { expect(result.current.svc.toggleActive(first.id)).toBe(true); });
    expect(localServices().find((s) => s.id === first.id)).toBeTruthy();
    const before = result.current.svc.services.length;
    act(() => { expect(result.current.svc.duplicateService(first.id)).toBe(true); });
    expect(result.current.svc.services.length).toBe(before + 1);
    act(() => { expect(result.current.svc.removeService(first.id)).toBe(true); });
    expect(result.current.svc.services.some((s) => s.id === first.id)).toBe(false);
  });
});

describe("fonte NUVEM + escrita LIGADA", () => {
  it("lê o catálogo da nuvem (ids uuid), NÃO mistura o local, e o modo é supabase", async () => {
    cloudOn(true);
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.svc.services.map((s) => s.id)).toEqual([SVC]));
    expect(result.current.svc.services[0]).toMatchObject({ name: "Logo", billingType: "único", categoryId: CAT, category: "Branding" });
    expect(result.current.cats.categories.map((c) => c.id)).toEqual([CAT]);
    expect(result.current.prods.products.map((p) => p.id)).toEqual([PROD]);
    expect(result.current.plans.plans.map((p) => p.id)).toEqual([PLAN]);
    expect(result.current.mode).toMatchObject({ source: "supabase", cloudWrite: true, writeBlocked: false, unavailable: false });
  });

  it("criar serviço: grava na NUVEM (key nativa, payload completo), devolve true e NÃO toca o store local", async () => {
    cloudOn(true);
    vi.mocked(servicesRepository.importService).mockResolvedValue(svcRow({ id: SVC2, name: "Novo" }) as never);
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.svc.services).toHaveLength(1));

    let ok: unknown;
    await act(async () => {
      ok = await result.current.svc.addService({
        name: "Novo", description: "d", category: "Branding", categoryId: CAT, price: 2500, billingType: "mensal",
        deliveryDays: 30, active: true, tags: ["a"], availableInQuotes: true, showInPublicCatalog: false, notes: "n",
      });
    });
    expect(ok).toBe(true);
    const [ws, src, payload] = vi.mocked(servicesRepository.importService).mock.calls[0];
    expect(ws).toBe(WS);
    expect(src).toMatch(/^native:/);
    expect(payload).toMatchObject({ category_id: CAT, billing_type: "mensal", price: 2500, delivery_days: 30, tags: ["a"], notes: "n", is_demo: false });
    expect(localServices().every((s) => s.id.startsWith("svc-demo-"))).toBe(true); // store local intocado: só os seeds de sempre
    await waitFor(() => expect(result.current.svc.services.map((s) => s.id)).toEqual([SVC2, SVC])); // G30, sem refetch
    expect(servicesRepository.listServices).toHaveBeenCalledTimes(1);
  });

  it("editar / arquivar / duplicar / excluir serviço usam os mutators nativos por uuid", async () => {
    cloudOn(true);
    vi.mocked(servicesRepository.updateService).mockResolvedValue(svcRow({ price: 1200 }) as never);
    vi.mocked(servicesRepository.importService).mockResolvedValue(svcRow({ id: SVC2, name: "Logo (cópia)" }) as never);
    vi.mocked(servicesRepository.softDeleteService).mockResolvedValue(svcRow({ deleted_at: T }) as never);
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.svc.services).toHaveLength(1));

    await act(async () => { expect(await result.current.svc.updateService(SVC, { price: 1200 })).toBe(true); });
    expect(vi.mocked(servicesRepository.updateService).mock.calls[0].slice(0, 2)).toEqual([WS, SVC]);

    await act(async () => { expect(await result.current.svc.toggleActive(SVC)).toBe(true); });
    expect(vi.mocked(servicesRepository.updateService).mock.calls[1][2]).toMatchObject({ active: false });

    await act(async () => { expect(await result.current.svc.duplicateService(SVC)).toBe(true); });
    const dup = vi.mocked(servicesRepository.importService).mock.calls[0];
    expect(dup[2]).toMatchObject({ name: "Logo (cópia)" });
    expect(dup[1]).toMatch(/^native:/); // linha NOVA, nunca upsert sobre a original (G56)

    await act(async () => { expect(await result.current.svc.removeService(SVC)).toBe(true); });
    expect(vi.mocked(servicesRepository.softDeleteService).mock.calls[0]).toEqual([WS, SVC]);
  });

  it("produtos e categorias: criar/atualizar/excluir na nuvem", async () => {
    cloudOn(true);
    vi.mocked(productsRepository.importProduct).mockResolvedValue(prodRow({ id: SVC2, name: "Novo" }) as never);
    vi.mocked(productsRepository.updateProduct).mockResolvedValue(prodRow({ status: "inactive" }) as never);
    vi.mocked(productsRepository.softDeleteProduct).mockResolvedValue(prodRow({ deleted_at: T }) as never);
    vi.mocked(serviceCategoriesRepository.importCategory).mockResolvedValue(catRow({ id: SVC2, name: "Nova" }) as never);
    vi.mocked(serviceCategoriesRepository.softDeleteCategory).mockResolvedValue(catRow({ deleted_at: T }) as never);
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.prods.products).toHaveLength(1));

    await act(async () => {
      expect(await result.current.prods.addProduct({ name: "Novo", description: "", price: 10, cost: 2, stock: 3, type: "addon", status: "active" })).toBe(true);
    });
    expect(vi.mocked(productsRepository.importProduct).mock.calls[0][2]).toMatchObject({ type: "addon", cost: 2, stock: 3 });
    await act(async () => { expect(await result.current.prods.updateProduct(PROD, { status: "inactive" })).toBe(true); });
    expect(vi.mocked(productsRepository.updateProduct).mock.calls[0][2]).toMatchObject({ status: "inactive" });
    await act(async () => { expect(await result.current.prods.removeProduct(PROD)).toBe(true); });

    await act(async () => { expect(await result.current.cats.addCategory({ name: "Nova", color: "#000000" })).toBe(true); });
    await act(async () => { expect(await result.current.cats.removeCategory(CAT)).toBe(true); });
    expect(vi.mocked(serviceCategoriesRepository.softDeleteCategory).mock.calls[0]).toEqual([WS, CAT]);
  });

  it("planos: criar com item de id LOCAL descarta o item e AVISA a contagem; duplicar cria linha nova", async () => {
    cloudOn(true);
    vi.mocked(commercialPlansRepository.importPlan).mockResolvedValue(planRow({ id: SVC2 }) as never);
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.plans.plans).toHaveLength(1));

    await act(async () => {
      expect(await result.current.plans.addPlan({
        name: "Novo", description: "", billingCycle: "yearly", price: 10, highlight: false, status: "active",
        items: [{ refId: SVC, kind: "service", name: "ok" }, { refId: "svc-local-1", kind: "service", name: "local" }],
      })).toBe(true);
    });
    const payload = vi.mocked(commercialPlansRepository.importPlan).mock.calls[0][2] as { items: unknown[] };
    expect(payload.items).toEqual([{ refId: SVC, kind: "service", name: "ok" }]);
    expect(JSON.stringify(payload)).not.toContain("svc-local-1");
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toMatch(/1 item\(ns\) do plano foram DESCARTADOS/);

    vi.mocked(commercialPlansRepository.importPlan).mockClear();
    vi.mocked(toast.warning).mockClear();
    await act(async () => { expect(await result.current.plans.duplicatePlan(PLAN)).toBe(true); });
    const dup = vi.mocked(commercialPlansRepository.importPlan).mock.calls[0];
    expect(dup[1]).toMatch(/^native:/);
    expect(dup[2]).toMatchObject({ name: "Studio (cópia)", billing_cycle: "monthly" });
    expect((dup[2] as { items: unknown[] }).items).toEqual([{ refId: SVC, kind: "service", name: "Logo" }]);
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("falha de escrita ⇒ false + toast de erro legível; a lista NÃO muda (nada de sucesso falso — G75)", async () => {
    cloudOn(true);
    vi.mocked(servicesRepository.importService).mockRejectedValue(new CatalogUnavailableError("42P01"));
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.svc.services).toHaveLength(1));

    let ok: unknown;
    await act(async () => {
      ok = await result.current.svc.addService({ name: "X", description: "", category: "", price: 1, billingType: "único", deliveryDays: 1, active: true });
    });
    expect(ok).toBe(false);
    expect(vi.mocked(toast.error).mock.calls[0][0]).toMatch(/catálogo na nuvem ainda não está disponível/i);
    expect(result.current.svc.services.map((s) => s.id)).toEqual([SVC]);
  });
});

describe("fonte NUVEM + escrita DESLIGADA (G76): bloqueio honesto", () => {
  it("TODA operação é bloqueada: false, aviso, nenhuma chamada de escrita, store local intocado", async () => {
    cloudOn(false);
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.svc.services).toHaveLength(1));
    expect(result.current.mode).toMatchObject({ source: "supabase", writeBlocked: true, cloudWrite: false });

    const ops: Array<() => unknown> = [
      () => result.current.svc.addService({ name: "X", description: "", category: "", price: 1, billingType: "único", deliveryDays: 1, active: true }),
      () => result.current.svc.updateService(SVC, { price: 1 }),
      () => result.current.svc.toggleActive(SVC),
      () => result.current.svc.duplicateService(SVC),
      () => result.current.svc.removeService(SVC),
      () => result.current.prods.addProduct({ name: "P", description: "", price: 1, type: "digital", status: "active" }),
      () => result.current.prods.updateProduct(PROD, { price: 2 }),
      () => result.current.prods.removeProduct(PROD),
      () => result.current.cats.addCategory({ name: "C", color: "#000000" }),
      () => result.current.cats.removeCategory(CAT),
      () => result.current.plans.addPlan({ name: "P", description: "", billingCycle: "monthly", price: 1, items: [], highlight: false, status: "active" }),
      () => result.current.plans.updatePlan(PLAN, { highlight: true }),
      () => result.current.plans.duplicatePlan(PLAN),
      () => result.current.plans.removePlan(PLAN),
    ];
    for (const op of ops) {
      let out: unknown;
      await act(async () => { out = await op(); });
      expect(out).toBe(false);
    }
    expect(vi.mocked(toast.warning)).toHaveBeenCalledTimes(ops.length);
    expect(vi.mocked(toast.warning).mock.calls.every((c) => c[0] === CATALOG_WRITE_BLOCKED_MESSAGE)).toBe(true);
    expect(CATALOG_WRITE_BLOCKED_MESSAGE).toMatch(/nada foi salvo/i);

    for (const fn of [
      servicesRepository.importService, servicesRepository.updateService, servicesRepository.softDeleteService,
      productsRepository.importProduct, productsRepository.updateProduct, productsRepository.softDeleteProduct,
      serviceCategoriesRepository.importCategory, serviceCategoriesRepository.softDeleteCategory,
      commercialPlansRepository.importPlan, commercialPlansRepository.updatePlan, commercialPlansRepository.softDeletePlan,
    ]) expect(fn).not.toHaveBeenCalled();
    expect(localServices().every((s) => s.id.startsWith("svc-demo-"))).toBe(true); // nada gravado no local: só os seeds
    const localProducts = JSON.parse(localStorage.getItem("kora.products.v1") ?? "[]") as Array<{ id: string }>;
    expect(localProducts.every((p) => p.id.includes("demo"))).toBe(true);
  });
});

describe("degradação: tabela ausente ⇒ cai no LOCAL e avisa", () => {
  it("categorias/serviços/produtos/planos ausentes: modo local, unavailable + tabelas; escrita vai pro store local", async () => {
    cloudOn(true);
    vi.mocked(productsRepository.listProducts).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    vi.mocked(commercialPlansRepository.listPlans).mockRejectedValue(new CatalogUnavailableError("42P01"));
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.mode.unavailable).toBe(true));

    expect(result.current.mode).toMatchObject({ requested: "supabase", source: "local", writeBlocked: false, cloudWrite: false });
    expect(result.current.mode.tables).toEqual(["products", "commercial_plans"]);
    // a tela exibe o catálogo LOCAL (seeds), nunca lista vazia da nuvem
    expect(result.current.svc.services.every((s) => s.isDemo)).toBe(true);

    let ok: unknown;
    act(() => {
      ok = result.current.svc.addService({ name: "Local novo", description: "", category: "", price: 5, billingType: "único", deliveryDays: 1, active: true });
    });
    expect(ok).toBe(true);
    expect(localServices().some((s) => s.name === "Local novo")).toBe(true);
    expect(servicesRepository.importService).not.toHaveBeenCalled();
  });

  it("erro que NÃO é tabela ausente (RLS) NÃO derruba pro local: fica em `error`", async () => {
    cloudOn(true);
    vi.mocked(servicesRepository.listServices).mockRejectedValue(Object.assign(new Error("rls denied"), { code: "42501" }));
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.mode.error).toBeTruthy());
    expect(result.current.mode.source).toBe("supabase");
    expect(result.current.mode.unavailable).toBe(false);
    expect(result.current.svc.services).toEqual([]);
  });

  it("retry reconsulta as 4 listas (depois de aplicar o pacote §8-b)", async () => {
    cloudOn(true);
    vi.mocked(servicesRepository.listServices).mockRejectedValueOnce(new CatalogUnavailableError("42P01"));
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.mode.unavailable).toBe(true));
    await act(async () => { result.current.mode.retry(); });
    await waitFor(() => expect(result.current.mode.unavailable).toBe(false));
    await waitFor(() => expect(result.current.svc.services.map((s) => s.id)).toEqual([SVC]));
  });
});

describe("flags reativas", () => {
  it("trocar a fonte pelo hook (card de Configurações) troca a leitura sem recarregar; voltar pra local desmonta a nuvem", async () => {
    const { result } = renderHook(() => useAll(), { wrapper: wrapper() });
    expect(result.current.mode.source).toBe("local");
    expect(servicesRepository.listServices).not.toHaveBeenCalled();

    act(() => { result.current.src.setDataSource("supabase"); });
    await waitFor(() => expect(result.current.svc.services.map((s) => s.id)).toEqual([SVC]));
    expect(result.current.mode.source).toBe("supabase");
    expect(localStorage.getItem(CATALOG_DATA_SOURCE_KEY)).toBe("supabase");

    act(() => { result.current.src.setDataSource("local"); });
    await waitFor(() => expect(result.current.mode.source).toBe("local"));
    expect(result.current.svc.services.every((s) => s.isDemo)).toBe(true);
  });
});
