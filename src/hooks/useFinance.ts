import { useCallback, useEffect, useMemo, useState } from "react";

export type TxType = "income" | "expense";
export type TxStatus = "pending" | "paid" | "overdue" | "canceled";
export type PaymentMethod = "pix" | "card" | "boleto" | "transfer" | "cash" | "other";
export type Recurrence = "none" | "monthly" | "weekly" | "yearly";
export type TxSource = "manual" | "quote" | "sale" | "service";

export interface Transaction {
  id: string;
  type: TxType;
  title: string;
  description?: string;
  amount: number;
  category: string;
  clientName?: string;
  /** ISO date yyyy-mm-dd */
  dueDate: string;
  paidDate?: string;
  status: TxStatus;
  paymentMethod: PaymentMethod;
  recurrence: Recurrence;
  source: TxSource;
  createdAt: string;
  isDemo?: boolean;
}

export const FINANCE_CATEGORIES = [
  "Serviços",
  "Produtos",
  "Assinaturas",
  "Marketing",
  "Ferramentas",
  "Impostos",
  "Comissões",
  "Outros",
];

const STORAGE_KEY = "orbyt.finance.v1";

const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const rawDemo: Omit<Transaction, "isDemo">[] = [
  // Receitas
  { id: "tx-demo-1", type: "income", title: "Projeto de identidade visual", description: "Branding completo Acme Corp", amount: 8500, category: "Serviços", clientName: "Acme Corp", dueDate: addDays(-10), paidDate: addDays(-9), status: "paid", paymentMethod: "pix", recurrence: "none", source: "manual", createdAt: addDays(-15) },
  { id: "tx-demo-2", type: "income", title: "Social media mensal", description: "Pacote mensal FitTrack", amount: 1800, category: "Serviços", clientName: "FitTrack", dueDate: addDays(-3), paidDate: addDays(-3), status: "paid", paymentMethod: "transfer", recurrence: "monthly", source: "service", createdAt: addDays(-30) },
  { id: "tx-demo-3", type: "income", title: "Landing page", description: "Página institucional Studio Zen", amount: 4200, category: "Serviços", clientName: "Studio Zen", dueDate: addDays(7), status: "pending", paymentMethod: "boleto", recurrence: "none", source: "quote", createdAt: addDays(-5) },
  // Despesas
  { id: "tx-demo-4", type: "expense", title: "Assinatura de ferramenta", description: "Adobe Creative Cloud", amount: 290, category: "Assinaturas", dueDate: addDays(-2), paidDate: addDays(-2), status: "paid", paymentMethod: "card", recurrence: "monthly", source: "manual", createdAt: addDays(-30) },
  { id: "tx-demo-5", type: "expense", title: "Tráfego pago", description: "Google Ads + Meta Ads", amount: 1200, category: "Marketing", dueDate: addDays(5), status: "pending", paymentMethod: "card", recurrence: "monthly", source: "manual", createdAt: addDays(-2) },
  { id: "tx-demo-6", type: "expense", title: "Software de edição", description: "Figma Professional", amount: 75, category: "Ferramentas", dueDate: addDays(-1), paidDate: addDays(-1), status: "paid", paymentMethod: "card", recurrence: "monthly", source: "manual", createdAt: addDays(-30) },
  // Pendências
  { id: "tx-demo-7", type: "income", title: "Conta a receber atrasada", description: "Catálogo digital Nova Design", amount: 4500, category: "Serviços", clientName: "Nova Design", dueDate: addDays(-8), status: "overdue", paymentMethod: "boleto", recurrence: "none", source: "manual", createdAt: addDays(-25) },
  { id: "tx-demo-8", type: "expense", title: "Conta a pagar futura", description: "Impostos trimestrais DAS", amount: 1250, category: "Impostos", dueDate: addDays(12), status: "pending", paymentMethod: "boleto", recurrence: "none", source: "manual", createdAt: addDays(-1) },
];

export const initialTransactions: Transaction[] = rawDemo.map((t) => ({ ...t, isDemo: true }));

const SEED_IDS = new Set(rawDemo.map((t) => t.id));

function migrate(list: Transaction[]): Transaction[] {
  return list.map((t) =>
    t.isDemo === undefined && SEED_IDS.has(t.id) ? { ...t, isDemo: true } : t
  );
}

export function useFinance() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as Transaction[]);
    } catch {}
    return initialTransactions;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
    } catch {}
  }, [transactions]);

  const addTransaction = useCallback((data: Omit<Transaction, "id" | "isDemo" | "createdAt">) => {
    setTransactions((prev) => [
      { ...data, id: `tx-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false },
      ...prev,
    ]);
  }, []);

  const updateTransactionStatus = useCallback((id: string, status: TxStatus) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, status, paidDate: status === "paid" ? iso(new Date()) : t.paidDate }
          : t
      )
    );
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id || t.isDemo));
  }, []);

  return { transactions, addTransaction, updateTransactionStatus, deleteTransaction, setTransactions };
}

export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

export const formatDateBR = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
};

export function useFinanceMetrics(transactions: Transaction[], monthlyGoal = 35000) {
  return useMemo(() => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const inThisMonth = (d: string) => d.startsWith(yearMonth);

    const incomeMonth = transactions
      .filter((t) => t.type === "income" && t.status === "paid" && inThisMonth(t.paidDate || t.dueDate))
      .reduce((s, t) => s + t.amount, 0);

    const expenseMonth = transactions
      .filter((t) => t.type === "expense" && t.status === "paid" && inThisMonth(t.paidDate || t.dueDate))
      .reduce((s, t) => s + t.amount, 0);

    const pending = transactions
      .filter((t) => t.status === "pending" || t.status === "overdue")
      .reduce((s, t) => s + (t.type === "income" ? t.amount : 0), 0);

    const overdueCount = transactions.filter((t) => t.status === "overdue").length;

    const goalPct = Math.min(Math.round((incomeMonth / monthlyGoal) * 100), 100);

    return {
      incomeMonth,
      expenseMonth,
      profit: incomeMonth - expenseMonth,
      pending,
      overdueCount,
      monthlyGoal,
      goalPct,
    };
  }, [transactions, monthlyGoal]);
}

export function useMonthlySeries(transactions: Transaction[], months = 6) {
  return useMemo(() => {
    const now = new Date();
    const series: { month: string; receita: number; despesas: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
      const receita = transactions
        .filter((t) => t.type === "income" && t.status === "paid" && (t.paidDate || t.dueDate).startsWith(ym))
        .reduce((s, t) => s + t.amount, 0);
      const despesas = transactions
        .filter((t) => t.type === "expense" && t.status === "paid" && (t.paidDate || t.dueDate).startsWith(ym))
        .reduce((s, t) => s + t.amount, 0);
      series.push({ month: label.charAt(0).toUpperCase() + label.slice(1), receita, despesas });
    }
    return series;
  }, [transactions, months]);
}
