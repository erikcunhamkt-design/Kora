// G94 / CT2 — repositório de `commercial_plans` (draft 6.4 do doc da Fase A; tabela ainda NÃO aplicada).
// Sem UI, sem flip: nada consome ainda. Erros: ver catalogRepositoryShared.
import { catalogDb, toCatalogError } from "@/repositories/catalogRepositoryShared";

/** Item de plano NA NUVEM: `refId` é SEMPRE um uuid de `services`/`products` (nunca id local). */
export interface SupabasePlanItem {
  refId: string;
  kind: "service" | "product";
  /** Nome denormalizado (mesmo desenho local) — só rótulo. */
  name: string;
}

export interface SupabaseCommercialPlan {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  /** Literal local (inglês) — CHECK do draft 6.4. */
  billing_cycle: string;
  price: number | string;
  /** `jsonb` — array de `SupabasePlanItem` (validado na leitura). */
  items?: unknown;
  highlight?: boolean | null;
  status: string;
  is_demo: boolean;
  source_local_id?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** Campos graváveis (payload COMPLETO na criação — G37; parcial na edição). */
export interface SupabaseCommercialPlanInput {
  name: string;
  description: string;
  billing_cycle: string;
  price: number;
  items: SupabasePlanItem[];
  highlight: boolean;
  status: string;
  is_demo: boolean;
}

export const commercialPlansRepository = {
  async listPlans(workspaceId: string): Promise<SupabaseCommercialPlan[]> {
    const { data, error } = await catalogDb
      .from("commercial_plans")
      .select("*")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw toCatalogError(error);
    return (data ?? []) as SupabaseCommercialPlan[];
  },

  /** Import E criação nativa: upsert idempotente por (workspace_id, source_local_id) — G56. */
  async importPlan(workspaceId: string, sourceLocalId: string, input: SupabaseCommercialPlanInput) {
    if (!sourceLocalId || !sourceLocalId.trim()) {
      throw new Error("importPlan: source_local_id é obrigatório (arbiter da idempotência)");
    }
    const { data, error } = await catalogDb
      .from("commercial_plans")
      .upsert(
        { workspace_id: workspaceId, source_local_id: sourceLocalId, ...input },
        { onConflict: "workspace_id,source_local_id" },
      )
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseCommercialPlan;
  },

  async updatePlan(workspaceId: string, planId: string, patch: Partial<SupabaseCommercialPlanInput>) {
    const { data, error } = await catalogDb
      .from("commercial_plans")
      .update(patch)
      .eq("id", planId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseCommercialPlan;
  },

  /** Exclusão = soft delete (decisão Q6). */
  async softDeletePlan(workspaceId: string, planId: string) {
    const { data, error } = await catalogDb
      .from("commercial_plans")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", planId)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) throw toCatalogError(error);
    return data as SupabaseCommercialPlan;
  },
};
