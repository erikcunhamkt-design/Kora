// Supabase-backed CRM opportunities — React Query (A2).
//
// Public API unchanged. Reads go through useQuery (workspace + options scoped
// key); each mutation keeps its exact toast side effects and now invalidates
// the query instead of manually re-fetching. The `loading` flag is derived
// from the query's fetch state.
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  crmOpportunitiesRepository,
  type SupabaseOpportunity,
  type SupabaseOpportunityInput,
} from "@/repositories/crmOpportunitiesRepository";
import { toast } from "sonner";

export function useSupabaseOpportunities(options?: { includeArchived?: boolean; onlyDeleted?: boolean }) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();

  const includeArchived = options?.includeArchived;
  const onlyDeleted = options?.onlyDeleted;

  const query = useQuery({
    queryKey: ["supabase-opportunities", workspaceId, includeArchived ?? false, onlyDeleted ?? false],
    queryFn: async (): Promise<SupabaseOpportunity[]> => {
      const data = await crmOpportunitiesRepository.listOpportunities(workspaceId, {
        includeArchived,
        onlyDeleted,
      });
      return (data as unknown as SupabaseOpportunity[]) || [];
    },
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  // Prefix key → invalidates every (includeArchived, onlyDeleted) variant.
  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["supabase-opportunities", workspaceId] }),
    [queryClient, workspaceId],
  );

  const createOpportunity = async (input: SupabaseOpportunityInput) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opportunity = await crmOpportunitiesRepository.createOpportunity(workspaceId, input);
      toast.success("Oportunidade criada no Supabase com sucesso!");
      await invalidate();
      return opportunity;
    } catch (err) {
      console.error("Erro ao criar oportunidade:", err);
      toast.error("Erro ao criar oportunidade no Supabase.");
      throw err;
    }
  };

  const updateOpportunity = async (opportunityId: string, patch: Partial<SupabaseOpportunityInput>) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opportunity = await crmOpportunitiesRepository.updateOpportunity(workspaceId, opportunityId, patch);
      toast.success("Oportunidade atualizada no Supabase!");
      await invalidate();
      return opportunity;
    } catch (err) {
      console.error("Erro ao atualizar oportunidade:", err);
      toast.error("Erro ao atualizar oportunidade no Supabase.");
      throw err;
    }
  };

  const moveOpportunityStage = async (opportunityId: string, stage: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opportunity = await crmOpportunitiesRepository.moveOpportunityStage(workspaceId, opportunityId, stage);
      toast.success(`Estágio alterado para "${stage}"!`);
      await invalidate();
      return opportunity;
    } catch (err) {
      console.error("Erro ao mover oportunidade:", err);
      toast.error("Erro ao mover oportunidade no Supabase.");
      throw err;
    }
  };

  const markWon = async (opportunityId: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opp = await crmOpportunitiesRepository.markOpportunityWon(workspaceId, opportunityId);
      toast.success("Oportunidade marcada como ganha 🎉");
      await invalidate();
      return opp;
    } catch (err) {
      console.error("Erro ao marcar como ganha:", err);
      toast.error("Erro ao marcar oportunidade como ganha.");
      throw err;
    }
  };

  const markLost = async (opportunityId: string, reason?: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opp = await crmOpportunitiesRepository.markOpportunityLost(workspaceId, opportunityId, reason);
      toast.success("Oportunidade marcada como perdida.");
      await invalidate();
      return opp;
    } catch (err) {
      console.error("Erro ao marcar como perdida:", err);
      toast.error("Erro ao marcar oportunidade como perdida.");
      throw err;
    }
  };

  const archiveOpportunity = async (opportunityId: string, archived = true) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opportunity = await crmOpportunitiesRepository.archiveOpportunity(workspaceId, opportunityId, archived);
      toast.success(archived ? "Oportunidade arquivada!" : "Oportunidade restaurada!");
      await invalidate();
      return opportunity;
    } catch (err) {
      console.error("Erro ao arquivar oportunidade:", err);
      toast.error("Erro ao alterar arquivamento no Supabase.");
      throw err;
    }
  };

  const deleteOpportunity = async (opportunityId: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return;
    }
    try {
      await crmOpportunitiesRepository.deleteOpportunity(workspaceId, opportunityId);
      toast.success("Oportunidade removida do Supabase.");
      await invalidate();
    } catch (err) {
      console.error("Erro ao excluir oportunidade:", err);
      toast.error("Erro ao excluir oportunidade no Supabase.");
      throw err;
    }
  };

  const restoreDeletedOpportunity = async (opportunityId: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    try {
      const opp = await crmOpportunitiesRepository.restoreSoftDeletedOpportunity(workspaceId, opportunityId);
      const logEntry = { opportunityId: opp.id, title: opp.title, restoredAt: new Date().toISOString() };
      try {
        localStorage.setItem("kora.crm.supabaseRestoreDeletes.v1", JSON.stringify(logEntry));
      } catch (e) {
        /* silent catch for localStorage quota errors */
      }
      toast.success("Oportunidade restaurada com sucesso!");
      await invalidate();
      return opp;
    } catch (err) {
      console.error("Erro ao restaurar oportunidade deletada:", err);
      toast.error("Erro ao restaurar oportunidade.");
      throw err;
    }
  };

  return {
    opportunities: (query.data ?? []) as SupabaseOpportunity[],
    loading: query.isLoading || query.isFetching,
    error: (query.error ?? null) as Error | null,
    refresh: () => query.refetch(),
    createOpportunity,
    updateOpportunity,
    moveOpportunityStage,
    markWon,
    markLost,
    archiveOpportunity,
    deleteOpportunity,
    restoreDeletedOpportunity,
  };
}
