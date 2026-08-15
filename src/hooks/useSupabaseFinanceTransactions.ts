// Etapa 5 · Financeiro Fatia N — leitura Supabase opt-in pra tela principal
// (Financeiro.tsx). Diferente de useSupabaseFinancialSummary.ts (leitor
// cloud-only do painel de QA, só receivables — G20): este hook devolve
// receitas E despesas juntas, já traduzidas pro formato Transaction local
// (mesmo padrão de useSupabaseProjects.ts/useSupabaseQuotes.ts — a tela
// principal consome objetos prontos, não linhas cruas).
//
// enabled: !!workspaceId, nunca gated por dataSource (padrão G32 da casa —
// o hook Supabase busca em paralelo sempre; só o seletor decide qual
// resultado a tela EXIBE). Read-only nesta fatia: sem create/update/delete
// — a escrita em modo Supabase fica bloqueada incondicionalmente em
// Financeiro.tsx (blockWrite()), não existe ainda pra este domínio.
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository } from "@/repositories/financeRepository";
import { mapSupabaseTransactionToLocal } from "@/services/finance/financeMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useMemo } from "react";

export function useSupabaseFinanceTransactions() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { clients } = useClientsDataSource();

  const clientNameById = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[String(c.id)] = c.name; });
    return map;
  }, [clients]);

  const query = useQuery({
    queryKey: ["supabase-finance-transactions", workspaceId],
    queryFn: () => financeRepository.listTransactions(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const transactions = useMemo(
    () => (query.data ?? []).map((st) => mapSupabaseTransactionToLocal(st, clientNameById)),
    [query.data, clientNameById],
  );

  return {
    transactions,
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh: () => query.refetch(),
  };
}
