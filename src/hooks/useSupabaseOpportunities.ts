import { useEffect, useState, useCallback } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { crmOpportunitiesRepository, type SupabaseOpportunity, type SupabaseOpportunityInput } from "@/repositories/crmOpportunitiesRepository";
import { toast } from "sonner";

export function useSupabaseOpportunities(options?: { includeArchived?: boolean; onlyDeleted?: boolean }) {
  const { workspace } = useCurrentWorkspace();
  const [opportunities, setOpportunities] = useState<SupabaseOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const includeArchived = options?.includeArchived;
  const onlyDeleted = options?.onlyDeleted;

  const fetchOpportunities = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await crmOpportunitiesRepository.listOpportunities(workspace.id, { includeArchived, onlyDeleted });
      setOpportunities((data as SupabaseOpportunity[]) || []);
    } catch (err) {
      console.error("Erro ao carregar oportunidades do Supabase:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, includeArchived, onlyDeleted]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const createOpportunity = async (input: SupabaseOpportunityInput) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opportunity = await crmOpportunitiesRepository.createOpportunity(workspace.id, input);
      toast.success("Oportunidade criada no Supabase com sucesso!");
      await fetchOpportunities();
      return opportunity;
    } catch (err) {
      console.error("Erro ao criar oportunidade:", err);
      toast.error("Erro ao criar oportunidade no Supabase.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateOpportunity = async (opportunityId: string, patch: Partial<SupabaseOpportunityInput>) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opportunity = await crmOpportunitiesRepository.updateOpportunity(workspace.id, opportunityId, patch);
      toast.success("Oportunidade atualizada no Supabase!");
      await fetchOpportunities();
      return opportunity;
    } catch (err) {
      console.error("Erro ao atualizar oportunidade:", err);
      toast.error("Erro ao atualizar oportunidade no Supabase.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const moveOpportunityStage = async (opportunityId: string, stage: string) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opportunity = await crmOpportunitiesRepository.moveOpportunityStage(workspace.id, opportunityId, stage);
      toast.success(`Estágio alterado para "${stage}"!`);
      await fetchOpportunities();
      return opportunity;
    } catch (err) {
      console.error("Erro ao mover oportunidade:", err);
      toast.error("Erro ao mover oportunidade no Supabase.");
      throw err;
    } finally {
      setLoading(false);
    }
  };
  const markWon = async (opportunityId: string) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opp = await crmOpportunitiesRepository.markOpportunityWon(workspace.id, opportunityId);
      toast.success("Oportunidade marcada como ganha 🎉");
      await fetchOpportunities();
      return opp;
    } catch (err) {
      console.error("Erro ao marcar como ganha:", err);
      toast.error("Erro ao marcar oportunidade como ganha.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markLost = async (opportunityId: string, reason?: string) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opp = await crmOpportunitiesRepository.markOpportunityLost(workspace.id, opportunityId, reason);
      toast.success("Oportunidade marcada como perdida.");
      await fetchOpportunities();
      return opp;
    } catch (err) {
      console.error("Erro ao marcar como perdida:", err);
      toast.error("Erro ao marcar oportunidade como perdida.");
      throw err;
    } finally {
      setLoading(false);
    }
  };


  const archiveOpportunity = async (opportunityId: string, archived = true) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opportunity = await crmOpportunitiesRepository.archiveOpportunity(workspace.id, opportunityId, archived);
      toast.success(archived ? "Oportunidade arquivada!" : "Oportunidade restaurada!");
      await fetchOpportunities();
      return opportunity;
    } catch (err) {
      console.error("Erro ao arquivar oportunidade:", err);
      toast.error("Erro ao alterar arquivamento no Supabase.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteOpportunity = async (opportunityId: string) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return;
    }
    setLoading(true);
    try {
      await crmOpportunitiesRepository.deleteOpportunity(workspace.id, opportunityId);
      toast.success("Oportunidade removida do Supabase.");
      await fetchOpportunities();
    } catch (err) {
      console.error("Erro ao excluir oportunidade:", err);
      toast.error("Erro ao excluir oportunidade no Supabase.");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const restoreDeletedOpportunity = async (opportunityId: string) => {
    if (!workspace?.id) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    setLoading(true);
    try {
      const opp = await crmOpportunitiesRepository.restoreSoftDeletedOpportunity(workspace.id, opportunityId);
      // Log locally
      const logEntry = { opportunityId: opp.id, title: opp.title, restoredAt: new Date().toISOString() };
      try { localStorage.setItem("kora.crm.supabaseRestoreDeletes.v1", JSON.stringify(logEntry)); } catch (e) { /* silent catch for localStorage quota errors */ }
      toast.success("Oportunidade restaurada com sucesso!");
      await fetchOpportunities();
      return opp;
    } catch (err) {
      console.error("Erro ao restaurar oportunidade deletada:", err);
      toast.error("Erro ao restaurar oportunidade.");
      throw err;
    } finally { setLoading(false); }
  };

  return {
    opportunities,
    loading,
    error,
    refresh: fetchOpportunities,
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
