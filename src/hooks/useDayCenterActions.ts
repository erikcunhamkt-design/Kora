import { useCallback } from "react";
import { toast } from "sonner";
import { useTasks } from "@/hooks/useTasks";
import { useFinance } from "@/hooks/useFinance";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { getFinanceDataSource } from "@/config/flags";
import { useAllClientActivityLogs, useClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { useDayCenterResolvedActions } from "@/hooks/useDayCenterResolvedActions";
import type { DayActionItem } from "@/lib/dayCenter";

/**
 * Hook compartilhado entre o drawer da Central do Dia e a página /central-do-dia.
 * Expõe ações rápidas reais (concluir tarefa, resolver follow-up, marcar recebível pago)
 * e centraliza a regra de "pode marcar pago" sem duplicar lógica.
 *
 * Etapa 5 · Financeiro Fase B (Pacote do Flip, §3.1 do desenho) —
 * `transactions` (leitura/exibição) vem de `useBifurcatedFinance()`, mas
 * `updateTransactionStatus` (escrita) continua sendo o mutator LOCAL de
 * `useFinance()`, por decisão explícita do desenho ("escrita segue
 * local-only por enquanto — concluir transação pela Central do Dia não é a
 * rota crítica desta fase"). Ler bifurcado e escrever só local, sem gate,
 * seria um no-op silencioso em modo Supabase (a transação exibida pode ser
 * uma linha da nuvem, sem contraparte local com esse id) — `canMarkPaid`
 * bloqueia a ação inteira quando `dataSource=supabase` (some do menu, não
 * fica clicável-mas-quebrado), e `markReceivablePaid` tem a mesma guarda
 * como defesa em profundidade, com toast explicando o porquê.
 *
 * TODO (revisão Lane E, NOTA-d — etapa-5-flip-financeiro-pacote.md §6.4):
 * esta guarda existe DUPLICADA em `DayCenter.tsx` (canMarkPaid/confirmMarkPaid,
 * mesma lógica). Extrair pra um helper compartilhado — não feito nesta
 * rodada pra não aumentar o escopo da Fase B além do desenho.
 */
export function useDayCenterActions() {
  const { updateTask } = useTasks();
  const { updateTransactionStatus } = useFinance();
  const transactions = useBifurcatedFinance();
  const { updateLog } = useClientActivityLogs();
  const allManualLogs = useAllClientActivityLogs();
  const { addAction } = useDayCenterResolvedActions();

  const completeTask = useCallback((item: DayActionItem) => {
    if (item.relatedType !== "task" || item.relatedId == null) return;
    try {
      updateTask(Number(item.relatedId), { status: "concluido" });
    } catch {
      toast.error("Não foi possível concluir a tarefa");
      return;
    }
    addAction({
      type: "task_completed",
      relatedType: "task",
      relatedId: String(item.relatedId),
      title: item.title,
    });
    toast.success("Tarefa concluída");
  }, [updateTask, addAction]);

  const resolveManualFollowUp = useCallback((item: DayActionItem) => {
    if (item.relatedType !== "manual_activity" || !item.relatedId) return;
    const logId = String(item.relatedId);
    try {
      updateLog(logId, { resolvedAt: new Date().toISOString() });
    } catch {
      toast.error("Não foi possível resolver o follow-up");
      return;
    }
    const log = allManualLogs.find((l) => l.id === logId);
    addAction({
      type: "manual_followup_resolved",
      relatedType: "manual_activity",
      relatedId: logId,
      title: item.title || log?.nextStep || "Follow-up",
      clientId: log?.clientId,
    });
    toast.success("Follow-up marcado como resolvido");
  }, [updateLog, allManualLogs, addAction]);

  const markReceivablePaid = useCallback((item: DayActionItem) => {
    if (!item.relatedId) return;
    if (getFinanceDataSource() === "supabase") {
      toast.error("Marcar como pago pela Central do Dia ainda não funciona em modo Supabase — use a tela Financeiro.");
      return;
    }
    const txId = String(item.relatedId);
    const tx = transactions.find((t) => t.id === txId);
    try {
      updateTransactionStatus(txId, "paid");
    } catch {
      toast.error("Não foi possível marcar como pago");
      return;
    }
    addAction({
      type: "receivable_paid",
      relatedType: "finance_transaction",
      relatedId: txId,
      title: tx?.title || item.title,
      amount: tx?.amount ?? item.amount,
      clientId: tx?.clientId,
    });
    toast.success("Recebível marcado como pago");
  }, [transactions, updateTransactionStatus, addAction]);

  const canMarkPaid = useCallback((item: DayActionItem): boolean => {
    if (item.relatedType !== "finance_transaction") return false;
    if (getFinanceDataSource() === "supabase") return false;
    const tx = transactions.find((t) => t.id === item.relatedId);
    return !!tx && tx.type === "income" && tx.status !== "paid" && tx.status !== "canceled";
  }, [transactions]);

  return { completeTask, resolveManualFollowUp, markReceivablePaid, canMarkPaid };
}
