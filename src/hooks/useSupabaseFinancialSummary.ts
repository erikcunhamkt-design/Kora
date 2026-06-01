import { useCallback, useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository, type SupabaseFinancialTransaction } from "@/repositories/financeRepository";

export function useSupabaseFinancialSummary() {
  const { workspace } = useCurrentWorkspace();
  const [receivables, setReceivables] = useState<SupabaseFinancialTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id ?? "";

  const fetchReceivables = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await financeRepository.listReceivables(workspaceId);
      setReceivables(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar recebíveis do Supabase");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchReceivables();
  }, [fetchReceivables]);

  return {
    receivables,
    loading,
    error,
    refresh: fetchReceivables,
  };
}
