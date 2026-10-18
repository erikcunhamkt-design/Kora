// G94 / CT2 (docs/architecture/etapa-5-flip-catalogo-materiais-fase-a.md §7) — mapper de PRODUTOS e
// PLANOS COMERCIAIS local ⇄ nuvem. Mesmo molde de catalogMapper.ts (CT1). Sem UI, sem flip.
//
//  - G40/G49: `type`/`status` de produto e `billing_cycle`/`status` de plano guardam o literal LOCAL
//    (inglês) — espelham os CHECKs dos drafts 6.3/6.4; valor fora do vocabulário cai no default.
//  - G67: id local ("prod-…", "svc-…") nunca é uuid — `resolveCatalogFk` (passthrough/mapa/null).
//  - G37: payload completo; `cost`/`stock` opcionais viram NULL (não 0 inventado).
//  - **Planos:** os itens referenciam serviços/produtos por UUID na nuvem. A tradução id local→uuid é
//    responsabilidade do import (CT3); o mapper só faz passthrough + mapa. Item sem tradução é
//    DESCARTADO e devolvido em `discarded` (contagem pro relatório do import) — NUNCA gravado com id
//    local cru (decisão da Fase A, risco R1).
import type { Product, ProductStatus, ProductType } from "@/hooks/useProducts";
import type { BillingCycle, CommercialPlan, PlanItem, PlanStatus } from "@/hooks/useCommercialPlans";
import type { SupabaseProduct, SupabaseProductInput } from "@/repositories/productsRepository";
import type {
  SupabaseCommercialPlan,
  SupabaseCommercialPlanInput,
  SupabasePlanItem,
} from "@/repositories/commercialPlansRepository";
import { EMPTY_CATALOG_IMPORT_MAPS, resolveCatalogFk, type CatalogImportMaps } from "@/services/catalog/catalogMapper";
import { roundMoney } from "@/services/quotes/quoteMoney";

// ─────────────────────────────── produtos ───────────────────────────────

export const PRODUCT_TYPES: readonly ProductType[] = ["digital", "physical", "addon", "template", "consulting"];
export const PRODUCT_STATUSES: readonly ProductStatus[] = ["active", "inactive"];
export const DEFAULT_PRODUCT_TYPE: ProductType = "digital";
export const DEFAULT_PRODUCT_STATUS: ProductStatus = "active";

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && (PRODUCT_TYPES as readonly string[]).includes(value);
}
export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && (PRODUCT_STATUSES as readonly string[]).includes(value);
}

function toStockOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function toCostOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? roundMoney(n) : null;
}

/** Produto local → payload COMPLETO (G37). `categoryId` por passthrough/mapa (nunca id local cru — G67). */
export function mapLocalProductToSupabase(
  product: Omit<Product, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string },
  maps: CatalogImportMaps = EMPTY_CATALOG_IMPORT_MAPS,
): SupabaseProductInput {
  return {
    category_id: resolveCatalogFk(product.categoryId, maps.categories),
    name: product.name,
    description: product.description ?? "",
    price: roundMoney(product.price),
    cost: toCostOrNull(product.cost),
    stock: toStockOrNull(product.stock),
    type: isProductType(product.type) ? product.type : DEFAULT_PRODUCT_TYPE,
    status: isProductStatus(product.status) ? product.status : DEFAULT_PRODUCT_STATUS,
    is_demo: !!product.isDemo,
  };
}

/** Patch parcial: só os campos recebidos, cada um com a mesma conversão do payload completo. */
export function mapProductPatchToSupabase(
  patch: Partial<Product>,
  maps: CatalogImportMaps = EMPTY_CATALOG_IMPORT_MAPS,
): Partial<SupabaseProductInput> {
  const out: Partial<SupabaseProductInput> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.description !== undefined) out.description = patch.description ?? "";
  if (patch.categoryId !== undefined) out.category_id = resolveCatalogFk(patch.categoryId, maps.categories);
  if (patch.price !== undefined) out.price = roundMoney(patch.price);
  if (patch.cost !== undefined) out.cost = toCostOrNull(patch.cost);
  if (patch.stock !== undefined) out.stock = toStockOrNull(patch.stock);
  if (patch.type !== undefined) out.type = isProductType(patch.type) ? patch.type : DEFAULT_PRODUCT_TYPE;
  if (patch.status !== undefined) out.status = isProductStatus(patch.status) ? patch.status : DEFAULT_PRODUCT_STATUS;
  return out;
}

/** Linha da nuvem → `Product` local (leitura defensiva de NULLs e de vocabulário desconhecido). */
export function mapSupabaseProductToLocal(row: SupabaseProduct): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    categoryId: row.category_id ?? undefined,
    price: Number(row.price ?? 0),
    cost: row.cost === null || row.cost === undefined ? undefined : Number(row.cost),
    stock: row.stock === null || row.stock === undefined ? undefined : Number(row.stock),
    type: isProductType(row.type) ? row.type : DEFAULT_PRODUCT_TYPE,
    status: isProductStatus(row.status) ? row.status : DEFAULT_PRODUCT_STATUS,
    isDemo: row.is_demo || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─────────────────────────────── planos comerciais ───────────────────────────────

export const BILLING_CYCLES: readonly BillingCycle[] = ["one_time", "monthly", "quarterly", "yearly"];
export const PLAN_STATUSES: readonly PlanStatus[] = ["active", "inactive"];
export const DEFAULT_BILLING_CYCLE: BillingCycle = "monthly";
export const DEFAULT_PLAN_STATUS: PlanStatus = "active";

export function isBillingCycle(value: unknown): value is BillingCycle {
  return typeof value === "string" && (BILLING_CYCLES as readonly string[]).includes(value);
}
export function isPlanStatus(value: unknown): value is PlanStatus {
  return typeof value === "string" && (PLAN_STATUSES as readonly string[]).includes(value);
}

/** Import-maps pra traduzir os itens de um plano (chaves = `String(idLocal)`, valores = uuid). */
export interface PlanItemMaps {
  services: Record<string, string>;
  products: Record<string, string>;
}
export const EMPTY_PLAN_ITEM_MAPS: PlanItemMaps = { services: {}, products: {} };

export interface PlanMappingResult {
  input: SupabaseCommercialPlanInput;
  /** Itens SEM tradução pra uuid — DESCARTADOS (nunca gravados com id local). */
  discarded: PlanItem[];
}

function translatePlanItems(items: PlanItem[] | undefined, maps: PlanItemMaps) {
  const kept: SupabasePlanItem[] = [];
  const discarded: PlanItem[] = [];
  for (const item of items ?? []) {
    const kindOk = !!item && (item.kind === "service" || item.kind === "product");
    const refId = kindOk
      ? resolveCatalogFk(item.refId, item.kind === "service" ? maps.services : maps.products)
      : null;
    if (!kindOk || !refId) {
      discarded.push(item);
      continue;
    }
    kept.push({ refId, kind: item.kind, name: item.name ?? "" });
  }
  return { kept, discarded };
}

/** Plano local → payload COMPLETO + descartes. Ver o cabeçalho do arquivo sobre a regra dos itens. */
export function mapLocalPlanToSupabase(
  plan: Omit<CommercialPlan, "id" | "createdAt" | "updatedAt"> & { id?: string; createdAt?: string; updatedAt?: string },
  maps: PlanItemMaps = EMPTY_PLAN_ITEM_MAPS,
): PlanMappingResult {
  const { kept, discarded } = translatePlanItems(plan.items, maps);
  return {
    input: {
      name: plan.name,
      description: plan.description ?? "",
      billing_cycle: isBillingCycle(plan.billingCycle) ? plan.billingCycle : DEFAULT_BILLING_CYCLE,
      price: roundMoney(plan.price),
      items: kept,
      highlight: !!plan.highlight,
      status: isPlanStatus(plan.status) ? plan.status : DEFAULT_PLAN_STATUS,
      is_demo: !!plan.isDemo,
    },
    discarded,
  };
}

/** Patch parcial. `items` (quando presente) é traduzido como no payload completo; descartes devolvidos. */
export function mapPlanPatchToSupabase(
  patch: Partial<CommercialPlan>,
  maps: PlanItemMaps = EMPTY_PLAN_ITEM_MAPS,
): { patch: Partial<SupabaseCommercialPlanInput>; discarded: PlanItem[] } {
  const out: Partial<SupabaseCommercialPlanInput> = {};
  let discarded: PlanItem[] = [];
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.description !== undefined) out.description = patch.description ?? "";
  if (patch.billingCycle !== undefined) {
    out.billing_cycle = isBillingCycle(patch.billingCycle) ? patch.billingCycle : DEFAULT_BILLING_CYCLE;
  }
  if (patch.price !== undefined) out.price = roundMoney(patch.price);
  if (patch.highlight !== undefined) out.highlight = !!patch.highlight;
  if (patch.status !== undefined) out.status = isPlanStatus(patch.status) ? patch.status : DEFAULT_PLAN_STATUS;
  if (patch.items !== undefined) {
    const t = translatePlanItems(patch.items, maps);
    out.items = t.kept;
    discarded = t.discarded;
  }
  return { patch: out, discarded };
}

/** Linha da nuvem → `CommercialPlan` local. Itens inválidos (sem `refId`/`kind` válido) são descartados na leitura. */
export function mapSupabasePlanToLocal(row: SupabaseCommercialPlan): CommercialPlan {
  const rawItems: unknown[] = Array.isArray(row.items) ? row.items : [];
  const items: PlanItem[] = [];
  for (const it of rawItems) {
    if (!it || typeof it !== "object") continue;
    const o = it as { refId?: unknown; kind?: unknown; name?: unknown };
    if (typeof o.refId !== "string" || !o.refId) continue;
    if (o.kind !== "service" && o.kind !== "product") continue;
    items.push({ refId: o.refId, kind: o.kind, name: typeof o.name === "string" ? o.name : "" });
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    billingCycle: isBillingCycle(row.billing_cycle) ? row.billing_cycle : DEFAULT_BILLING_CYCLE,
    price: Number(row.price ?? 0),
    items,
    highlight: !!row.highlight,
    status: isPlanStatus(row.status) ? row.status : DEFAULT_PLAN_STATUS,
    isDemo: row.is_demo || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
