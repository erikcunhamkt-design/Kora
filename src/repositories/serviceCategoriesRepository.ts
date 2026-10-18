// G94 / CT1 — repositório de `service_categories` (draft 6.1 do doc da Fase A; tabela ainda
// NÃO aplicada). Sem UI, sem flip: nada consome ainda. Erros: ver catalogRepositoryShared.
import { catalogDb, toCatalogError } from "@/repositories/catalogRepositoryShared";

export interface SupabaseServiceCategory {
  id: string;
  workspace_id: string;
  name: string;
  color: string;
  is_demo: boolean;
  /** Chave de idempotência do import (`${installId}:${localId}`) ou `native:…` na criação nativa. */
  source_local_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Campos graváveis (o resto é do servidor/da chave). */
export interface SupabaseServiceCategoryInput {
  name: string;
  color: string;
  is_demo: boolean;
}

export const serviceCategoriesRepository = {
  async listCategories(workspaceId: string): Promise<SupabaseServiceCategory[]> {
    const { data, error } = await catalogDb
      .from("service_categories")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw toCatalogError(error);
    return (data ?? []) as SupabaseServiceCategory[];
  },

  /** Import E criação nativa: upsert idempotente por (workspace_id, source_local_id) — UNIQUE não-parcial (draft 6.6). */
  async importCategory(workspaceId: string, sourceLocalId: string, input: SupabaseServiceCategoryInput) {
    if (!sourceLocalId || !sourceLocalId.trim()) {
      throw new Error("importCategory: source_local_id é obrigatório (arbiter da idempotência)");
    }
    const { data, error } = await catalogDb
      .from("service_categories")
      .upsert(
        { workspace_id: workspaceId, source_local_id: sourceLocalId, ...input },
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseServiceCategory;
  },

  async updateCategory(workspaceId: string, categoryId: string, patch: Partial<SupabaseServiceCategoryInput>) {
    const { data, error } = await catalogDb
      .from("service_categories")
      .update(patch)
      .eq("id", categoryId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseServiceCategory;
  },

  async softDeleteCategory(workspaceId: string, categoryId: string) {
    const { data, error } = await catalogDb
      .from("service_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", categoryId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseServiceCategory;
  },
};
