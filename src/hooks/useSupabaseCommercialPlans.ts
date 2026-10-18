// G94 / CT2 — leitura/escrita de planos comerciais na nuvem (`commercial_plans`, draft 6.4).
// Sem UI, sem flip: NADA consome este hook ainda. Mesmo molde de useSupabaseServices.ts (CT1):
//  - [G32] `enabled: !!workspaceId`; [G30] resposta da escrita no cache; [G37] payload completo;
//    [G56] criação nativa com `buildNativeSourceLocalId()`; degradação com tabela ausente.
//  - **Itens do plano = uuid na nuvem.** Aqui a tradução é só passthrough de uuid (itens escolhidos
//    na UI já vêm da nuvem); item cujo `refId` NÃO é uuid é DESCARTADO e a mutation devolve a
//    CONTAGEM em `discarded` — nunca grava id local cru. (A tradução id local→uuid é do import, CT3.)
import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  commercialPlansRepository,
  type SupabaseCommercialPlan,
} from "@/repositories/commercialPlansRepository";
import { isCatalogUnavailable } from "@/repositories/catalogRepositoryShared";
import {
  mapLocalPlanToSupabase,
  mapPlanPatchToSupabase,
  mapSupabasePlanToLocal,
} from "@/services/catalog/catalogProductPlanMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { CommercialPlan, PlanItem } from "@/hooks/useCommercialPlans";

const EMPTY_ROWS: SupabaseCommercialPlan[] = [];

/** Mesmo shape que `useCommercialPlans().addPlan()` já aceita. */
export type NewPlanInput = Omit<CommercialPlan, "id" | "isDemo" | "createdAt" | "updatedAt">;

export interface PlanWriteResult {
  plan: SupabaseCommercialPlan;
  /** Itens descartados por não serem uuid de serviço/produto da nuvem. */
  discarded: PlanItem[];
}

export function useSupabaseCommercialPlans() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["supabase-commercial-plans", workspaceId], [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => commercialPlansRepository.listPlans(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
    retry: (failureCount, error) => !isCatalogUnavailable(error) && failureCount < 2,
  });

  const rows = query.data ?? EMPTY_ROWS;
  const plans = useMemo(() => rows.map(mapSupabasePlanToLocal), [rows]);

  const createMutation = useMutation({
    mutationFn: async (input: NewPlanInput): Promise<PlanWriteResult> => {
      const { input: payload, discarded } = mapLocalPlanToSupabase({ ...input, isDemo: false });
      const plan = await commercialPlansRepository.importPlan(workspaceId, buildNativeSourceLocalId(), payload);
      return { plan, discarded };
    },
    onSuccess: ({ plan }) => {
      queryClient.setQueryData<SupabaseCommercialPlan[]>(queryKey, (prev) => [
        plan,
        ...(prev ?? []).filter((p) => p.id !== plan.id),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ planId, patch }: { planId: string; patch: Partial<CommercialPlan> }): Promise<PlanWriteResult> => {
      const { patch: mapped, discarded } = mapPlanPatchToSupabase(patch);
      const plan = await commercialPlansRepository.updatePlan(workspaceId, planId, mapped);
      return { plan, discarded };
    },
    onSuccess: ({ plan }) => {
      queryClient.setQueryData<SupabaseCommercialPlan[]>(queryKey, (prev) =>
        (prev ?? []).map((p) => (p.id === plan.id ? plan : p)),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (planId: string) => commercialPlansRepository.softDeletePlan(workspaceId, planId),
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseCommercialPlan[]>(queryKey, (prev) =>
        (prev ?? []).filter((p) => p.id !== deleted.id),
      );
    },
  });

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    rows,
    plans,
    loading: query.isLoading,
    /** Tabela ainda não criada no banco — a lista vem vazia e nada quebra. */
    unavailable: isCatalogUnavailable(query.error),
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,

    createPlan: (input: NewPlanInput) => createMutation.mutateAsync(input),
    updatePlan: (planId: string, patch: Partial<CommercialPlan>) => updateMutation.mutateAsync({ planId, patch }),
    removePlan: (planId: string) => removeMutation.mutateAsync(planId),
  };
}
