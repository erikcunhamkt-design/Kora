// G94 / CT2 — fidelidade do mapper de PRODUTOS e PLANOS COMERCIAIS local ⇄ nuvem. Ida-e-volta por
// campo (G37/G83), vocabulário literal (G40/G49), passthrough de uuid (G67) e a regra dos itens de plano:
// sem tradução ⇒ DESCARTADO e contado, nunca gravado com id local. Fixtures com uuid REAL.
import { describe, it, expect } from "vitest";
import {
  BILLING_CYCLES,
  PLAN_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_TYPES,
  mapLocalPlanToSupabase,
  mapLocalProductToSupabase,
  mapPlanPatchToSupabase,
  mapProductPatchToSupabase,
  mapSupabasePlanToLocal,
  mapSupabaseProductToLocal,
} from "@/services/catalog/catalogProductPlanMapper";
import type { Product } from "@/hooks/useProducts";
import type { CommercialPlan } from "@/hooks/useCommercialPlans";
import type { SupabaseProduct } from "@/repositories/productsRepository";
import type { SupabaseCommercialPlan } from "@/repositories/commercialPlansRepository";

const CAT = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";
const PROD = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const SVC = "11111111-2222-4333-8444-555555555555";
const PLAN = "99999999-8888-4777-8666-555555555555";

function fullProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prod-1700000000000", name: "Pack de Mockups", description: "30 mockups", categoryId: "cat-branding",
    price: 149, cost: 20.5, stock: 12, type: "digital", status: "active", isDemo: false,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-02T00:00:00.000Z", ...overrides,
  };
}

function productRow(payload: ReturnType<typeof mapLocalProductToSupabase>, extra: Partial<SupabaseProduct> = {}): SupabaseProduct {
  return {
    id: PROD, workspace_id: "ws1", source_local_id: "inst:prod-1", deleted_at: null,
    created_at: "2026-10-18T00:00:00Z", updated_at: "2026-10-18T00:00:00Z", ...payload, ...extra,
  } as SupabaseProduct;
}

function fullPlan(overrides: Partial<CommercialPlan> = {}): CommercialPlan {
  return {
    id: "plan-1", name: "Studio Pro", description: "Combo", billingCycle: "monthly", price: 3800,
    items: [
      { refId: "svc-1", kind: "service", name: "Social Media" },
      { refId: "prod-1", kind: "product", name: "Pack" },
    ],
    highlight: true, status: "active", isDemo: false,
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}

describe("produtos — payload COMPLETO (G37)", () => {
  it("leva todos os campos pra uma coluna", () => {
    expect(mapLocalProductToSupabase(fullProduct(), { categories: { "cat-branding": CAT } })).toEqual({
      category_id: CAT, name: "Pack de Mockups", description: "30 mockups", price: 149, cost: 20.5, stock: 12,
      type: "digital", status: "active", is_demo: false,
    });
  });

  it("cost/stock ausentes viram NULL (nunca 0 inventado); categoria não resolvida ⇒ null (nunca id local cru — G67)", () => {
    const out = mapLocalProductToSupabase(fullProduct({ cost: undefined, stock: undefined }), { categories: {} });
    expect(out.cost).toBeNull();
    expect(out.stock).toBeNull();
    expect(out.category_id).toBeNull();
  });

  it("categoryId que já é uuid passa direto; price/cost quantizados em centavos; stock inteiro", () => {
    const out = mapLocalProductToSupabase(fullProduct({ categoryId: CAT, price: 99.999, cost: 1.005, stock: 3.4 }));
    expect(out).toMatchObject({ category_id: CAT, price: 100, cost: 1.01, stock: 3 });
  });
});

describe("produtos — vocabulário literal (G40/G49)", () => {
  it.each(PRODUCT_TYPES.map((t) => [t]))("type %s: ida-e-volta preserva o literal", (type) => {
    const row = productRow(mapLocalProductToSupabase(fullProduct({ type })));
    expect(row.type).toBe(type);
    expect(mapSupabaseProductToLocal(row).type).toBe(type);
  });

  it.each(PRODUCT_STATUSES.map((s) => [s]))("status %s: ida-e-volta preserva o literal", (status) => {
    const row = productRow(mapLocalProductToSupabase(fullProduct({ status })));
    expect(mapSupabaseProductToLocal(row).status).toBe(status);
  });

  it("fora do vocabulário: escrita cai em digital/active (nunca grava o que o CHECK recusaria); leitura idem", () => {
    const out = mapLocalProductToSupabase(fullProduct({ type: "x" as never, status: "y" as never }));
    expect(out).toMatchObject({ type: "digital", status: "active" });
    const row = productRow(out, { type: "invalido", status: "invalido" });
    expect(mapSupabaseProductToLocal(row)).toMatchObject({ type: "digital", status: "active" });
  });
});

describe("produtos — ida-e-volta por campo e leitura defensiva", () => {
  it("todos os campos de negócio voltam idênticos (id volta uuid string; datas do servidor)", () => {
    const local = fullProduct();
    const back = mapSupabaseProductToLocal(productRow(mapLocalProductToSupabase(local, { categories: { "cat-branding": CAT } })));
    expect(back).toMatchObject({
      id: PROD, name: local.name, description: local.description, categoryId: CAT, price: 149, cost: 20.5, stock: 12,
      type: "digital", status: "active", createdAt: "2026-10-18T00:00:00Z", updatedAt: "2026-10-18T00:00:00Z",
    });
  });

  it("numeric do PostgREST (string) vira number; NULLs viram undefined/\"\" sem quebrar", () => {
    const row = {
      id: PROD, workspace_id: "ws1", name: "Mín", price: "10.50", cost: "2.25", stock: null, type: "addon",
      status: "inactive", is_demo: false, description: null, category_id: null, created_at: "c", updated_at: "u",
    } as unknown as SupabaseProduct;
    expect(mapSupabaseProductToLocal(row)).toMatchObject({
      price: 10.5, cost: 2.25, stock: undefined, description: "", categoryId: undefined, type: "addon", status: "inactive",
    });
  });

  it("patch parcial: só os campos recebidos; inválidos caem no default", () => {
    expect(mapProductPatchToSupabase({ price: 150 })).toEqual({ price: 150 });
    expect(mapProductPatchToSupabase({ stock: undefined, cost: 0 })).toEqual({ cost: 0 });
    expect(mapProductPatchToSupabase({ type: "x" as never, categoryId: "cat-x" })).toEqual({ type: "digital", category_id: null });
  });
});

describe("planos — payload completo e itens (R1 da Fase A)", () => {
  it("itens com tradução (mapa) vão com refId = UUID; descartes vazios", () => {
    const { input, discarded } = mapLocalPlanToSupabase(fullPlan(), {
      services: { "svc-1": SVC }, products: { "prod-1": PROD },
    });
    expect(input).toEqual({
      name: "Studio Pro", description: "Combo", billing_cycle: "monthly", price: 3800,
      items: [
        { refId: SVC, kind: "service", name: "Social Media" },
        { refId: PROD, kind: "product", name: "Pack" },
      ],
      highlight: true, status: "active", is_demo: false,
    });
    expect(discarded).toEqual([]);
  });

  it("refId que já é uuid passa direto (item escolhido na UI da nuvem), mesmo sem mapa", () => {
    const { input, discarded } = mapLocalPlanToSupabase(
      fullPlan({ items: [{ refId: SVC, kind: "service", name: "S" }] }),
    );
    expect(input.items).toEqual([{ refId: SVC, kind: "service", name: "S" }]);
    expect(discarded).toEqual([]);
  });

  it("item SEM tradução é DESCARTADO e contado — NUNCA gravado com id local cru", () => {
    const { input, discarded } = mapLocalPlanToSupabase(fullPlan(), { services: { "svc-1": SVC }, products: {} });
    expect(input.items).toEqual([{ refId: SVC, kind: "service", name: "Social Media" }]);
    expect(discarded).toEqual([{ refId: "prod-1", kind: "product", name: "Pack" }]);
    expect(JSON.stringify(input)).not.toContain("prod-1");
  });

  it("o mapa certo por `kind`: um id de serviço NÃO resolve no mapa de produtos (e vice-versa)", () => {
    const { input, discarded } = mapLocalPlanToSupabase(
      fullPlan({ items: [{ refId: "svc-1", kind: "product", name: "errado" }] }),
      { services: { "svc-1": SVC }, products: {} },
    );
    expect(input.items).toEqual([]);
    expect(discarded).toHaveLength(1);
  });

  it("kind inválido ou item nulo também são descartados (sem lançar)", () => {
    const { input, discarded } = mapLocalPlanToSupabase(
      fullPlan({ items: [{ refId: SVC, kind: "xpto" as never, name: "a" }, null as never] }),
    );
    expect(input.items).toEqual([]);
    expect(discarded).toHaveLength(2);
  });

  it("plano sem itens grava items = [] (array, não ausente)", () => {
    expect(mapLocalPlanToSupabase(fullPlan({ items: [] })).input.items).toEqual([]);
  });
});

describe("planos — vocabulário literal, ida-e-volta e leitura defensiva", () => {
  it.each(BILLING_CYCLES.map((b) => [b]))("billing_cycle %s: ida-e-volta preserva o literal", (billingCycle) => {
    const { input } = mapLocalPlanToSupabase(fullPlan({ billingCycle }), { services: { "svc-1": SVC }, products: { "prod-1": PROD } });
    expect(input.billing_cycle).toBe(billingCycle);
    const row = { id: PLAN, workspace_id: "ws1", ...input, created_at: "c", updated_at: "u" } as SupabaseCommercialPlan;
    expect(mapSupabasePlanToLocal(row).billingCycle).toBe(billingCycle);
  });

  it.each(PLAN_STATUSES.map((s) => [s]))("status %s preservado", (status) => {
    expect(mapLocalPlanToSupabase(fullPlan({ status }), { services: {}, products: {} }).input.status).toBe(status);
  });

  it("todos os campos de negócio voltam idênticos na leitura (itens com uuid)", () => {
    const { input } = mapLocalPlanToSupabase(fullPlan(), { services: { "svc-1": SVC }, products: { "prod-1": PROD } });
    const row = { id: PLAN, workspace_id: "ws1", ...input, created_at: "c", updated_at: "u" } as SupabaseCommercialPlan;
    expect(mapSupabasePlanToLocal(row)).toEqual({
      id: PLAN, name: "Studio Pro", description: "Combo", billingCycle: "monthly", price: 3800,
      items: [
        { refId: SVC, kind: "service", name: "Social Media" },
        { refId: PROD, kind: "product", name: "Pack" },
      ],
      highlight: true, status: "active", isDemo: undefined, createdAt: "c", updatedAt: "u",
    });
  });

  it("leitura defensiva: items NULL/lixo, ciclo/status desconhecidos, NULLs", () => {
    const row = {
      id: PLAN, workspace_id: "ws1", name: "X", price: "10", billing_cycle: "semestral", status: "xpto",
      description: null, highlight: null, is_demo: false, created_at: "c", updated_at: "u",
      items: [null, "x", { refId: "", kind: "service" }, { refId: SVC, kind: "outro" }, { refId: SVC, kind: "service" }],
    } as unknown as SupabaseCommercialPlan;
    expect(mapSupabasePlanToLocal(row)).toMatchObject({
      billingCycle: "monthly", status: "active", description: "", highlight: false, price: 10,
      items: [{ refId: SVC, kind: "service", name: "" }],
    });
    expect(mapSupabasePlanToLocal({ ...row, items: null } as never).items).toEqual([]);
  });

  it("patch parcial: só os campos recebidos; `items` traduz e devolve descartes", () => {
    expect(mapPlanPatchToSupabase({ price: 10 })).toEqual({ patch: { price: 10 }, discarded: [] });
    const out = mapPlanPatchToSupabase(
      { items: [{ refId: "svc-1", kind: "service", name: "a" }, { refId: "svc-9", kind: "service", name: "b" }] },
      { services: { "svc-1": SVC }, products: {} },
    );
    expect(out.patch.items).toEqual([{ refId: SVC, kind: "service", name: "a" }]);
    expect(out.discarded.map((d) => d.refId)).toEqual(["svc-9"]);
  });
});
