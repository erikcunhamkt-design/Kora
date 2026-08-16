// Supabase-backed CRM opportunities — React Query (A2).
//
// Public API unchanged. Reads go through useQuery (workspace + options scoped
// key).
//
// Etapa 5 · Preparação G30/G32 (rodada 2, useMutation) — as 8 mutations
// migraram de função async manual (try/catch + `await invalidate()`) pra
// `useMutation`, molde `useSupabaseFinanceTransactions.ts`: `onSuccess`
// escreve a resposta da PRÓPRIA mutation direto no cache via
// `queryClient.setQueryData` (G30 — nunca só `invalidateQueries()`).
// R1 (characterization tests, `useSupabaseOpportunities.test.ts`) congelou o
// comportamento anterior antes deste refactor; as divergências
// intencionais desta rodada estão documentadas linha a linha abaixo, cada
// uma também no relatório da rodada.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  crmOpportunitiesRepository,
  type SupabaseOpportunity,
  type SupabaseOpportunityInput,
} from "@/repositories/crmOpportunitiesRepository";
import { toast } from "sonner";

const EMPTY_OPPORTUNITIES: SupabaseOpportunity[] = [];

export function useSupabaseOpportunities(options?: { includeArchived?: boolean; onlyDeleted?: boolean }) {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();

  const includeArchived = options?.includeArchived;
  const onlyDeleted = options?.onlyDeleted;
  const queryKey = ["supabase-opportunities", workspaceId, includeArchived ?? false, onlyDeleted ?? false];

  const query = useQuery({
    queryKey,
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

  // DIVERGÊNCIA INTENCIONAL #1 (a própria migração): antes, toda mutation
  // chamava `invalidate()` (prefixo `["supabase-opportunities", workspaceId]`)
  // — invalida TODAS as variantes (includeArchived/onlyDeleted) de uma vez,
  // então outras instâncias deste hook montadas em paralelo (ex.: uma tela
  // mostrando "ativas" e outra "arquivadas") refletiam a mudança já no
  // próximo refetch delas. Agora cada mutation faz `setQueryData` só na
  // instância ATUAL (a query key exata deste hook) — G30, sem flicker/sem
  // esperar refetch pra ESTA tela refletir a própria escrita —, mas outras
  // variantes só se atualizam no próximo refetch natural delas (mount/
  // staleTime/refresh manual), não mais imediatamente. Mesmo trade-off que
  // Financeiro/Projetos já aceitaram ao migrar pra G30. Isso também cobre
  // archive/restore: a linha muda de campo na hora nesta instância, mas só
  // desaparece de uma OUTRA instância filtrando por
  // archived/deleted_at quando aquela instância refizer o fetch dela.
  const replaceInCache = (updated: SupabaseOpportunity) => {
    queryClient.setQueryData<SupabaseOpportunity[]>(
      queryKey,
      (prev) => (prev ?? []).map((o) => (o.id === updated.id ? updated : o)),
    );
  };

  const createMutation = useMutation({
    mutationFn: (input: SupabaseOpportunityInput) =>
      crmOpportunitiesRepository.createOpportunity(workspaceId, input) as Promise<SupabaseOpportunity>,
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseOpportunity[]>(
        queryKey,
        (prev) => [created, ...(prev ?? []).filter((o) => o.id !== created.id)],
      );
      toast.success("Oportunidade criada no Supabase com sucesso!");
    },
    onError: (err) => {
      console.error("Erro ao criar oportunidade:", err);
      toast.error("Erro ao criar oportunidade no Supabase.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ opportunityId, patch }: { opportunityId: string; patch: Partial<SupabaseOpportunityInput> }) =>
      crmOpportunitiesRepository.updateOpportunity(workspaceId, opportunityId, patch) as Promise<SupabaseOpportunity>,
    onSuccess: (updated) => {
      replaceInCache(updated);
      toast.success("Oportunidade atualizada no Supabase!");
    },
    onError: (err) => {
      console.error("Erro ao atualizar oportunidade:", err);
      toast.error("Erro ao atualizar oportunidade no Supabase.");
    },
  });

  const moveStageMutation = useMutation({
    mutationFn: ({ opportunityId, stage }: { opportunityId: string; stage: string }) =>
      crmOpportunitiesRepository.moveOpportunityStage(workspaceId, opportunityId, stage) as Promise<SupabaseOpportunity>,
    onSuccess: (moved, variables) => {
      replaceInCache(moved);
      toast.success(`Estágio alterado para "${variables.stage}"!`);
    },
    onError: (err) => {
      console.error("Erro ao mover oportunidade:", err);
      toast.error("Erro ao mover oportunidade no Supabase.");
    },
  });

  const markWonMutation = useMutation({
    mutationFn: (opportunityId: string) =>
      crmOpportunitiesRepository.markOpportunityWon(workspaceId, opportunityId) as Promise<SupabaseOpportunity>,
    onSuccess: (won) => {
      replaceInCache(won);
      toast.success("Oportunidade marcada como ganha 🎉");
    },
    onError: (err) => {
      console.error("Erro ao marcar como ganha:", err);
      toast.error("Erro ao marcar oportunidade como ganha.");
    },
  });

  const markLostMutation = useMutation({
    mutationFn: ({ opportunityId, reason }: { opportunityId: string; reason?: string }) =>
      crmOpportunitiesRepository.markOpportunityLost(workspaceId, opportunityId, reason) as Promise<SupabaseOpportunity>,
    onSuccess: (lost) => {
      replaceInCache(lost);
      toast.success("Oportunidade marcada como perdida.");
    },
    onError: (err) => {
      console.error("Erro ao marcar como perdida:", err);
      toast.error("Erro ao marcar oportunidade como perdida.");
    },
  });

  const archiveMutation = useMutation({
    mutationFn: ({ opportunityId, archived }: { opportunityId: string; archived: boolean }) =>
      crmOpportunitiesRepository.archiveOpportunity(workspaceId, opportunityId, archived) as Promise<SupabaseOpportunity>,
    onSuccess: (archivedOpp, variables) => {
      replaceInCache(archivedOpp);
      toast.success(variables.archived ? "Oportunidade arquivada!" : "Oportunidade restaurada!");
    },
    onError: (err) => {
      console.error("Erro ao arquivar oportunidade:", err);
      toast.error("Erro ao alterar arquivamento no Supabase.");
    },
  });

  // `deleteOpportunity` (crmOpportunitiesRepository.ts) ganhou `.select().single()`
  // nesta rodada — devolvia `void`, sem jeito de saber qual linha tirar do
  // cache sem inventar o shape (instrução explícita da rodada: adaptar o
  // repository pra devolver, não inventar). A resposta agora alimenta o G30
  // aqui; o wrapper público (`deleteOpportunity` abaixo) continua devolvendo
  // `undefined` no sucesso — o contrato de retorno público não muda.
  const deleteMutation = useMutation({
    mutationFn: (opportunityId: string) =>
      crmOpportunitiesRepository.deleteOpportunity(workspaceId, opportunityId) as Promise<SupabaseOpportunity>,
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseOpportunity[]>(
        queryKey,
        (prev) => (prev ?? []).filter((o) => o.id !== deleted.id),
      );
      toast.success("Oportunidade removida do Supabase.");
    },
    onError: (err) => {
      console.error("Erro ao excluir oportunidade:", err);
      toast.error("Erro ao excluir oportunidade no Supabase.");
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (opportunityId: string) =>
      crmOpportunitiesRepository.restoreSoftDeletedOpportunity(workspaceId, opportunityId) as Promise<SupabaseOpportunity>,
    onSuccess: (restored) => {
      // Efeito colateral preservado como estava: log de auditoria em
      // localStorage, catch silencioso próprio (erro de quota nunca
      // propaga nem impede o resto do onSuccess).
      const logEntry = { opportunityId: restored.id, title: restored.title, restoredAt: new Date().toISOString() };
      try {
        localStorage.setItem("kora.crm.supabaseRestoreDeletes.v1", JSON.stringify(logEntry));
      } catch (e) {
        /* silent catch for localStorage quota errors */
      }
      replaceInCache(restored);
      toast.success("Oportunidade restaurada com sucesso!");
    },
    onError: (err) => {
      console.error("Erro ao restaurar oportunidade deletada:", err);
      toast.error("Erro ao restaurar oportunidade.");
    },
  });

  const createOpportunity = async (input: SupabaseOpportunityInput) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return createMutation.mutateAsync(input);
  };

  const updateOpportunity = async (opportunityId: string, patch: Partial<SupabaseOpportunityInput>) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return updateMutation.mutateAsync({ opportunityId, patch });
  };

  const moveOpportunityStage = async (opportunityId: string, stage: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return moveStageMutation.mutateAsync({ opportunityId, stage });
  };

  const markWon = async (opportunityId: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return markWonMutation.mutateAsync(opportunityId);
  };

  const markLost = async (opportunityId: string, reason?: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return markLostMutation.mutateAsync({ opportunityId, reason });
  };

  const archiveOpportunity = async (opportunityId: string, archived = true) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return archiveMutation.mutateAsync({ opportunityId, archived });
  };

  // DIVERGÊNCIA INTENCIONAL #2: a guarda de workspace passa a devolver
  // `null` (antes devolvia `undefined`, único caso assimétrico das 8 —
  // R1 já tinha capturado essa assimetria explicitamente). O sucesso
  // continua devolvendo `undefined` (função efetivamente void pro
  // chamador) — só a guarda muda, alinhando com as outras 7.
  const deleteOpportunity = async (opportunityId: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    await deleteMutation.mutateAsync(opportunityId);
  };

  const restoreDeletedOpportunity = async (opportunityId: string) => {
    if (!workspaceId) {
      toast.error("Nenhum workspace ativo encontrado.");
      return null;
    }
    return restoreMutation.mutateAsync(opportunityId);
  };

  return {
    opportunities: query.data ?? EMPTY_OPPORTUNITIES,
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
