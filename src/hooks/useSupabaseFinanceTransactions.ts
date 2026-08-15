// Etapa 5 · Financeiro — leitura Supabase opt-in pra tela principal
// (Financeiro.tsx). Diferente de useSupabaseFinancialSummary.ts (leitor
// cloud-only do painel de QA, só receivables — G20): este hook devolve
// receitas E despesas juntas, já traduzidas pro formato Transaction local
// (mesmo padrão de useSupabaseProjects.ts/useSupabaseQuotes.ts — a tela
// principal consome objetos prontos, não linhas cruas).
//
// enabled: !!workspaceId, nunca gated por dataSource (padrão G32 da casa —
// o hook Supabase busca em paralelo sempre; só o seletor decide qual
// resultado a tela EXIBE).
//
// Fase B (Pacote do Flip, §2.5 do desenho) — ganhou create/update/delete.
// `createTransaction` reaproveita `importTransaction` com
// `buildNativeSourceLocalId()`, mesmo precedente de `useSupabaseProjects.ts`
// (criação nativa, sem origem local — nunca colide com o arbiter de
// idempotência do import geral). `updateTransaction`/`deleteTransaction`
// escrevem a linha devolvida pelo próprio UPDATE/soft-delete direto no
// cache via `setQueryData` (G30 por desenho — nunca só
// `invalidateQueries()`, o mesmo fix que Projetos precisou aplicar
// reativamente depois de um drawer aberto ficar preso mostrando o status
// antigo da própria mutação).
import { useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { financeRepository, type SupabaseFinancialTransaction } from "@/repositories/financeRepository";
import { mapSupabaseTransactionToLocal, mapLocalTransactionToSupabase } from "@/services/finance/financeMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Transaction } from "@/hooks/useFinance";

const EMPTY_TRANSACTIONS: SupabaseFinancialTransaction[] = [];

/** Mesmo shape que useFinance().addTransaction() já aceita — permite montar
 * UM objeto de formulário e passar pro caminho nativo-nuvem sem
 * transformação (mesmo precedente de NewProjectInput, useSupabaseProjects.ts). */
export type NewTransactionInput = Omit<Transaction, "id" | "createdAt" | "isDemo">;

export function useSupabaseFinanceTransactions() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { clients } = useClientsDataSource();
  const queryClient = useQueryClient();
  const queryKey = ["supabase-finance-transactions", workspaceId];

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[String(c.id)] = c.name; });
    return map;
  }, [clients]);

  const query = useQuery({
    queryKey,
    queryFn: () => financeRepository.listTransactions(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (input: NewTransactionInput) => {
      // mapLocalTransactionToSupabase só lê os campos de negócio (type,
      // status, title, amount, category, paymentMethod, datas, source, FKs)
      // — id/createdAt/isDemo aqui só satisfazem o tipo Transaction, nunca
      // lidos pelo mapper. Sem import-map (maps omitido -> vazio): uma
      // criação nativa não tem origem local a resolver — se o chamador já
      // passar um uuid real em clientId/quoteId/opportunityId (cliente/quote
      // já lido da nuvem), o passthrough de resolveFinanceFk (G37 por
      // desenho) cobre isso sem precisar de mapa nenhum.
      const txLike: Transaction = { ...input, id: "", createdAt: "", isDemo: false };
      const payload = mapLocalTransactionToSupabase(txLike);
      return financeRepository.importTransaction(workspaceId, buildNativeSourceLocalId(), payload);
    },
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseFinancialTransaction[]>(
        queryKey,
        (prev) => [created, ...(prev ?? []).filter((t) => t.id !== created.id)],
      );
    },
  });

  // G30 por desenho: grava a linha devolvida pelo próprio UPDATE direto no
  // cache — nunca depende de um refetch subsequente pra refletir a própria
  // escrita (ver docs/architecture/kora-hub-auditoria-e-plano.md, G30).
  const updateMutation = useMutation({
    mutationFn: ({ transactionId, patch }: { transactionId: string; patch: Partial<SupabaseFinancialTransaction> }) =>
      financeRepository.updateTransaction(workspaceId, transactionId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseFinancialTransaction[]>(
        queryKey,
        (prev) => (prev ?? []).map((t) => (t.id === updated.id ? updated : t)),
      );
    },
  });

  // softDeleteReceivable (financeRepository.ts) é genérico apesar do nome —
  // UPDATE deleted_at WHERE id AND workspace_id, sem filtro de type — mesma
  // função já usada pra recebíveis quote-linked, reaproveitada aqui pra
  // exclusão geral (nenhuma função nova precisa existir).
  const deleteMutation = useMutation({
    mutationFn: (transactionId: string) => financeRepository.softDeleteReceivable(workspaceId, transactionId),
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseFinancialTransaction[]>(
        queryKey,
        (prev) => (prev ?? []).filter((t) => t.id !== deleted.id),
      );
    },
  });

  const transactions = useMemo(
    () => (query.data ?? EMPTY_TRANSACTIONS).map((st) => mapSupabaseTransactionToLocal(st, clientNameById)),
    [query.data, clientNameById],
  );

  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const refresh = useCallback(() => { refetchRef.current(); }, []);

  return {
    transactions,
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,

    createTransaction: (input: NewTransactionInput) => createMutation.mutateAsync(input),
    updateTransaction: (transactionId: string, patch: Partial<SupabaseFinancialTransaction>) =>
      updateMutation.mutateAsync({ transactionId, patch }),
    deleteTransaction: (transactionId: string) => deleteMutation.mutateAsync(transactionId),
  };
}
