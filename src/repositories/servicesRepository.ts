// G94 / CT1 — repositório de `services` (draft 6.2 do doc da Fase A; tabela ainda NÃO aplicada).
// Sem UI, sem flip: nada consome ainda. Erros: ver catalogRepositoryShared.
import { catalogDb, toCatalogError } from "@/repositories/catalogRepositoryShared";

export interface SupabaseService {
  id: string;
  workspace_id: string;
  category_id?: string | null;
  /** Rótulo legado (`Service.category`) — G37: não se perde. */
  category?: string | null;
  name: string;
  description?: string | null;
  price: number | string;
  /** Literal local COM acento ("único"…) — CHECK do draft 6.2. */
  billing_type: string;
  delivery_days?: number | null;
  active?: boolean;
  tags?: string[] | null;
  available_in_quotes?: boolean | null;
  show_in_public_catalog?: boolean | null;
  notes?: string | null;
  is_demo: boolean;
  source_local_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Campos graváveis (payload COMPLETO na criação — G37; parcial na edição). */
export interface SupabaseServiceInput {
  category_id: string | null;
  category: string | null;
  name: string;
  description: string;
  price: number;
  billing_type: string;
  delivery_days: number;
  active: boolean;
  tags: string[];
  available_in_quotes: boolean;
  show_in_public_catalog: boolean;
  notes: string | null;
  is_demo: boolean;
}

export const servicesRepository = {
  async listServices(workspaceId: string): Promise<SupabaseService[]> {
    const { data, error } = await catalogDb
      .from("services")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw toCatalogError(error);
    return (data ?? []) as SupabaseService[];
  },

  /** Import E criação nativa: upsert idempotente por (workspace_id, source_local_id) — G56. */
  async importService(workspaceId: string, sourceLocalId: string, input: SupabaseServiceInput) {
    if (!sourceLocalId || !sourceLocalId.trim()) {
      throw new Error("importService: source_local_id é obrigatório (arbiter da idempotência)");
    }
    const { data, error } = await catalogDb
      .from("services")
      .upsert(
        { workspace_id: workspaceId, source_local_id: sourceLocalId, ...input },
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseService;
  },

  async updateService(workspaceId: string, serviceId: string, patch: Partial<SupabaseServiceInput>) {
    const { data, error } = await catalogDb
      .from("services")
      .update(patch)
      .eq("id", serviceId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseService;
  },

  /** Exclusão = soft delete (preserva `quote_items.service_id`/histórico — decisão Q6). */
  async softDeleteService(workspaceId: string, serviceId: string) {
    const { data, error } = await catalogDb
      .from("services")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", serviceId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseService;
  },
};
