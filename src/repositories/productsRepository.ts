// G94 / CT2 — repositório de `products` (draft 6.3 do doc da Fase A; tabela ainda NÃO aplicada).
// Sem UI, sem flip: nada consome ainda. Erros: ver catalogRepositoryShared.
import { catalogDb, toCatalogError } from "@/repositories/catalogRepositoryShared";

export interface SupabaseProduct {
  id: string;
  workspace_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  price: number | string;
  /** `numeric` no PostgREST pode chegar como string. */
  cost?: number | string | null;
  stock?: number | null;
  /** Literal local (inglês) — CHECK do draft 6.3. */
  type: string;
  status: string;
  is_demo: boolean;
  source_local_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Campos graváveis (payload COMPLETO na criação — G37; parcial na edição). */
export interface SupabaseProductInput {
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  cost: number | null;
  stock: number | null;
  type: string;
  status: string;
  is_demo: boolean;
}

export const productsRepository = {
  async listProducts(workspaceId: string): Promise<SupabaseProduct[]> {
    const { data, error } = await catalogDb
      .from("products")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw toCatalogError(error);
    return (data ?? []) as SupabaseProduct[];
  },

  /** Import E criação nativa: upsert idempotente por (workspace_id, source_local_id) — G56. */
  async importProduct(workspaceId: string, sourceLocalId: string, input: SupabaseProductInput) {
    if (!sourceLocalId || !sourceLocalId.trim()) {
      throw new Error("importProduct: source_local_id é obrigatório (arbiter da idempotência)");
    }
    const { data, error } = await catalogDb
      .from("products")
      .upsert(
        { workspace_id: workspaceId, source_local_id: sourceLocalId, ...input },
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseProduct;
  },

  async updateProduct(workspaceId: string, productId: string, patch: Partial<SupabaseProductInput>) {
    const { data, error } = await catalogDb
      .from("products")
      .update(patch)
      .eq("id", productId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseProduct;
  },

  /** Exclusão = soft delete (decisão Q6). */
  async softDeleteProduct(workspaceId: string, productId: string) {
    const { data, error } = await catalogDb
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseProduct;
  },
};
