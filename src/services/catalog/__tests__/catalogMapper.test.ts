// G94 / CT1 — fidelidade do mapper do catálogo (categorias + serviços) local ⇄ nuvem.
// É AQUI que uma perda silenciosa de dado se esconderia: se um campo não sobrevive à
// ida-e-volta, o serviço "perde" algo ao migrar (classe G37/G83). Ida-e-volta POR CAMPO,
// vocabulário literal com acento (G40/G49), passthrough de uuid (G67). Fixtures com uuid REAL.
import { describe, it, expect } from "vitest";
import {
  BILLING_TYPES,
  mapLocalServiceCategoryToSupabase,
  mapLocalServiceToSupabase,
  mapServicePatchToSupabase,
  mapSupabaseServiceCategoryToLocal,
  mapSupabaseServiceToLocal,
  resolveCatalogFk,
} from "@/services/catalog/catalogMapper";
import type { Service } from "@/hooks/useServices";
import type { SupabaseService } from "@/repositories/servicesRepository";
import type { SupabaseServiceCategory } from "@/repositories/serviceCategoriesRepository";

const CAT_UUID = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";
const SVC_UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

function fullService(overrides: Partial<Service> = {}): Service {
  return {
    id: "svc-1700000000000",
    name: "Identidade Visual",
    description: "Logo, paleta e mini-guia.",
    category: "Branding",
    categoryId: "cat-branding",
    price: 3500,
    billingType: "único",
    deliveryDays: 15,
    active: true,
    tags: ["marca", "logo"],
    availableInQuotes: true,
    showInPublicCatalog: true,
    notes: "interno: margem 40%",
    isDemo: false,
    ...overrides,
  };
}

/** O que o banco devolveria depois do upsert do payload (id/timestamps do servidor). */
function asRow(payload: ReturnType<typeof mapLocalServiceToSupabase>, extra: Partial<SupabaseService> = {}): SupabaseService {
  return {
    id: SVC_UUID, workspace_id: "ws1", source_local_id: "inst:svc-1", deleted_at: null,
    created_at: "2026-10-17T00:00:00Z", updated_at: "2026-10-17T00:00:00Z",
    ...payload, ...extra,
  } as SupabaseService;
}

describe("resolveCatalogFk (G67)", () => {
  it("uuid direto passa direto, mesmo com mapa vazio", () => {
    expect(resolveCatalogFk(CAT_UUID, {})).toBe(CAT_UUID);
  });

  it("id local mapeado → uuid do mapa; não mapeado → null (NUNCA o id local cru)", () => {
    expect(resolveCatalogFk("cat-branding", { "cat-branding": CAT_UUID })).toBe(CAT_UUID);
    expect(resolveCatalogFk("cat-social", { "cat-branding": CAT_UUID })).toBeNull();
  });

  it("vazio/undefined/null → null", () => {
    expect(resolveCatalogFk(undefined, {})).toBeNull();
    expect(resolveCatalogFk(null, {})).toBeNull();
    expect(resolveCatalogFk("", {})).toBeNull();
  });
});

describe("mapLocalServiceToSupabase — payload COMPLETO (G37)", () => {
  it("leva TODOS os campos do serviço pra uma coluna, nenhum fica de fora", () => {
    const out = mapLocalServiceToSupabase(fullService(), { categories: { "cat-branding": CAT_UUID } });

    expect(out).toEqual({
      category_id: CAT_UUID,
      category: "Branding",
      name: "Identidade Visual",
      description: "Logo, paleta e mini-guia.",
      price: 3500,
      billing_type: "único",
      delivery_days: 15,
      active: true,
      tags: ["marca", "logo"],
      available_in_quotes: true,
      show_in_public_catalog: true,
      notes: "interno: margem 40%",
      is_demo: false,
    });
  });

  it("categoria NÃO resolvida: category_id = null mas o rótulo legado `category` é preservado", () => {
    const out = mapLocalServiceToSupabase(fullService(), { categories: {} });
    expect(out.category_id).toBeNull();
    expect(out.category).toBe("Branding");
  });

  it("categoryId que já é uuid (categoria lida da nuvem) vai direto, sem mapa", () => {
    const out = mapLocalServiceToSupabase(fullService({ categoryId: CAT_UUID }));
    expect(out.category_id).toBe(CAT_UUID);
  });

  it("defaults dos opcionais: availableInQuotes=true, showInPublicCatalog=false, notes=null, tags=[]", () => {
    const out = mapLocalServiceToSupabase(
      fullService({ availableInQuotes: undefined, showInPublicCatalog: undefined, notes: undefined, tags: undefined }),
    );
    expect(out.available_in_quotes).toBe(true);
    expect(out.show_in_public_catalog).toBe(false);
    expect(out.notes).toBeNull();
    expect(out.tags).toEqual([]);
  });

  it("price quantizado em centavos; prazo negativo/inválido vira 0; demo preservado fielmente", () => {
    const out = mapLocalServiceToSupabase(fullService({ price: 99.999, deliveryDays: -3, isDemo: true }));
    expect(out.price).toBe(100);
    expect(out.delivery_days).toBe(0);
    expect(out.is_demo).toBe(true);
  });
});

describe("vocabulário literal (G40/G49) — billing_type com acento, sem tradução", () => {
  it.each(BILLING_TYPES.map((b) => [b]))("%s: ida-e-volta preserva o literal", (billingType) => {
    const row = asRow(mapLocalServiceToSupabase(fullService({ billingType })));
    expect(row.billing_type).toBe(billingType);
    expect(mapSupabaseServiceToLocal(row).billingType).toBe(billingType);
  });

  it("\"único\" (com acento) sobrevive à ida-e-volta — não vira \"unico\"", () => {
    const payload = mapLocalServiceToSupabase(fullService({ billingType: "único" }));
    expect(payload.billing_type).toBe("único");
    expect(payload.billing_type).not.toBe("unico");
  });

  it("valor FORA do vocabulário local cai em \"único\" na escrita (nunca grava lixo que o CHECK recusaria)", () => {
    const out = mapLocalServiceToSupabase(fullService({ billingType: "semanal" as never }));
    expect(out.billing_type).toBe("único");
  });

  it("linha da nuvem com billing_type desconhecido: leitura cai em \"único\" (a lista não quebra)", () => {
    const row = asRow(mapLocalServiceToSupabase(fullService()), { billing_type: "valor-invalido" });
    expect(mapSupabaseServiceToLocal(row).billingType).toBe("único");
  });
});

describe("ida-e-volta por campo (escrita → leitura devolve o mesmo)", () => {
  const names = { [CAT_UUID]: "Branding (nuvem)" };

  it("todos os campos de negócio voltam idênticos", () => {
    const local = fullService();
    const row = asRow(mapLocalServiceToSupabase(local, { categories: { "cat-branding": CAT_UUID } }));

    const back = mapSupabaseServiceToLocal(row, names);

    expect(back).toMatchObject({
      id: SVC_UUID, // o id volta como o uuid da nuvem (string, sem Number())
      name: local.name,
      description: local.description,
      price: local.price,
      billingType: local.billingType,
      deliveryDays: local.deliveryDays,
      active: local.active,
      tags: local.tags,
      availableInQuotes: local.availableInQuotes,
      showInPublicCatalog: local.showInPublicCatalog,
      notes: local.notes,
      categoryId: CAT_UUID,
    });
  });

  it("o rótulo exibido vem do NOME da categoria da nuvem; sem categoria resolvida cai no rótulo legado", () => {
    const row = asRow(mapLocalServiceToSupabase(fullService(), { categories: { "cat-branding": CAT_UUID } }));
    expect(mapSupabaseServiceToLocal(row, names).category).toBe("Branding (nuvem)");
    expect(mapSupabaseServiceToLocal(row, {}).category).toBe("Branding");
  });

  it("serviço desativado e sem opcionais: active=false e defaults sobrevivem", () => {
    const row = asRow(mapLocalServiceToSupabase(fullService({ active: false, tags: [], notes: undefined, availableInQuotes: false })));
    const back = mapSupabaseServiceToLocal(row);
    expect(back.active).toBe(false);
    expect(back.availableInQuotes).toBe(false);
    expect(back.tags).toEqual([]);
    expect(back.notes).toBeUndefined();
  });

  it("price numeric do PostgREST (string) vira number", () => {
    const row = asRow(mapLocalServiceToSupabase(fullService()), { price: "1234.50" });
    expect(mapSupabaseServiceToLocal(row).price).toBe(1234.5);
  });

  it("leitura defensiva: colunas opcionais NULL não quebram nem viram 'undefined' sujo", () => {
    const row = {
      id: SVC_UUID, workspace_id: "ws1", name: "Mínimo", price: 10, billing_type: "mensal", is_demo: false,
      created_at: "", updated_at: "",
      description: null, category: null, category_id: null, delivery_days: null, active: undefined,
      tags: null, available_in_quotes: null, show_in_public_catalog: null, notes: null,
    } as unknown as SupabaseService;

    expect(mapSupabaseServiceToLocal(row)).toMatchObject({
      description: "", category: "", categoryId: undefined, deliveryDays: 0, active: true,
      tags: [], availableInQuotes: true, showInPublicCatalog: false, notes: undefined,
    });
  });
});

describe("mapServicePatchToSupabase — edição leva exatamente os campos recebidos", () => {
  it("patch só de preço: só `price` vai (nada é zerado por omissão)", () => {
    expect(mapServicePatchToSupabase({ price: 150 })).toEqual({ price: 150 });
  });

  it("patch com todos os campos converte cada um como o payload completo", () => {
    const out = mapServicePatchToSupabase(
      { name: "N", description: "D", category: "Cat", categoryId: CAT_UUID, price: 1.005, billingType: "mensal",
        deliveryDays: 7, active: false, tags: ["a"], availableInQuotes: false, showInPublicCatalog: true, notes: undefined },
    );
    expect(out).toEqual({
      name: "N", description: "D", category: "Cat", category_id: CAT_UUID, price: 1.01, billing_type: "mensal",
      delivery_days: 7, active: false, tags: ["a"], available_in_quotes: false, show_in_public_catalog: true,
    });
  });

  it("patch com notes: null/vazio limpa a coluna; categoryId não resolvido limpa category_id (nunca id local cru)", () => {
    expect(mapServicePatchToSupabase({ notes: "" })).toEqual({ notes: "" });
    expect(mapServicePatchToSupabase({ categoryId: "cat-x" })).toEqual({ category_id: null });
  });

  it("billingType inválido no patch vira \"único\" (não envia lixo ao CHECK)", () => {
    expect(mapServicePatchToSupabase({ billingType: "xpto" as never })).toEqual({ billing_type: "único" });
  });
});

describe("categorias", () => {
  it("ida-e-volta de nome e cor; uuid volta como id", () => {
    const payload = mapLocalServiceCategoryToSupabase({ id: "cat-branding", name: "Branding", color: "#F81040" });
    expect(payload).toEqual({ name: "Branding", color: "#F81040", is_demo: false });

    const row = { id: CAT_UUID, workspace_id: "ws1", ...payload, created_at: "", updated_at: "" } as SupabaseServiceCategory;
    expect(mapSupabaseServiceCategoryToLocal(row)).toEqual({ id: CAT_UUID, name: "Branding", color: "#F81040", isDemo: undefined });
  });

  it("cor vazia ganha o default; demo preservado", () => {
    expect(mapLocalServiceCategoryToSupabase({ id: "c", name: "X", color: "", isDemo: true })).toEqual({
      name: "X", color: "#8B5CF6", is_demo: true,
    });
  });
});
