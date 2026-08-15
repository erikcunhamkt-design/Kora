import type { Client } from "@/hooks/useClients";
import type { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { parseDate, fmtDate } from "./format";
import type { InferredEvent } from "./types";

export function buildFinanceEvents(args: {
  client: Client;
  // useBifurcatedFinance() retorna array direto (não {transactions: [...]}
  // como o hook local antigo) — sem indexação, shape diferente de
  // useQuotes()/useLeads(). Ver G26 (kora-hub-auditoria-e-plano.md).
  transactions: ReturnType<typeof useBifurcatedFinance>;
}): InferredEvent[] {
  const { client, transactions } = args;
  const evts: InferredEvent[] = [];
  const today = new Date();
  const matchesByName = (name?: string) => !!name && name.toLowerCase() === client.name.toLowerCase();

  const clientTxs = transactions.filter(
    (t) => t.type === "income" && (t.clientId === client.id || matchesByName(t.clientName)),
  );
  clientTxs.forEach((t) => {
    const created = parseDate(t.createdAt);
    if (created) evts.push({
      origin: "inferred", id: `tx-c-${t.id}`, type: "receivable_created", category: "finance",
      title: "Conta a receber gerada",
      description: `${t.title} · venc. ${fmtDate(t.dueDate)}`,
      amount: t.amount, date: created, tone: "neutral",
      action: { label: "Ver financeiro", href: `/financeiro?tab=receivables&entryId=${t.id}` },
    });
    if (t.status === "paid" && t.paidDate) {
      const p = parseDate(t.paidDate);
      if (p) evts.push({
        origin: "inferred", id: `tx-p-${t.id}`, type: "receivable_paid", category: "finance",
        title: "Pagamento recebido", description: t.title,
        amount: t.amount, date: p, status: "Pago", tone: "success",
        action: { label: "Ver financeiro", href: `/financeiro?tab=receivables&entryId=${t.id}` },
      });
    }
    const dueDate = new Date(t.dueDate);
    const isOverdue = t.status === "overdue" || (t.status === "pending" && !isNaN(dueDate.getTime()) && dueDate < today);
    if (isOverdue) {
      evts.push({
        origin: "inferred", id: `tx-o-${t.id}`, type: "receivable_overdue", category: "finance",
        title: "Recebível vencido", description: `${t.title} · venceu em ${fmtDate(t.dueDate)}`,
        amount: t.amount, date: parseDate(t.dueDate) ?? created ?? new Date().toISOString(),
        status: "Vencido", tone: "danger",
      });
    }
  });

  return evts;
}
