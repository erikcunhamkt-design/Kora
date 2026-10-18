// G94 / CT1 (docs/architecture/etapa-5-flip-catalogo-materiais-fase-a.md §7) —
// mapper do catálogo comercial (categorias + serviços) local ⇄ nuvem.
// Fatia SEM UI e SEM flip: nada consome isto ainda.
//
//  - G40/G49 (vocabulário): o literal LOCAL é preservado na nuvem — `billing_type`
//    guarda "único"/"mensal"/… COM ACENTO, sem tradução (precedente Tarefas); o
//    CHECK do draft 6.2 aceita esses literais. Na leitura, valor desconhecido cai
//    em "único" (nunca quebra a lista).
//  - G67 (uuid): o id local ("svc-…", "cat-…") NUNCA é uuid — `resolveCatalogFk`
//    faz passthrough de uuid, senão mapa do import, senão `null` (nunca o id local
//    cru numa coluna uuid).
//  - G37 (payload completo): todos os campos do `Service` têm coluna (inclusive o
//    rótulo legado `category`, `tags`, `notes`, `availableInQuotes`,
//    `showInPublicCatalog`); o mapper de patch leva exatamente os campos recebidos.
import type { BillingType, Service } from "@/hooks/useServices";
import type { ServiceCategory } from "@/hooks/useServiceCategories";
import type { SupabaseService, SupabaseServiceInput } from "@/repositories/servicesRepository";
import type {
  SupabaseServiceCategory,
  SupabaseServiceCategoryInput,
} from "@/repositories/serviceCategoriesRepository";
import { roundMoney } from "@/services/quotes/quoteMoney";

/** Vocabulário de `billing_type` — espelha o CHECK do draft 6.2 e `BillingType` local. */
export const BILLING_TYPES: readonly BillingType[] = ["único", "mensal", "recorrente", "personalizado", "pacote"];
export const DEFAULT_BILLING_TYPE: BillingType = "único";

export function isBillingType(value: unknown): value is BillingType {
  return typeof value === "string" && (BILLING_TYPES as readonly string[]).includes(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Import-maps local→nuvem usados pra resolver FKs do catálogo (chaves = `String(idLocal)`, valores = uuid). */
export interface CatalogImportMaps {
  categories: Record<string, string>;
}
export const EMPTY_CATALOG_IMPORT_MAPS: CatalogImportMaps = { categories: {} };

/**
 * uuid direto → ele mesmo (já é o destino); id local mapeado → uuid; ausente → `null`.
 * NUNCA devolve um id local cru (regra de segurança Q4, mesma de `resolveProjectFk`/`resolveTaskFk`).
 */
export function resolveCatalogFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  const key = String(localId);
  if (UUID_RE.test(key)) return key;
  return map[key] ?? null;
}

function toDeliveryDays(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function toTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((t): t is string => typeof t === "string") : [];
}

// ─────────────────────────────── categorias ───────────────────────────────

export function mapLocalServiceCategoryToSupabase(category: ServiceCategory): SupabaseServiceCategoryInput {
  return {
    name: category.name,
    color: category.color || "#8B5CF6",
    is_demo: !!category.isDemo,
  };
}

export function mapSupabaseServiceCategoryToLocal(row: SupabaseServiceCategory): ServiceCategory {
  return {
    id: row.id,
    name: row.name,
    color: row.color || "#8B5CF6",
    isDemo: row.is_demo || undefined,
  };
}

// ─────────────────────────────── serviços ───────────────────────────────

/**
 * Serviço local → payload de escrita COMPLETO (import e criação nativa). `categoryId` resolve por
 * passthrough/mapa; categoria não resolvida ⇒ `category_id = null` e o rótulo legado `category`
 * é preservado (G37 — não perder o campo).
 */
export function mapLocalServiceToSupabase(
  service: Omit<Service, "id"> & { id?: string },
  maps: CatalogImportMaps = EMPTY_CATALOG_IMPORT_MAPS,
): SupabaseServiceInput {
  return {
    category_id: resolveCatalogFk(service.categoryId, maps.categories),
    category: service.category || null,
    name: service.name,
    description: service.description ?? "",
    price: roundMoney(service.price),
    billing_type: isBillingType(service.billingType) ? service.billingType : DEFAULT_BILLING_TYPE,
    delivery_days: toDeliveryDays(service.deliveryDays),
    active: service.active !== false,
    tags: toTags(service.tags),
    available_in_quotes: service.availableInQuotes ?? true,
    show_in_public_catalog: service.showInPublicCatalog ?? false,
    notes: service.notes ?? null,
    is_demo: !!service.isDemo,
  };
}

/**
 * Patch parcial (edição): leva EXATAMENTE os campos recebidos, cada um com a mesma conversão do
 * payload completo. Campo ausente do patch não vai (não zera nada por omissão).
 */
export function mapServicePatchToSupabase(
  patch: Partial<Service>,
  maps: CatalogImportMaps = EMPTY_CATALOG_IMPORT_MAPS,
): Partial<SupabaseServiceInput> {
  const out: Partial<SupabaseServiceInput> = {};
  if (patch.name !== undefined) out.name = patch.name;
  if (patch.description !== undefined) out.description = patch.description ?? "";
  if (patch.category !== undefined) out.category = patch.category || null;
  if (patch.categoryId !== undefined) out.category_id = resolveCatalogFk(patch.categoryId, maps.categories);
  if (patch.price !== undefined) out.price = roundMoney(patch.price);
  if (patch.billingType !== undefined) {
    out.billing_type = isBillingType(patch.billingType) ? patch.billingType : DEFAULT_BILLING_TYPE;
  }
  if (patch.deliveryDays !== undefined) out.delivery_days = toDeliveryDays(patch.deliveryDays);
  if (patch.active !== undefined) out.active = patch.active;
  if (patch.tags !== undefined) out.tags = toTags(patch.tags);
  if (patch.availableInQuotes !== undefined) out.available_in_quotes = patch.availableInQuotes;
  if (patch.showInPublicCatalog !== undefined) out.show_in_public_catalog = patch.showInPublicCatalog;
  if (patch.notes !== undefined) out.notes = patch.notes ?? null;
  return out;
}

/**
 * Linha da nuvem → `Service` local. `categoryNameById` (uuid → nome da categoria da nuvem) alimenta o
 * rótulo exibido; sem ele, cai no rótulo legado gravado em `category`. Leitura defensiva: tabela
 * pode vir com NULL em colunas opcionais e `billing_type` fora do vocabulário.
 */
export function mapSupabaseServiceToLocal(
  row: SupabaseService,
  categoryNameById: Record<string, string> = {},
): Service {
  const billingType = isBillingType(row.billing_type) ? row.billing_type : DEFAULT_BILLING_TYPE;
  const resolvedCategoryName = row.category_id ? categoryNameById[row.category_id] : undefined;
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: resolvedCategoryName ?? row.category ?? "",
    categoryId: row.category_id ?? undefined,
    price: Number(row.price ?? 0),
    billingType,
    deliveryDays: Number(row.delivery_days ?? 0),
    active: row.active !== false,
    tags: Array.isArray(row.tags) ? row.tags : [],
    availableInQuotes: row.available_in_quotes ?? true,
    showInPublicCatalog: row.show_in_public_catalog ?? false,
    notes: row.notes ?? undefined,
    isDemo: row.is_demo || undefined,
  };
}
