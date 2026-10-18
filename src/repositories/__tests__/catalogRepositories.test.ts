// G94 / CT1 — repositórios do catálogo (service_categories, services): forma das queries e
// DEGRADAÇÃO quando a tabela ainda não existe (DDL do operador pendente). Mock encadeável do
// client do Supabase — nenhuma chamada real.
import { describe, it, expect, vi, beforeEach } from "vitest";

const calls: Array<{ method: string; args: unknown[] }> = [];
let result: { data: unknown; error: unknown } = { data: [], error: null };
const fromSpy = vi.fn();

// builder encadeável e "thenable" (await direto na listagem) / `.single()` (escritas)
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
  supabase: {
    from: (table: string) => {
      fromSpy(table);
      return makeBuilder();
    },
  },
}));

import { servicesRepository } from "@/repositories/servicesRepository";
import { serviceCategoriesRepository } from "@/repositories/serviceCategoriesRepository";
import {
  CatalogUnavailableError,
  isCatalogUnavailable,
  isMissingTableError,
} from "@/repositories/catalogRepositoryShared";

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const SVC = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

const input = {
  category_id: null, category: "Branding", name: "Serviço", description: "", price: 100, billing_type: "único",
  delivery_days: 5, active: true, tags: [], available_in_quotes: true, show_in_public_catalog: false,
  notes: null, is_demo: false,
};

beforeEach(() => {
  calls.length = 0;
  fromSpy.mockClear();
  result = { data: [], error: null };
});

const methods = () => calls.map((c) => c.method);
const call = (m: string) => calls.find((c) => c.method === m);

describe("servicesRepository", () => {
  it("listServices: tabela `services`, escopo do workspace, sem excluídos, mais novos primeiro", async () => {
    result = { data: [{ id: SVC, name: "A" }], error: null };

    const rows = await servicesRepository.listServices(WS);

    expect(fromSpy).toHaveBeenCalledWith("services");
    expect(call("eq")?.args).toEqual(["workspace_id", WS]);
    expect(call("is")?.args).toEqual(["deleted_at", null]);
    expect(call("order")?.args).toEqual(["created_at", { ascending: false }]);
    expect(rows).toEqual([{ id: SVC, name: "A" }]);
  });

  it("listServices: data nulo ⇒ lista vazia", async () => {
    result = { data: null, error: null };
    expect(await servicesRepository.listServices(WS)).toEqual([]);
  });

  it("importService: upsert idempotente por (workspace_id, source_local_id) com o payload COMPLETO", async () => {
    result = { data: { id: SVC }, error: null };

    await servicesRepository.importService(WS, "inst-1:svc-1", input);

    const up = call("upsert");
    expect(up?.args[0]).toEqual({ workspace_id: WS, source_local_id: "inst-1:svc-1", ...input });
    expect(up?.args[1]).toEqual({ onConflict: "workspace_id,source_local_id" });
  });

  it("importService: sem source_local_id não escreve (sem arbiter de idempotência)", async () => {
    await expect(servicesRepository.importService(WS, "  ", input)).rejects.toThrow(/source_local_id/);
    expect(methods()).not.toContain("upsert");
  });

  it("updateService: filtra por id E workspace (nunca atualiza linha de outro workspace)", async () => {
    result = { data: { id: SVC }, error: null };

    await servicesRepository.updateService(WS, SVC, { price: 150 });

    expect(call("update")?.args[0]).toEqual({ price: 150 });
    expect(calls.filter((c) => c.method === "eq").map((c) => c.args)).toEqual([["id", SVC], ["workspace_id", WS]]);
  });

  it("softDeleteService: grava deleted_at (ISO) — nunca DELETE", async () => {
    result = { data: { id: SVC }, error: null };

    await servicesRepository.softDeleteService(WS, SVC);

    const patch = call("update")?.args[0] as { deleted_at: string };
    expect(Number.isNaN(Date.parse(patch.deleted_at))).toBe(false);
  });
});

describe("serviceCategoriesRepository", () => {
  it("listCategories: tabela `service_categories`, escopo do workspace, sem excluídas", async () => {
    await serviceCategoriesRepository.listCategories(WS);
    expect(fromSpy).toHaveBeenCalledWith("service_categories");
    expect(call("eq")?.args).toEqual(["workspace_id", WS]);
    expect(call("is")?.args).toEqual(["deleted_at", null]);
  });

  it("importCategory: upsert por (workspace_id, source_local_id)", async () => {
    result = { data: { id: "c1" }, error: null };
    await serviceCategoriesRepository.importCategory(WS, "native:abc", { name: "Branding", color: "#fff", is_demo: false });
    expect(call("upsert")?.args[1]).toEqual({ onConflict: "workspace_id,source_local_id" });
  });
});

describe("degradação: tabela ainda não criada no banco", () => {
  it.each([
    ["PGRST205", { code: "PGRST205", message: "Could not find the table 'public.services' in the schema cache" }],
    ["42P01", { code: "42P01", message: 'relation "public.services" does not exist' }],
    ["só pela mensagem", { message: "Could not find the table 'public.service_categories' in the schema cache" }],
  ])("listServices com %s ⇒ CatalogUnavailableError (mensagem legível, sem vazar erro cru)", async (_label, error) => {
    result = { data: null, error };

    const err = await servicesRepository.listServices(WS).catch((e) => e);

    expect(err).toBeInstanceOf(CatalogUnavailableError);
    expect(isCatalogUnavailable(err)).toBe(true);
    expect((err as Error).message).toMatch(/catálogo na nuvem ainda não está disponível/i);
    expect((err as Error).message).not.toMatch(/PGRST|42P01|schema cache/);
  });

  it("escritas também degradam com a mesma mensagem legível", async () => {
    result = { data: null, error: { code: "PGRST205", message: "Could not find the table" } };
    await expect(servicesRepository.importService(WS, "native:x", input)).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(serviceCategoriesRepository.softDeleteCategory(WS, "c1")).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it("OUTROS erros NÃO viram 'indisponível' (ex.: violação de CHECK segue a mensagem normalizada)", async () => {
    result = { data: null, error: { code: "23514", message: 'violates check constraint "services_billing_type_known_chk"' } };

    const err = await servicesRepository.listServices(WS).catch((e) => e);

    expect(isCatalogUnavailable(err)).toBe(false);
    expect((err as Error).message).toMatch(/regras de validação|validation/i);
  });

  it("isMissingTableError: reconhece só ausência de tabela", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingTableError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError("x")).toBe(false);
  });
});
