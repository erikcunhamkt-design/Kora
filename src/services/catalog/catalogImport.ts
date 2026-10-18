// G94 / CT3 (docs/architecture/etapa-5-flip-catalogo-materiais-fase-a.md §8) — núcleo PURO do import
// assistido do catálogo local → nuvem: candidatos, dependências e execução em ORDEM OBRIGATÓRIA
// categorias → serviços → produtos → planos. Sem React/localStorage aqui (a meta é injetada pelo hook).
//
//  - **Ordem:** cada etapa usa os mapas já atualizados pelas anteriores NA MESMA corrida (id local →
//    uuid em memória), então uma categoria e o serviço que a usa sobem juntos, na ordem certa.
//  - **Demo nunca importa** (`isDemo`): nem candidato é.
//  - **Idempotência (G56):** `source_local_id = ${installId}:${localId}` + upsert por
//    (workspace_id, source_local_id); o mapa persistido marca "já importado" e é refeito sozinho
//    se for perdido (o upsert reencontra a mesma linha).
//  - **Dependência (G67):** item que depende de um item LOCAL não-demo ainda não importado
//    (categoria de serviço/produto; serviço/produto de plano) só é importável se a dependência
//    está no mapa OU na mesma seleção; senão ficaria com a FK/o item perdido PARA SEMPRE (a 2ª
//    rodada não reimporta um item já importado). Dependência que NUNCA resolverá (demo ou
//    inexistente) não bloqueia: categoria vira `category_id = null` com o rótulo legado
//    preservado; item de plano sem tradução é DESCARTADO e CONTADO no relatório — nunca gravado com id local.
import type { Service } from "@/hooks/useServices";
import type { Product } from "@/hooks/useProducts";
import type { ServiceCategory } from "@/hooks/useServiceCategories";
import type { CommercialPlan, PlanItem } from "@/hooks/useCommercialPlans";
import type { SupabaseServiceCategory, SupabaseServiceCategoryInput } from "@/repositories/serviceCategoriesRepository";
import type { SupabaseService, SupabaseServiceInput } from "@/repositories/servicesRepository";
import type { SupabaseProduct, SupabaseProductInput } from "@/repositories/productsRepository";
import type { SupabaseCommercialPlan, SupabaseCommercialPlanInput } from "@/repositories/commercialPlansRepository";
import { mapLocalServiceCategoryToSupabase, mapLocalServiceToSupabase, resolveCatalogFk } from "@/services/catalog/catalogMapper";
import { mapLocalPlanToSupabase, mapLocalProductToSupabase } from "@/services/catalog/catalogProductPlanMapper";
import { buildSourceLocalId } from "@/lib/installId";
import { catalogErrorMessage } from "@/repositories/catalogRepositoryShared";

export type CatalogKind = "category" | "service" | "product" | "plan";

/** Ordem OBRIGATÓRIA do import. */
export const CATALOG_IMPORT_ORDER: readonly CatalogKind[] = ["category", "service", "product", "plan"];

export const CATALOG_KIND_LABEL: Record<CatalogKind, string> = {
  category: "Categorias",
  service: "Serviços",
  product: "Produtos",
  plan: "Planos",
};

export const CATALOG_IMPORT_META_KEY = "kora.catalog.supabaseImport.v1";

/** idLocal → uuid, por tipo de entidade. */
export interface CatalogMaps {
  categories: Record<string, string>;
  services: Record<string, string>;
  products: Record<string, string>;
  plans: Record<string, string>;
}

export interface CatalogImportMeta {
  lastImportedAt: string;
  maps: CatalogMaps;
}

export function emptyCatalogMaps(): CatalogMaps {
  return { categories: {}, services: {}, products: {}, plans: {} };
}

export function emptyCatalogMeta(): CatalogImportMeta {
  return { lastImportedAt: "", maps: emptyCatalogMaps() };
}

const MAP_KEY: Record<CatalogKind, keyof CatalogMaps> = {
  category: "categories",
  service: "services",
  product: "products",
  plan: "plans",
};

export function readCatalogImportMeta(): CatalogImportMeta {
  try {
    const raw = localStorage.getItem(CATALOG_IMPORT_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CatalogImportMeta>;
      return {
        lastImportedAt: parsed.lastImportedAt ?? "",
        maps: { ...emptyCatalogMaps(), ...(parsed.maps ?? {}) },
      };
    }
  } catch {
    // corrompido ⇒ como se nunca tivesse importado (o upsert por source_local_id refaz o mapa)
  }
  return emptyCatalogMeta();
}

export function writeCatalogImportMeta(meta: CatalogImportMeta): void {
  try {
    localStorage.setItem(CATALOG_IMPORT_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore — a UI continua funcionando
  }
}

// ───────────────────────────── candidatos ─────────────────────────────

export interface CatalogLocalData {
  categories: ServiceCategory[];
  services: Service[];
  products: Product[];
  plans: CommercialPlan[];
}

export interface CatalogRef {
  kind: CatalogKind;
  localId: string;
}

export interface CatalogCandidate {
  kind: CatalogKind;
  localId: string;
  label: string;
  status: "new" | "imported";
  /** Dependências LOCAIS não-demo ainda não importadas (precisam estar no mapa ou na mesma seleção). */
  needs: CatalogRef[];
  /** Aviso informativo (dependência que nunca resolverá: sobe sem vínculo / itens descartados). */
  warning?: string;
  /** Plano: quantos itens serão descartados por não terem tradução possível. */
  willDiscard?: number;
}

export const candidateKey = (kind: CatalogKind, localId: string) => `${kind}:${localId}`;

function nonDemoIds<T extends { id: string; isDemo?: boolean }>(list: T[]): Set<string> {
  return new Set(list.filter((x) => !x.isDemo).map((x) => x.id));
}

/** Resolução de UMA referência de categoria: já resolvida / depende / nunca resolverá. */
function categoryDependency(
  categoryId: string | undefined,
  maps: CatalogMaps,
  importableCategories: Set<string>,
): { need?: CatalogRef; unresolvable: boolean } {
  if (!categoryId) return { unresolvable: false };
  if (resolveCatalogFk(categoryId, maps.categories)) return { unresolvable: false };
  if (importableCategories.has(categoryId)) return { need: { kind: "category", localId: categoryId }, unresolvable: false };
  return { unresolvable: true };
}

function planItemDependency(
  item: PlanItem,
  maps: CatalogMaps,
  importable: { services: Set<string>; products: Set<string> },
): { need?: CatalogRef; unresolvable: boolean } {
  const isService = item.kind === "service";
  const map = isService ? maps.services : maps.products;
  if (resolveCatalogFk(item.refId, map)) return { unresolvable: false };
  const set = isService ? importable.services : importable.products;
  if (set.has(item.refId)) return { need: { kind: isService ? "service" : "product", localId: item.refId }, unresolvable: false };
  return { unresolvable: true };
}

/** Candidatos na ORDEM obrigatória; itens demo nunca aparecem. */
export function buildCatalogCandidates(data: CatalogLocalData, maps: CatalogMaps): CatalogCandidate[] {
  const importableCategories = nonDemoIds(data.categories);
  const importable = { services: nonDemoIds(data.services), products: nonDemoIds(data.products) };
  const out: CatalogCandidate[] = [];

  for (const c of data.categories) {
    if (c.isDemo) continue;
    out.push({ kind: "category", localId: c.id, label: c.name, status: maps.categories[c.id] ? "imported" : "new", needs: [] });
  }

  for (const s of data.services) {
    if (s.isDemo) continue;
    const imported = !!maps.services[s.id];
    const dep = imported ? { unresolvable: false } : categoryDependency(s.categoryId, maps, importableCategories);
    out.push({
      kind: "service", localId: s.id, label: s.name, status: imported ? "imported" : "new",
      needs: dep.need ? [dep.need] : [],
      warning: dep.unresolvable ? "categoria demo/inexistente — sobe sem vínculo de categoria (o rótulo é preservado)" : undefined,
    });
  }

  for (const p of data.products) {
    if (p.isDemo) continue;
    const imported = !!maps.products[p.id];
    const dep = imported ? { unresolvable: false } : categoryDependency(p.categoryId, maps, importableCategories);
    out.push({
      kind: "product", localId: p.id, label: p.name, status: imported ? "imported" : "new",
      needs: dep.need ? [dep.need] : [],
      warning: dep.unresolvable ? "categoria demo/inexistente — sobe sem vínculo de categoria" : undefined,
    });
  }

  for (const pl of data.plans) {
    if (pl.isDemo) continue;
    const imported = !!maps.plans[pl.id];
    const needs: CatalogRef[] = [];
    let discard = 0;
    if (!imported) {
      for (const item of pl.items ?? []) {
        const d = planItemDependency(item, maps, importable);
        if (d.need) needs.push(d.need);
        else if (d.unresolvable) discard += 1;
      }
    }
    out.push({
      kind: "plan", localId: pl.id, label: pl.name, status: imported ? "imported" : "new",
      needs,
      willDiscard: discard || undefined,
      warning: discard > 0 ? `${discard} item(ns) sem tradução (serviço/produto demo ou inexistente) serão DESCARTADOS` : undefined,
    });
  }
  return out;
}

/** Selecionável: nova E toda dependência já está no mapa ou na MESMA seleção. */
export function isSelectable(candidate: CatalogCandidate, selection: ReadonlySet<string>): boolean {
  if (candidate.status !== "new") return false;
  return candidate.needs.every((n) => selection.has(candidateKey(n.kind, n.localId)));
}

/** Todas as chaves "novas" que podem ser selecionadas JUNTAS (fecho das dependências). */
export function selectAllPending(candidates: CatalogCandidate[]): Set<string> {
  return new Set(candidates.filter((c) => c.status === "new").map((c) => candidateKey(c.kind, c.localId)));
}

// ───────────────────────────── execução ─────────────────────────────

export interface CatalogImportRepos {
  importCategory(ws: string, sourceLocalId: string, input: SupabaseServiceCategoryInput): Promise<SupabaseServiceCategory>;
  importService(ws: string, sourceLocalId: string, input: SupabaseServiceInput): Promise<SupabaseService>;
  importProduct(ws: string, sourceLocalId: string, input: SupabaseProductInput): Promise<SupabaseProduct>;
  importPlan(ws: string, sourceLocalId: string, input: SupabaseCommercialPlanInput): Promise<SupabaseCommercialPlan>;
}

/** Falha de UM item do import, com a causa REAL (G95): nunca só "N falharam". */
export interface CatalogImportFailure {
  kind: CatalogKind;
  localId: string;
  label: string;
  message: string;
}

export interface CatalogImportReport {
  created: Record<CatalogKind, string[]>;
  failed: Record<CatalogKind, string[]>;
  /** Mesma lista de `failed`, com nome do item e a mensagem real do erro. */
  failures: CatalogImportFailure[];
  /** Pulados em runtime porque a dependência falhou/não foi importada — NADA foi gravado pra eles. */
  skippedDependency: Record<CatalogKind, string[]>;
  /** Itens de plano descartados (sem tradução), por plano importado. */
  discardedPlanItems: Array<{ planId: string; planName: string; items: PlanItem[] }>;
}

function emptyBuckets(): Record<CatalogKind, string[]> {
  return { category: [], service: [], product: [], plan: [] };
}

export function emptyCatalogImportReport(): CatalogImportReport {
  return { created: emptyBuckets(), failed: emptyBuckets(), failures: [], skippedDependency: emptyBuckets(), discardedPlanItems: [] };
}

export function totalDiscarded(report: CatalogImportReport): number {
  return report.discardedPlanItems.reduce((n, p) => n + p.items.length, 0);
}

export interface ExecuteCatalogImportArgs {
  workspaceId: string;
  installId: string;
  data: CatalogLocalData;
  /** Mapas já persistidos; é CLONADO (o resultado devolve os mapas finais). */
  maps: CatalogMaps;
  /** Chaves `kind:localId` selecionadas. */
  selection: ReadonlySet<string>;
  repos: CatalogImportRepos;
  /** Chamado a cada item gravado com sucesso (o hook persiste a meta aqui — só APÓS sucesso). */
  onMapped?: (kind: CatalogKind, localId: string, uuid: string, maps: CatalogMaps) => void;
}

/**
 * Executa o import na ORDEM obrigatória. Meta/mapa só avançam depois do sucesso de cada item;
 * falha de um item não derruba os outros. Dependência verificada de novo em runtime (uma categoria que
 * falhou deixa seus serviços SEM gravar — nunca uma FK nula por acidente).
 */
export async function executeCatalogImport(args: ExecuteCatalogImportArgs): Promise<{ report: CatalogImportReport; maps: CatalogMaps }> {
  const { workspaceId, installId, data, selection, repos, onMapped } = args;
  const maps: CatalogMaps = {
    categories: { ...args.maps.categories },
    services: { ...args.maps.services },
    products: { ...args.maps.products },
    plans: { ...args.maps.plans },
  };
  const report = emptyCatalogImportReport();
  const importableCategories = nonDemoIds(data.categories);
  const importable = { services: nonDemoIds(data.services), products: nonDemoIds(data.products) };
  const selected = (kind: CatalogKind, id: string) => selection.has(candidateKey(kind, id));

  const fail = (kind: CatalogKind, localId: string, label: string, error: unknown) => {
    report.failed[kind].push(localId);
    report.failures.push({ kind, localId, label, message: catalogErrorMessage(error) });
  };

  const record = (kind: CatalogKind, localId: string, uuid: string) => {
    maps[MAP_KEY[kind]][localId] = uuid;
    report.created[kind].push(localId);
    onMapped?.(kind, localId, uuid, maps);
  };

  for (const kind of CATALOG_IMPORT_ORDER) {
    if (kind === "category") {
      for (const c of data.categories) {
        if (c.isDemo || !selected("category", c.id) || maps.categories[c.id]) continue;
        try {
          const created = await repos.importCategory(workspaceId, buildSourceLocalId(installId, c.id), mapLocalServiceCategoryToSupabase(c));
          record("category", c.id, created.id);
        } catch (error) {
          fail("category", c.id, c.name, error);
        }
      }
    } else if (kind === "service") {
      for (const s of data.services) {
        if (s.isDemo || !selected("service", s.id) || maps.services[s.id]) continue;
        const dep = categoryDependency(s.categoryId, maps, importableCategories);
        if (dep.need) { report.skippedDependency.service.push(s.id); continue; }
        try {
          const created = await repos.importService(workspaceId, buildSourceLocalId(installId, s.id), mapLocalServiceToSupabase(s, { categories: maps.categories }));
          record("service", s.id, created.id);
        } catch (error) {
          fail("service", s.id, s.name, error);
        }
      }
    } else if (kind === "product") {
      for (const p of data.products) {
        if (p.isDemo || !selected("product", p.id) || maps.products[p.id]) continue;
        const dep = categoryDependency(p.categoryId, maps, importableCategories);
        if (dep.need) { report.skippedDependency.product.push(p.id); continue; }
        try {
          const created = await repos.importProduct(workspaceId, buildSourceLocalId(installId, p.id), mapLocalProductToSupabase(p, { categories: maps.categories }));
          record("product", p.id, created.id);
        } catch (error) {
          fail("product", p.id, p.name, error);
        }
      }
    } else {
      for (const pl of data.plans) {
        if (pl.isDemo || !selected("plan", pl.id) || maps.plans[pl.id]) continue;
        const blocked = (pl.items ?? []).some((item) => planItemDependency(item, maps, importable).need);
        if (blocked) { report.skippedDependency.plan.push(pl.id); continue; }
        try {
          const { input, discarded } = mapLocalPlanToSupabase(pl, { services: maps.services, products: maps.products });
          const created = await repos.importPlan(workspaceId, buildSourceLocalId(installId, pl.id), input);
          record("plan", pl.id, created.id);
          if (discarded.length > 0) report.discardedPlanItems.push({ planId: pl.id, planName: pl.name, items: discarded });
        } catch (error) {
          fail("plan", pl.id, pl.name, error);
        }
      }
    }
  }
  return { report, maps };
}
