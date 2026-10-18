// G94 / CT2 — repositórios de `products` e `commercial_plans`: forma das queries e DEGRADAÇÃO quando a
// tabela ainda não existe. Mesmo mock encadeável de catalogRepositories.test.ts — nenhuma chamada real.
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Array<{ method: string; args: unknown[] }> = [];
let result: { data: unknown; error: unknown } = { data: [], error: null };
const fromSpy = vi.fn();

function makeBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return builder;
  };
  for (const m of ["select", "eq", "is", "order", "upsert", "update"]) builder[m] = chain(m);
  builder.single = () => {
    calls.push({ method: "single", args: [] });
    return Promise.resolve(result);
  };
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => { fromSpy(table); return makeBuilder(); } },
}));

import { productsRepository } from "@/repositories/productsRepository";
import { commercialPlansRepository } from "@/repositories/commercialPlansRepository";
import { CatalogUnavailableError, isCatalogUnavailable } from "@/repositories/catalogRepositoryShared";

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const ID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const SVC = "11111111-2222-4333-8444-555555555555";

const productInput = {
  category_id: null, name: "P", description: "", price: 10, cost: null, stock: null, type: "digital", status: "active", is_demo: false,
};
const planInput = {
  name: "Plano", description: "", billing_cycle: "monthly", price: 100,
  items: [{ refId: SVC, kind: "service" as const, name: "S" }], highlight: false, status: "active", is_demo: false,
};

beforeEach(() => {
  calls.length = 0;
  fromSpy.mockClear();
  result = { data: [], error: null };
});

const call = (m: string) => calls.find((c) => c.method === m);

describe("productsRepository", () => {
  it("listProducts: tabela `products`, workspace, sem excluídos, mais novos primeiro", async () => {
    result = { data: [{ id: ID }], error: null };
    expect(await productsRepository.listProducts(WS)).toEqual([{ id: ID }]);
    expect(fromSpy).toHaveBeenCalledWith("products");
    expect(call("eq")?.args).toEqual(["workspace_id", WS]);
    expect(call("is")?.args).toEqual(["deleted_at", null]);
    expect(call("order")?.args).toEqual(["created_at", { ascending: false }]);
  });

  it("importProduct: upsert idempotente por (workspace_id, source_local_id), payload COMPLETO", async () => {
    result = { data: { id: ID }, error: null };
    await productsRepository.importProduct(WS, "inst:prod-1", productInput);
    expect(call("upsert")?.args[0]).toEqual({ workspace_id: WS, source_local_id: "inst:prod-1", ...productInput });
    expect(call("upsert")?.args[1]).toEqual({ onConflict: "workspace_id,source_local_id" });
  });

  it("importProduct: chave vazia ⇒ nada é gravado", async () => {
    await expect(productsRepository.importProduct(WS, "", productInput)).rejects.toThrow(/source_local_id/);
    expect(calls.map((c) => c.method)).not.toContain("upsert");
  });

  it("updateProduct filtra por id E workspace; softDelete grava deleted_at", async () => {
    result = { data: { id: ID }, error: null };
    await productsRepository.updateProduct(WS, ID, { price: 5 });
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["id", ID], ["workspace_id", WS]]);
    calls.length = 0;
    await productsRepository.softDeleteProduct(WS, ID);
    expect(Number.isNaN(Date.parse((call("update")?.args[0] as { deleted_at: string }).deleted_at))).toBe(false);
  });
});

describe("commercialPlansRepository", () => {
  it("listPlans: tabela `commercial_plans`, workspace, sem excluídos", async () => {
    await commercialPlansRepository.listPlans(WS);
    expect(fromSpy).toHaveBeenCalledWith("commercial_plans");
    expect(call("eq")?.args).toEqual(["workspace_id", WS]);
    expect(call("is")?.args).toEqual(["deleted_at", null]);
  });

  it("importPlan: upsert por (workspace_id, source_local_id) levando os itens (uuid) no payload", async () => {
    result = { data: { id: ID }, error: null };
    await commercialPlansRepository.importPlan(WS, "inst:plan-1", planInput);
    expect(call("upsert")?.args[0]).toEqual({ workspace_id: WS, source_local_id: "inst:plan-1", ...planInput });
    expect(call("upsert")?.args[1]).toEqual({ onConflict: "workspace_id,source_local_id" });
  });

  it("importPlan: chave vazia ⇒ nada é gravado", async () => {
    await expect(commercialPlansRepository.importPlan(WS, "  ", planInput)).rejects.toThrow(/source_local_id/);
  });

  it("updatePlan filtra id+workspace; softDeletePlan grava deleted_at", async () => {
    result = { data: { id: ID }, error: null };
    await commercialPlansRepository.updatePlan(WS, ID, { highlight: true });
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["id", ID], ["workspace_id", WS]]);
  });
});

describe("degradação: tabela ainda não criada", () => {
  it.each([
    ["products PGRST205", () => productsRepository.listProducts(WS), { code: "PGRST205", message: "Could not find the table 'public.products' in the schema cache" }],
    ["commercial_plans 42P01", () => commercialPlansRepository.listPlans(WS), { code: "42P01", message: 'relation "public.commercial_plans" does not exist' }],
  ])("%s ⇒ CatalogUnavailableError legível, sem vazar erro cru", async (_l, run, error) => {
    result = { data: null, error };
    const err = await run().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CatalogUnavailableError);
    expect(isCatalogUnavailable(err)).toBe(true);
    expect((err as Error).message).toMatch(/catálogo na nuvem ainda não está disponível/i);
    expect((err as Error).message).not.toMatch(/PGRST|42P01|schema cache/);
  });

  it("escritas degradam igual; outro erro (CHECK 23514) NÃO vira 'indisponível'", async () => {
    result = { data: null, error: { code: "PGRST205", message: "Could not find the table" } };
    await expect(productsRepository.importProduct(WS, "x:1", productInput)).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(commercialPlansRepository.softDeletePlan(WS, ID)).rejects.toBeInstanceOf(CatalogUnavailableError);

    result = { data: null, error: { code: "23514", message: 'violates check constraint "products_type_known_chk"' } };
    const err = await productsRepository.listProducts(WS).catch((e: unknown) => e);
    expect(isCatalogUnavailable(err)).toBe(false);
  });
});
