// G94 / CT4 (Fase B do catálogo) — hooks BIFURCADOS: leitura + escrita do catálogo local OU da nuvem, com o
// MESMO formato de retorno de `useServices`/`useProducts`/`useServiceCategories`/`useCommercialPlans`
// (troca direta nas telas) + `mode` (de onde a tela está lendo e por que). Padrão: `useBifurcatedTasks`,
// com uma diferença deliberada — a nuvem chega por CONTEXTO (`catalogCloudContext.ts`), não por 4 hooks
// nativos dentro de cada hook.
//
// Regras (todas por construção, testadas em `useBifurcatedCatalog.test.tsx`):
//  - Fonte LOCAL (padrão): leitura e escrita no store de sempre, byte a byte. Mutators devolvem `true`.
//  - Fonte NUVEM + escrita LIGADA: mutators usam os hooks nativos do CT1/CT2 (`mutateAsync`), resposta da
//    escrita vai pro cache (G30); falha ⇒ toast com mensagem legível + `false` (nada de sucesso falso, G75).
//  - Fonte NUVEM + escrita DESLIGADA: gravação BLOQUEADA com aviso honesto (G76) — NUNCA cai silenciosamente no
//    store local (o usuário está vendo o catálogo da nuvem; gravar no local criaria um item "fantasma" com id
//    local, classe G67). Devolve `false`.
//  - Tabela ausente (`CatalogUnavailableError`): `mode.source === "local"` + `mode.unavailable` — leitura e escrita
//    ficam no LOCAL (é o que a tela mostra) e a tela avisa "schema pendente".
//  - Mutators NUNCA lançam: o resultado é `boolean | Promise<boolean>` (a tela só mostra "criado/atualizado" se `true`).
import { toast } from "sonner";
import { useServices, type Service } from "@/hooks/useServices";
import { useProducts, type Product } from "@/hooks/useProducts";
import { useServiceCategories, type ServiceCategory } from "@/hooks/useServiceCategories";
import { useCommercialPlans, type CommercialPlan } from "@/hooks/useCommercialPlans";
import { useCatalogCloud, useCatalogMode, type CatalogModeInfo } from "@/hooks/catalogCloudContext";
import { catalogErrorMessage } from "@/repositories/catalogRepositoryShared";

/** `true` = persistiu. Sempre já avisou o usuário quando `false`. */
export type CatalogWriteResult = boolean | Promise<boolean>;

export const CATALOG_WRITE_BLOCKED_MESSAGE =
  "Gravação do catálogo na nuvem está desligada — nada foi salvo. Ative “Catálogo comercial · escrita na nuvem” em Configurações → Dados ou volte a fonte para Local.";

function blocked(): false {
  toast.warning(CATALOG_WRITE_BLOCKED_MESSAGE);
  return false;
}

/**
 * Executa uma escrita na nuvem sem nunca lançar. Falha vira `false` + toast "Erro ao <ação> no catálogo
 * (Supabase): <causa real>" (G95 — nunca um genérico sem a causa: o usuário distingue RLS, CHECK, índice, rede).
 */
async function cloudWrite<T>(action: string, fn: () => Promise<T>, after?: (value: T) => void): Promise<boolean> {
  try {
    const value = await fn();
    after?.(value);
    return true;
  } catch (error) {
    toast.error(`Erro ao ${action} no catálogo (Supabase): ${catalogErrorMessage(error)}`);
    return false;
  }
}

/** Escolhe local / bloqueado / nuvem para UMA operação, sem repetir o if em cada mutator. */
function pick(
  mode: CatalogModeInfo,
  hasCloud: boolean,
  local: () => void,
  cloud: () => Promise<boolean>,
): CatalogWriteResult {
  if (mode.source !== "supabase" || !hasCloud) {
    local();
    return true;
  }
  if (!mode.writeEnabled) return blocked();
  return cloud();
}

// ───────────────────────────── categorias ─────────────────────────────

export function useBifurcatedServiceCategories() {
  const local = useServiceCategories();
  const mode = useCatalogMode();
  const cloud = useCatalogCloud()?.categories;
  const useCloud = mode.source === "supabase" && !!cloud;

  return {
    categories: useCloud ? cloud.categories : local.categories,
    addCategory: (data: Omit<ServiceCategory, "id" | "isDemo">): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.addCategory(data), () => cloudWrite("criar a categoria", () => cloud!.createCategory(data))),
    updateCategory: (id: string, patch: Partial<ServiceCategory>): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.updateCategory(id, patch), () => cloudWrite("editar a categoria", () => cloud!.updateCategory(id, patch))),
    removeCategory: (id: string): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.removeCategory(id), () => cloudWrite("excluir a categoria", () => cloud!.removeCategory(id))),
    mode,
  };
}

// ───────────────────────────── serviços ─────────────────────────────

export function useBifurcatedServices() {
  const local = useServices();
  const mode = useCatalogMode();
  const cloud = useCatalogCloud()?.services;
  const useCloud = mode.source === "supabase" && !!cloud;

  return {
    services: useCloud ? cloud.services : local.services,
    addService: (data: Omit<Service, "id" | "isDemo">): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.addService(data), () => cloudWrite("criar o serviço", () => cloud!.createService(data))),
    updateService: (id: string, patch: Partial<Service>): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.updateService(id, patch), () => cloudWrite("editar o serviço", () => cloud!.updateService(id, patch))),
    duplicateService: (id: string): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.duplicateService(id), () => cloudWrite("duplicar o serviço", () => cloud!.duplicateService(id))),
    /** "Arquivar/ativar": alterna `active` (não apaga). */
    toggleActive: (id: string): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.toggleActive(id), () => cloudWrite("arquivar/ativar o serviço", () => cloud!.toggleActive(id))),
    removeService: (id: string): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.removeService(id), () => cloudWrite("excluir o serviço", () => cloud!.removeService(id))),
    mode,
  };
}

// ───────────────────────────── produtos ─────────────────────────────

export function useBifurcatedProducts() {
  const local = useProducts();
  const mode = useCatalogMode();
  const cloud = useCatalogCloud()?.products;
  const useCloud = mode.source === "supabase" && !!cloud;

  return {
    products: useCloud ? cloud.products : local.products,
    addProduct: (data: Omit<Product, "id" | "isDemo" | "createdAt" | "updatedAt">): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.addProduct(data), () => cloudWrite("criar o produto", () => cloud!.createProduct(data))),
    updateProduct: (id: string, patch: Partial<Product>): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.updateProduct(id, patch), () => cloudWrite("editar o produto", () => cloud!.updateProduct(id, patch))),
    removeProduct: (id: string): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.removeProduct(id), () => cloudWrite("excluir o produto", () => cloud!.removeProduct(id))),
    mode,
  };
}

// ───────────────────────────── planos ─────────────────────────────

function warnDiscarded(count: number) {
  if (count > 0) {
    toast.warning(`${count} item(ns) do plano foram DESCARTADOS (não existem como serviço/produto na nuvem) — confira o plano.`);
  }
}

export function useBifurcatedCommercialPlans() {
  const local = useCommercialPlans();
  const mode = useCatalogMode();
  const cloud = useCatalogCloud()?.plans;
  const useCloud = mode.source === "supabase" && !!cloud;

  return {
    plans: useCloud ? cloud.plans : local.plans,
    addPlan: (data: Omit<CommercialPlan, "id" | "isDemo" | "createdAt" | "updatedAt">): CatalogWriteResult =>
      pick(
        mode,
        !!cloud,
        () => local.addPlan(data),
        () => cloudWrite("criar o plano", () => cloud!.createPlan(data), (r) => warnDiscarded(r.discarded.length)),
      ),
    updatePlan: (id: string, patch: Partial<CommercialPlan>): CatalogWriteResult =>
      pick(
        mode,
        !!cloud,
        () => local.updatePlan(id, patch),
        () => cloudWrite("editar o plano", () => cloud!.updatePlan(id, patch), (r) => warnDiscarded(r.discarded.length)),
      ),
    removePlan: (id: string): CatalogWriteResult =>
      pick(mode, !!cloud, () => local.removePlan(id), () => cloudWrite("excluir o plano", () => cloud!.removePlan(id))),
    /** Linha NOVA (`source_local_id` nativo) com o nome "<nome> (cópia)" — nunca upsert sobre a original (G56). */
    duplicatePlan: (id: string): CatalogWriteResult =>
      pick(
        mode,
        !!cloud,
        () => local.duplicatePlan(id),
        () => {
          const src = cloud!.plans.find((p) => p.id === id);
          if (!src) {
            toast.error("Plano não encontrado para duplicar.");
            return Promise.resolve(false);
          }
          const { id: _id, isDemo: _isDemo, createdAt: _c, updatedAt: _u, ...rest } = src;
          void _id; void _isDemo; void _c; void _u;
          return cloudWrite(
            "duplicar o plano",
            () => cloud!.createPlan({ ...rest, name: `${src.name} (cópia)` }),
            (r) => warnDiscarded(r.discarded.length),
          );
        },
      ),
    mode,
  };
}
