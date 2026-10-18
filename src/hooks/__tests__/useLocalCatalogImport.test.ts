// G94 / CT3 — hook do import assistido: sonda das 4 tabelas (schema pendente ⇒ recusa importar, G29),
// import em ordem com uuid real, meta persistida só após sucesso, IDEMPOTÊNCIA (2ª rodada = 0 novos).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

import { useLocalCatalogImport } from "@/hooks/useLocalCatalogImport";
import { serviceCategoriesRepository } from "@/repositories/serviceCategoriesRepository";
import { servicesRepository } from "@/repositories/servicesRepository";
import { productsRepository } from "@/repositories/productsRepository";
import { commercialPlansRepository } from "@/repositories/commercialPlansRepository";
import { CatalogUnavailableError, toCatalogError } from "@/repositories/catalogRepositoryShared";
import { CATALOG_IMPORT_META_KEY } from "@/services/catalog/catalogImport";

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const T = "2026-10-18T00:00:00.000Z";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => ({ workspace: { id: "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9" } }) }));
vi.mock("@/hooks/useServiceCategories", () => {
  const categories = [{ id: "cat-1", name: "Branding", color: "#F81040" }, { id: "cat-d", name: "Demo", color: "#000", isDemo: true }];
  return { useServiceCategories: () => ({ categories }) };
});
vi.mock("@/hooks/useServices", () => {
  const services = [{ id: "svc-1", name: "Logo", description: "", category: "Branding", categoryId: "cat-1", price: 10, billingType: "único", deliveryDays: 1, active: true }];
  return { useServices: () => ({ services }) };
});
vi.mock("@/hooks/useProducts", () => {
  const products = [{ id: "prod-1", name: "Pack", description: "", price: 1, type: "digital", status: "active", createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z" }];
  return { useProducts: () => ({ products }) };
});
vi.mock("@/hooks/useCommercialPlans", () => {
  const plans = [{
    id: "plan-1", name: "Studio", description: "", billingCycle: "monthly", price: 5, highlight: false, status: "active",
    createdAt: "2026-10-18T00:00:00.000Z", updatedAt: "2026-10-18T00:00:00.000Z",
    items: [{ refId: "svc-1", kind: "service", name: "Logo" }, { refId: "svc-ghost", kind: "service", name: "Fantasma" }],
  }];
  return { useCommercialPlans: () => ({ plans }) };
});
vi.mock("@/repositories/serviceCategoriesRepository", () => ({ serviceCategoriesRepository: { listCategories: vi.fn(), importCategory: vi.fn() } }));
vi.mock("@/repositories/servicesRepository", () => ({ servicesRepository: { listServices: vi.fn(), importService: vi.fn() } }));
vi.mock("@/repositories/productsRepository", () => ({ productsRepository: { listProducts: vi.fn(), importProduct: vi.fn() } }));
vi.mock("@/repositories/commercialPlansRepository", () => ({ commercialPlansRepository: { listPlans: vi.fn(), importPlan: vi.fn() } }));

const U = {
  cat: "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11",
  svc: "87ebd1d2-b17a-46f4-b0eb-70beac445221",
  prod: "11111111-2222-4333-8444-555555555555",
  plan: "99999999-8888-4777-8666-555555555555",
};

const ALL = ["category:cat-1", "service:svc-1", "product:prod-1", "plan:plan-1"];
const order: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  order.length = 0;
  vi.mocked(serviceCategoriesRepository.listCategories).mockResolvedValue([]);
  vi.mocked(servicesRepository.listServices).mockResolvedValue([]);
  vi.mocked(productsRepository.listProducts).mockResolvedValue([]);
  vi.mocked(commercialPlansRepository.listPlans).mockResolvedValue([]);
  vi.mocked(serviceCategoriesRepository.importCategory).mockImplementation(async () => { order.push("category"); return { id: U.cat } as never; });
  vi.mocked(servicesRepository.importService).mockImplementation(async () => { order.push("service"); return { id: U.svc } as never; });
  vi.mocked(productsRepository.importProduct).mockImplementation(async () => { order.push("product"); return { id: U.prod } as never; });
  vi.mocked(commercialPlansRepository.importPlan).mockImplementation(async () => { order.push("plan"); return { id: U.plan } as never; });
});

describe("useLocalCatalogImport", () => {
  it("candidatos locais (sem rede) já na montagem; demo fora", () => {
    const { result } = renderHook(() => useLocalCatalogImport());
    expect(result.current.candidates.map((c) => `${c.kind}:${c.localId}`)).toEqual(ALL);
    expect(serviceCategoriesRepository.listCategories).not.toHaveBeenCalled();
  });

  it("schema pendente: tabela ausente ⇒ lista as ausentes e importSelected RECUSA (nada gravado)", async () => {
    vi.mocked(productsRepository.listProducts).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    vi.mocked(commercialPlansRepository.listPlans).mockRejectedValue(new CatalogUnavailableError("42P01"));
    const { result } = renderHook(() => useLocalCatalogImport());
    await act(async () => { await result.current.analyze(); });
    expect(result.current.schemaPending).toEqual({ tables: ["products", "commercial_plans"] });
    expect(result.current.error).toBeNull();

    let rep: Awaited<ReturnType<typeof result.current.importSelected>> | undefined;
    await act(async () => { rep = await result.current.importSelected(ALL); });
    expect(Object.values(rep!.created).flat()).toHaveLength(0);
    expect(order).toEqual([]);
    expect(localStorage.getItem(CATALOG_IMPORT_META_KEY)).toBeNull();
  });

  it("erro que NÃO é tabela ausente vira mensagem de erro (e não schemaPending)", async () => {
    vi.mocked(servicesRepository.listServices).mockRejectedValue(new Error("rls denied"));
    const { result } = renderHook(() => useLocalCatalogImport());
    await act(async () => { await result.current.analyze(); });
    expect(result.current.schemaPending).toBeNull();
    expect(result.current.error).toBeTruthy();
  });

  it("G95: erro de RLS na sonda ⇒ mensagem com a causa real (e não schemaPending)", async () => {
    vi.mocked(productsRepository.listProducts).mockRejectedValue(
      toCatalogError({ code: "42501", message: 'permission denied for table products' }),
    );
    const { result } = renderHook(() => useLocalCatalogImport());
    await act(async () => { await result.current.analyze(); });
    expect(result.current.schemaPending).toBeNull();
    expect(result.current.error).toMatch(/^Erro ao consultar o catálogo na nuvem: /);
    expect(result.current.error).toContain("permission denied for table products");
  });

  it("G95: falha de UM item no import ⇒ relatório com o nome do item e a causa real (não só a contagem)", async () => {
    vi.mocked(serviceCategoriesRepository.importCategory).mockRejectedValue(
      toCatalogError({ code: "42P10", message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" }),
    );
    const { result } = renderHook(() => useLocalCatalogImport());
    await act(async () => { await result.current.analyze(); });
    await act(async () => { await result.current.importSelected(ALL); });
    const failures = result.current.report?.failures ?? [];
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatchObject({ kind: "category", localId: "cat-1", label: "Branding" });
    expect(failures[0].message).toContain("no unique or exclusion constraint matching the ON CONFLICT");
  });

  it("importa em ORDEM, persiste a meta e a 2ª rodada tem 0 novos / 0 chamadas; descarte contado no relatório", async () => {
    const { result } = renderHook(() => useLocalCatalogImport());
    await act(async () => { await result.current.analyze(); });
    expect(result.current.schemaPending).toBeNull();

    await act(async () => { await result.current.importSelected(ALL); });
    expect(order).toEqual(["category", "service", "product", "plan"]);

    // FKs traduzidas pro uuid real
    expect(vi.mocked(servicesRepository.importService).mock.calls[0][2]).toMatchObject({ category_id: U.cat });
    const planInput = vi.mocked(commercialPlansRepository.importPlan).mock.calls[0][2];
    expect(planInput.items).toEqual([{ refId: U.svc, kind: "service", name: "Logo" }]);
    expect(result.current.report?.discardedPlanItems[0]?.items.map((i) => i.refId)).toEqual(["svc-ghost"]);

    const meta = JSON.parse(localStorage.getItem(CATALOG_IMPORT_META_KEY)!);
    expect(meta.maps).toEqual({ categories: { "cat-1": U.cat }, services: { "svc-1": U.svc }, products: { "prod-1": U.prod }, plans: { "plan-1": U.plan } });

    await waitFor(() => expect(result.current.candidates.every((c) => c.status === "imported")).toBe(true));

    order.length = 0;
    await act(async () => { await result.current.importSelected(ALL); });
    expect(order).toEqual([]); // 2ª rodada = 0 novos
  });
});
