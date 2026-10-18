// G94 / CT3 — núcleo puro do import assistido do catálogo (categorias → serviços → produtos → planos).
// Repositórios FALSOS que devolvem uuid REAL (determinístico) e registram a ordem das chamadas.
// Prova: ordem obrigatória, FKs traduzidas (nunca id local numa coluna uuid), source_local_id, demo nunca
// importa, idempotência (2ª rodada = 0 novos), descarte CONTADO de itens de plano, falha de dependência
// não grava o dependente, meta só avança após sucesso.
import { describe, it, expect, beforeEach } from "vitest";
import {
  CATALOG_IMPORT_ORDER,
  buildCatalogCandidates,
  candidateKey,
  emptyCatalogMaps,
  executeCatalogImport,
  isSelectable,
  selectAllPending,
  totalDiscarded,
  type CatalogImportRepos,
  type CatalogLocalData,
  type CatalogMaps,
} from "@/services/catalog/catalogImport";
import { toCatalogError } from "@/repositories/catalogRepositoryShared";

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const INST = "0a1b2c3d-1111-4222-8333-444455556666";

let seq = 0;
const nextUuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

type Call = { kind: string; src: string; input: Record<string, unknown> };

function makeRepos(opts: { failCategory?: string[] } = {}) {
  const calls: Call[] = [];
  // idempotência real do servidor: mesmo source_local_id ⇒ mesma linha (mesmo uuid)
  const bySource = new Map<string, string>();
  const idFor = (src: string) => {
    if (!bySource.has(src)) bySource.set(src, nextUuid());
    return bySource.get(src)!;
  };
  const repos: CatalogImportRepos = {
    importCategory: async (_ws, src, input) => {
      calls.push({ kind: "category", src, input: input as never });
      if (opts.failCategory?.some((id) => src.endsWith(`:${id}`))) throw new Error("boom");
      return { id: idFor(src) } as never;
    },
    importService: async (_ws, src, input) => { calls.push({ kind: "service", src, input: input as never }); return { id: idFor(src) } as never; },
    importProduct: async (_ws, src, input) => { calls.push({ kind: "product", src, input: input as never }); return { id: idFor(src) } as never; },
    importPlan: async (_ws, src, input) => { calls.push({ kind: "plan", src, input: input as never }); return { id: idFor(src) } as never; },
  };
  return { repos, calls };
}

const T = "2026-10-18T00:00:00.000Z";

function data(): CatalogLocalData {
  return {
    categories: [
      { id: "cat-1", name: "Branding", color: "#F81040" },
      { id: "cat-demo", name: "Demo", color: "#000000", isDemo: true },
    ],
    services: [
      { id: "svc-1", name: "Logo", description: "d", category: "Branding", categoryId: "cat-1", price: 1000, billingType: "único", deliveryDays: 7, active: true },
      { id: "svc-2", name: "Demo svc", description: "", category: "x", price: 1, billingType: "mensal", deliveryDays: 1, active: true, isDemo: true },
      { id: "svc-3", name: "Sem cat", description: "", category: "Outro", categoryId: "cat-demo", price: 5, billingType: "mensal", deliveryDays: 1, active: true },
    ],
    products: [
      { id: "prod-1", name: "Pack", description: "", categoryId: "cat-1", price: 149, cost: 20, stock: 3, type: "digital", status: "active", createdAt: T, updatedAt: T },
      { id: "prod-demo", name: "Demo prod", description: "", price: 1, type: "digital", status: "active", isDemo: true, createdAt: T, updatedAt: T },
    ],
    plans: [
      {
        id: "plan-1", name: "Studio", description: "", billingCycle: "monthly", price: 3800, highlight: false, status: "active", createdAt: T, updatedAt: T,
        items: [
          { refId: "svc-1", kind: "service", name: "Logo" },
          { refId: "prod-1", kind: "product", name: "Pack" },
          { refId: "svc-2", kind: "service", name: "Demo svc" }, // demo ⇒ nunca terá uuid ⇒ descartado
          { refId: "svc-ghost", kind: "service", name: "Fantasma" }, // inexistente ⇒ descartado
        ],
      },
      { id: "plan-demo", name: "Demo plan", description: "", billingCycle: "monthly", price: 1, items: [], highlight: false, status: "active", isDemo: true, createdAt: T, updatedAt: T },
    ],
  };
}

const all = (d: CatalogLocalData) => selectAllPending(buildCatalogCandidates(d, emptyCatalogMaps()));

beforeEach(() => { seq = 0; });

describe("buildCatalogCandidates", () => {
  it("demo nunca é candidato; ordem categorias → serviços → produtos → planos", () => {
    const c = buildCatalogCandidates(data(), emptyCatalogMaps());
    expect(c.map((x) => candidateKey(x.kind, x.localId))).toEqual([
      "category:cat-1", "service:svc-1", "service:svc-3", "product:prod-1", "plan:plan-1",
    ]);
    expect(c.every((x) => x.status === "new")).toBe(true);
  });

  it("dependência local não-demo ainda não importada vira `needs`; só é selecionável junto da dependência", () => {
    const c = buildCatalogCandidates(data(), emptyCatalogMaps());
    const svc1 = c.find((x) => x.localId === "svc-1")!;
    expect(svc1.needs).toEqual([{ kind: "category", localId: "cat-1" }]);
    expect(isSelectable(svc1, new Set())).toBe(false);
    expect(isSelectable(svc1, new Set(["category:cat-1"]))).toBe(true);
    const plan = c.find((x) => x.localId === "plan-1")!;
    expect(plan.needs.map((n) => n.localId).sort()).toEqual(["prod-1", "svc-1"]);
  });

  it("dependência que NUNCA resolverá não bloqueia: avisa (categoria demo) e conta itens de plano a descartar", () => {
    const c = buildCatalogCandidates(data(), emptyCatalogMaps());
    const svc3 = c.find((x) => x.localId === "svc-3")!;
    expect(svc3.needs).toEqual([]);
    expect(svc3.warning).toMatch(/sem vínculo/i);
    const plan = c.find((x) => x.localId === "plan-1")!;
    expect(plan.willDiscard).toBe(2);
    expect(plan.warning).toMatch(/2 item\(ns\).*DESCARTADOS/);
  });

  it("já mapeado ⇒ status `imported`, sem needs e fora do selectAllPending", () => {
    const maps: CatalogMaps = { ...emptyCatalogMaps(), categories: { "cat-1": nextUuid() } };
    const c = buildCatalogCandidates(data(), maps);
    expect(c.find((x) => x.localId === "cat-1")!.status).toBe("imported");
    expect(c.find((x) => x.localId === "svc-1")!.needs).toEqual([]); // categoria já traduzida
    expect(selectAllPending(c).has("category:cat-1")).toBe(false);
  });
});

describe("executeCatalogImport", () => {
  it("importa em ORDEM e traduz as FKs pelos uuid recém-criados (nunca id local)", async () => {
    const { repos, calls } = makeRepos();
    const d = data();
    const { report, maps } = await executeCatalogImport({
      workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos,
    });

    const order = calls.map((c) => c.kind);
    const firstIdx = (k: string) => order.indexOf(k);
    const lastIdx = (k: string) => order.lastIndexOf(k);
    expect(lastIdx("category")).toBeLessThan(firstIdx("service"));
    expect(lastIdx("service")).toBeLessThan(firstIdx("product"));
    expect(lastIdx("product")).toBeLessThan(firstIdx("plan"));
    expect(CATALOG_IMPORT_ORDER).toEqual(["category", "service", "product", "plan"]);

    // source_local_id = installId:localId (G56)
    expect(calls.find((c) => c.kind === "category")!.src).toBe(`${INST}:cat-1`);

    // FK traduzida pro uuid da categoria
    const catUuid = maps.categories["cat-1"];
    expect(catUuid).toMatch(/^[0-9a-f-]{36}$/);
    expect(calls.find((c) => c.kind === "service" && c.src.endsWith(":svc-1"))!.input.category_id).toBe(catUuid);
    expect(calls.find((c) => c.kind === "product")!.input.category_id).toBe(catUuid);
    // categoria demo nunca vira FK
    expect(calls.find((c) => c.kind === "service" && c.src.endsWith(":svc-3"))!.input.category_id).toBeNull();

    // itens do plano traduzidos pra uuid; sem tradução ⇒ fora do payload
    const plan = calls.find((c) => c.kind === "plan")!;
    expect(plan.input.items).toEqual([
      { refId: maps.services["svc-1"], kind: "service", name: "Logo" },
      { refId: maps.products["prod-1"], kind: "product", name: "Pack" },
    ]);
    const serialized = JSON.stringify(calls.map((c) => c.input));
    for (const raw of ["svc-1", "prod-1", "svc-2", "svc-ghost", "cat-1", "cat-demo"]) expect(serialized).not.toContain(`"${raw}"`);

    expect(report.created.category).toEqual(["cat-1"]);
    expect(report.created.service.sort()).toEqual(["svc-1", "svc-3"]);
    expect(report.created.product).toEqual(["prod-1"]);
    expect(report.created.plan).toEqual(["plan-1"]);
    expect(report.failed.category).toHaveLength(0);
  });

  it("descarte CONTADO: relatório lista o plano e os itens descartados", async () => {
    const { repos } = makeRepos();
    const d = data();
    const { report } = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos });
    expect(report.discardedPlanItems).toHaveLength(1);
    expect(report.discardedPlanItems[0]).toMatchObject({ planId: "plan-1", planName: "Studio" });
    expect(report.discardedPlanItems[0].items.map((i) => i.refId).sort()).toEqual(["svc-2", "svc-ghost"]);
    expect(totalDiscarded(report)).toBe(2);
  });

  it("demo nunca é gravado, mesmo se vier na seleção", async () => {
    const { repos, calls } = makeRepos();
    const d = data();
    const selection = new Set([...all(d), "category:cat-demo", "service:svc-2", "product:prod-demo", "plan:plan-demo"]);
    await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection, repos });
    expect(calls.some((c) => /demo/.test(c.src) || c.src.endsWith(":svc-2"))).toBe(false);
  });

  it("IDEMPOTÊNCIA: 2ª rodada com o mapa da 1ª = 0 novos e 0 chamadas", async () => {
    const { repos, calls } = makeRepos();
    const d = data();
    const first = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos });
    const created1 = CATALOG_IMPORT_ORDER.reduce((n, k) => n + first.report.created[k].length, 0);
    expect(created1).toBe(5);

    const cand2 = buildCatalogCandidates(d, first.maps);
    expect(cand2.every((c) => c.status === "imported")).toBe(true);
    expect(selectAllPending(cand2).size).toBe(0);

    calls.length = 0;
    const second = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: first.maps, selection: new Set(cand2.map((c) => candidateKey(c.kind, c.localId))), repos });
    expect(calls).toHaveLength(0);
    expect(CATALOG_IMPORT_ORDER.reduce((n, k) => n + second.report.created[k].length, 0)).toBe(0);
    expect(second.report.discardedPlanItems).toHaveLength(0);
  });

  it("mapa PERDIDO: reimportar reencontra as MESMAS linhas (mesmo source_local_id ⇒ mesmos uuid), sem duplicar", async () => {
    const { repos } = makeRepos();
    const d = data();
    const first = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos });
    const again = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos });
    expect(again.maps).toEqual(first.maps);
  });

  it("falha da categoria ⇒ o serviço/produto dependente NÃO é gravado (skippedDependency), sem FK nula por acidente", async () => {
    const { repos, calls } = makeRepos({ failCategory: ["cat-1"] });
    const d = data();
    const { report, maps } = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos });
    expect(report.failed.category).toEqual(["cat-1"]);
    expect(report.skippedDependency.service).toEqual(["svc-1"]);
    expect(report.skippedDependency.product).toEqual(["prod-1"]);
    expect(report.skippedDependency.plan).toEqual(["plan-1"]);
    expect(calls.some((c) => c.src.endsWith(":svc-1") || c.src.endsWith(":prod-1") || c.kind === "plan")).toBe(false);
    expect(maps.categories["cat-1"]).toBeUndefined();
    // o serviço sem dependência pendente (categoria demo) sobe normalmente
    expect(report.created.service).toEqual(["svc-3"]);
  });

  it("G95: a causa REAL de cada falha vai pro relatório (nome do item + mensagem), não só o id", async () => {
    const { repos } = makeRepos();
    repos.importCategory = async () => { throw toCatalogError({ code: "23514", message: 'new row for relation "service_categories" violates check constraint "x_chk"' }); };
    const d = data();
    const { report } = await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos });
    expect(report.failed.category).toEqual(["cat-1"]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatchObject({ kind: "category", localId: "cat-1", label: "Branding" });
    expect(report.failures[0].message).toContain('violates check constraint "x_chk"');
    // dependentes pulados NÃO viram "falha" (não houve tentativa) — ficam em skippedDependency
    expect(report.failures.map((f) => f.kind)).toEqual(["category"]);
  });

  it("meta só avança APÓS sucesso: onMapped dispara por item gravado, nunca por falha", async () => {
    const { repos } = makeRepos({ failCategory: ["cat-1"] });
    const d = data();
    const mapped: string[] = [];
    await executeCatalogImport({
      workspaceId: WS, installId: INST, data: d, maps: emptyCatalogMaps(), selection: all(d), repos,
      onMapped: (kind, localId) => mapped.push(`${kind}:${localId}`),
    });
    expect(mapped).toEqual(["service:svc-3"]);
  });

  it("não muta o mapa recebido (clonado)", async () => {
    const { repos } = makeRepos();
    const d = data();
    const input = emptyCatalogMaps();
    await executeCatalogImport({ workspaceId: WS, installId: INST, data: d, maps: input, selection: all(d), repos });
    expect(input).toEqual(emptyCatalogMaps());
  });
});
