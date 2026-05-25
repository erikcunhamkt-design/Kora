import { useCallback, useEffect, useMemo, useState } from "react";
import { emitNotification } from "@/lib/notify";

export type TxType = "income" | "expense";
export type TxStatus = "pending" | "paid" | "overdue" | "canceled";
export type PaymentMethod = "pix" | "card" | "boleto" | "transfer" | "cash" | "other";
export type Recurrence = "none" | "weekly" | "monthly" | "yearly";
export type TxSource = "manual" | "quote" | "sale" | "service" | "recurring";

export interface Transaction {
  id: string;
  type: TxType;
  title: string;
  description?: string;
  amount: number;
  category: string;
  clientName?: string;
  supplierId?: string;
  cashAccountId?: string;
  /** ISO date yyyy-mm-dd */
  dueDate: string;
  paidDate?: string;
  status: TxStatus;
  paymentMethod: PaymentMethod;
  recurrence: Recurrence;
  source: TxSource;
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
  // --- v2 commercial linkage (optional, backward-compatible) ---
  clientId?: number;
  quoteId?: string;
  quoteTitle?: string;
  opportunityId?: number;
}

/** Legacy categorias usadas como fallback */
export const FINANCE_CATEGORIES = [
  "Serviços", "Produtos", "Assinaturas", "Marketing", "Ferramentas", "Impostos", "Comissões", "Outros",
];

// ============================================================
// Storage keys
// ============================================================
const STORAGE_KEY = "orbyt.finance.v1";
const SUPPLIERS_KEY = "kora.finance.suppliers.v1";
const CATEGORIES_KEY = "kora.finance.categories.v1";
const PIX_KEY = "kora.finance.pixSettings.v1";
const RECURRING_KEY = "kora.finance.recurring.v1";
const CASH_KEY = "kora.finance.cashAccounts.v1";

// ============================================================
// Helpers
// ============================================================
const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const safeLoad = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
};
const safeSave = (key: string, data: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
};

// ============================================================
// Transactions seed
// ============================================================
const rawDemo: Omit<Transaction, "isDemo">[] = [
  { id: "tx-demo-1", type: "income", title: "Projeto de identidade visual", description: "Branding completo Acme Corp", amount: 8500, category: "Serviços", clientName: "Acme Corp", dueDate: addDays(-10), paidDate: addDays(-9), status: "paid", paymentMethod: "pix", recurrence: "none", source: "manual", createdAt: addDays(-15) },
  { id: "tx-demo-2", type: "income", title: "Social media mensal", description: "Pacote mensal FitTrack", amount: 1800, category: "Serviços", clientName: "FitTrack", dueDate: addDays(-3), paidDate: addDays(-3), status: "paid", paymentMethod: "transfer", recurrence: "monthly", source: "service", createdAt: addDays(-30) },
  { id: "tx-demo-3", type: "income", title: "Landing page", description: "Página institucional Studio Zen", amount: 4200, category: "Serviços", clientName: "Studio Zen", dueDate: addDays(7), status: "pending", paymentMethod: "boleto", recurrence: "none", source: "quote", createdAt: addDays(-5) },
  { id: "tx-demo-4", type: "expense", title: "Assinatura de ferramenta", description: "Adobe Creative Cloud", amount: 290, category: "Ferramentas e Software", dueDate: addDays(-2), paidDate: addDays(-2), status: "paid", paymentMethod: "card", recurrence: "monthly", source: "manual", createdAt: addDays(-30) },
  { id: "tx-demo-5", type: "expense", title: "Tráfego pago", description: "Google Ads + Meta Ads", amount: 1200, category: "Marketing e Tráfego", dueDate: addDays(5), status: "pending", paymentMethod: "card", recurrence: "monthly", source: "manual", createdAt: addDays(-2) },
  { id: "tx-demo-6", type: "expense", title: "Software de edição", description: "Figma Professional", amount: 75, category: "Ferramentas e Software", dueDate: addDays(-1), paidDate: addDays(-1), status: "paid", paymentMethod: "card", recurrence: "monthly", source: "manual", createdAt: addDays(-30) },
  { id: "tx-demo-7", type: "income", title: "Conta a receber atrasada", description: "Catálogo digital Nova Design", amount: 4500, category: "Serviços", clientName: "Nova Design", dueDate: addDays(-8), status: "overdue", paymentMethod: "boleto", recurrence: "none", source: "manual", createdAt: addDays(-25) },
  { id: "tx-demo-8", type: "expense", title: "Conta a pagar futura", description: "Impostos trimestrais DAS", amount: 1250, category: "Impostos e Taxas", dueDate: addDays(12), status: "pending", paymentMethod: "boleto", recurrence: "none", source: "manual", createdAt: addDays(-1) },
];

export const initialTransactions: Transaction[] = rawDemo.map((t) => ({ ...t, isDemo: true }));
const SEED_IDS = new Set(rawDemo.map((t) => t.id));
function migrate(list: Transaction[]): Transaction[] {
  return list.map((t) =>
    t.isDemo === undefined && SEED_IDS.has(t.id) ? { ...t, isDemo: true } : t
  );
}

// ============================================================
// Categories
// ============================================================
export interface FinanceCategory {
  id: string;
  name: string;
  type: TxType;
  color: string;
  isDemo?: boolean;
}

const seedCategories: FinanceCategory[] = [
  { id: "cat-inc-1", name: "Serviços", type: "income", color: "#10b981", isDemo: true },
  { id: "cat-inc-2", name: "Produtos", type: "income", color: "#22c55e", isDemo: true },
  { id: "cat-inc-3", name: "Consultoria", type: "income", color: "#14b8a6", isDemo: true },
  { id: "cat-inc-4", name: "Projetos", type: "income", color: "#06b6d4", isDemo: true },
  { id: "cat-inc-5", name: "Assinaturas", type: "income", color: "#0ea5e9", isDemo: true },
  { id: "cat-inc-6", name: "Comissões", type: "income", color: "#84cc16", isDemo: true },
  { id: "cat-exp-1", name: "Ferramentas e Software", type: "expense", color: "#f43f5e", isDemo: true },
  { id: "cat-exp-2", name: "Marketing e Tráfego", type: "expense", color: "#ec4899", isDemo: true },
  { id: "cat-exp-3", name: "Salários e Freelancers", type: "expense", color: "#a855f7", isDemo: true },
  { id: "cat-exp-4", name: "Impostos e Taxas", type: "expense", color: "#ef4444", isDemo: true },
  { id: "cat-exp-5", name: "Infraestrutura", type: "expense", color: "#f97316", isDemo: true },
  { id: "cat-exp-6", name: "Material de Escritório", type: "expense", color: "#eab308", isDemo: true },
];

// ============================================================
// Suppliers
// ============================================================
export interface Supplier {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  defaultCategory?: string;
  notes?: string;
  archived?: boolean;
  isDemo?: boolean;
}

const seedSuppliers: Supplier[] = [
  { id: "sup-demo-1", name: "Adobe Systems", email: "billing@adobe.com", defaultCategory: "Ferramentas e Software", isDemo: true },
  { id: "sup-demo-2", name: "Google Ads", email: "ads@google.com", defaultCategory: "Marketing e Tráfego", isDemo: true },
  { id: "sup-demo-3", name: "Receita Federal", defaultCategory: "Impostos e Taxas", isDemo: true },
];

// ============================================================
// PIX settings
// ============================================================
export type PixKeyType = "cpf" | "cnpj" | "email" | "phone" | "random";
export type PixMethod = "manual" | "future";

export interface PixSettings {
  method: PixMethod;
  keyType: PixKeyType;
  key: string;
  beneficiary: string;
  city: string;
  message: string;
  showOnQuote: boolean;
}
const defaultPix: PixSettings = {
  method: "manual",
  keyType: "email",
  key: "",
  beneficiary: "",
  city: "",
  message: "Obrigado por escolher meu trabalho!",
  showOnQuote: false,
};

// ============================================================
// Recurring entries
// ============================================================
export type RecurFreq = "weekly" | "monthly" | "yearly";
export interface RecurringEntry {
  id: string;
  type: TxType;
  description: string;
  amount: number;
  frequency: RecurFreq;
  nextChargeAt: string; // yyyy-mm-dd
  clientName?: string;
  supplierId?: string;
  category: string;
  active: boolean;
  createdAt: string;
  isDemo?: boolean;
}

const seedRecurring: RecurringEntry[] = [
  { id: "rec-demo-1", type: "income", description: "Social media FitTrack", amount: 1800, frequency: "monthly", nextChargeAt: addDays(20), clientName: "FitTrack", category: "Serviços", active: true, createdAt: addDays(-60), isDemo: true },
  { id: "rec-demo-2", type: "expense", description: "Adobe Creative Cloud", amount: 290, frequency: "monthly", nextChargeAt: addDays(25), supplierId: "sup-demo-1", category: "Ferramentas e Software", active: true, createdAt: addDays(-90), isDemo: true },
];

// ============================================================
// Cash accounts
// ============================================================
export type CashAccountType = "bank" | "wallet" | "cash" | "platform" | "other";
export interface CashAccount {
  id: string;
  name: string;
  type: CashAccountType;
  initialBalance: number;
  color: string;
  active: boolean;
  isDemo?: boolean;
}
const seedCash: CashAccount[] = [
  { id: "cash-demo-1", name: "Conta principal", type: "bank", initialBalance: 5000, color: "#F81040", active: true, isDemo: true },
  { id: "cash-demo-2", name: "Carteira PIX", type: "wallet", initialBalance: 800, color: "#10b981", active: true, isDemo: true },
];

// ============================================================
// Hook
// ============================================================
export function useFinance() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const loaded = safeLoad<Transaction[] | null>(STORAGE_KEY, null);
    return loaded ? migrate(loaded) : initialTransactions;
  });
  const [suppliers, setSuppliers] = useState<Supplier[]>(() => safeLoad(SUPPLIERS_KEY, seedSuppliers));
  const [categories, setCategories] = useState<FinanceCategory[]>(() => safeLoad(CATEGORIES_KEY, seedCategories));
  const [pixSettings, setPixSettings] = useState<PixSettings>(() => safeLoad(PIX_KEY, defaultPix));
  const [recurring, setRecurring] = useState<RecurringEntry[]>(() => safeLoad(RECURRING_KEY, seedRecurring));
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>(() => safeLoad(CASH_KEY, seedCash));

  useEffect(() => { safeSave(STORAGE_KEY, transactions); }, [transactions]);
  useEffect(() => { safeSave(SUPPLIERS_KEY, suppliers); }, [suppliers]);
  useEffect(() => { safeSave(CATEGORIES_KEY, categories); }, [categories]);
  useEffect(() => { safeSave(PIX_KEY, pixSettings); }, [pixSettings]);
  useEffect(() => { safeSave(RECURRING_KEY, recurring); }, [recurring]);
  useEffect(() => { safeSave(CASH_KEY, cashAccounts); }, [cashAccounts]);

  // Transactions
  const addTransaction = useCallback((data: Omit<Transaction, "id" | "isDemo" | "createdAt">) => {
    const tx: Transaction = { ...data, id: `tx-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false };
    setTransactions((prev) => [tx, ...prev]);
    return tx;
  }, []);

  const updateTransactionStatus = useCallback((id: string, status: TxStatus) => {
    setTransactions((prev) => {
      const tx = prev.find((t) => t.id === id);
      if (tx && tx.status !== "paid" && status === "paid") {
        emitNotification({
          title: tx.type === "income" ? "Pagamento recebido" : "Despesa quitada",
          description: `${tx.title} · R$ ${tx.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
          category: "finance",
          type: "success",
          priority: tx.amount >= 1000 ? "high" : "medium",
          actionLabel: "Abrir financeiro",
          actionRoute: "/financeiro",
          sourceId: tx.id,
          sourceType: "transaction",
        });
      }
      return prev.map((t) =>
        t.id === id
          ? { ...t, status, paidDate: status === "paid" ? iso(new Date()) : t.paidDate }
          : t
      );
    });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id || t.isDemo));
  }, []);

  // Suppliers
  const addSupplier = useCallback((s: Omit<Supplier, "id" | "isDemo">) => {
    setSuppliers((p) => [{ ...s, id: `sup-${Date.now()}`, isDemo: false }, ...p]);
  }, []);
  const updateSupplier = useCallback((id: string, patch: Partial<Supplier>) => {
    setSuppliers((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);
  const archiveSupplier = useCallback((id: string) => {
    setSuppliers((p) => p.map((s) => (s.id === id ? { ...s, archived: !s.archived } : s)));
  }, []);

  // Categories
  const addCategory = useCallback((c: Omit<FinanceCategory, "id" | "isDemo">) => {
    setCategories((p) => [...p, { ...c, id: `cat-${Date.now()}`, isDemo: false }]);
  }, []);
  const updateCategory = useCallback((id: string, patch: Partial<FinanceCategory>) => {
    setCategories((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const deleteCategory = useCallback((id: string, name: string) => {
    const used = transactions.some((t) => t.category === name);
    if (used) return false;
    setCategories((p) => p.filter((c) => c.id !== id));
    return true;
  }, [transactions]);

  // Recurring
  const addRecurring = useCallback((r: Omit<RecurringEntry, "id" | "isDemo" | "createdAt">) => {
    setRecurring((p) => [{ ...r, id: `rec-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false }, ...p]);
  }, []);
  const updateRecurring = useCallback((id: string, patch: Partial<RecurringEntry>) => {
    setRecurring((p) => p.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);
  const deleteRecurring = useCallback((id: string) => {
    setRecurring((p) => p.filter((r) => r.id !== id || r.isDemo));
  }, []);

  // Cash accounts
  const addCashAccount = useCallback((c: Omit<CashAccount, "id" | "isDemo">) => {
    setCashAccounts((p) => [...p, { ...c, id: `cash-${Date.now()}`, isDemo: false }]);
  }, []);
  const updateCashAccount = useCallback((id: string, patch: Partial<CashAccount>) => {
    setCashAccounts((p) => p.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const deleteCashAccount = useCallback((id: string) => {
    setCashAccounts((p) => p.filter((c) => c.id !== id || c.isDemo));
  }, []);

  return {
    transactions, addTransaction, updateTransactionStatus, deleteTransaction, setTransactions,
    suppliers, addSupplier, updateSupplier, archiveSupplier,
    categories, addCategory, updateCategory, deleteCategory,
    pixSettings, setPixSettings,
    recurring, addRecurring, updateRecurring, deleteRecurring,
    cashAccounts, addCashAccount, updateCashAccount, deleteCashAccount,
  };
}

// ============================================================
// Formatters
// ============================================================
export const formatBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 });

export const formatDateBR = (iso?: string) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y.slice(2)}`;
};

// ============================================================
// Metrics
// ============================================================
export function useFinanceMetrics(transactions: Transaction[], monthlyGoal = 35000) {
  return useMemo(() => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const inThisMonth = (d: string) => d.startsWith(ym);

    const incomeMonth = transactions
      .filter((t) => t.type === "income" && t.status === "paid" && inThisMonth(t.paidDate || t.dueDate))
      .reduce((s, t) => s + t.amount, 0);
    const expenseMonth = transactions
      .filter((t) => t.type === "expense" && t.status === "paid" && inThisMonth(t.paidDate || t.dueDate))
      .reduce((s, t) => s + t.amount, 0);

    const receivables = transactions.filter((t) => t.type === "income");
    const payables = transactions.filter((t) => t.type === "expense");

    const recPendingTotal = receivables.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);
    const recOverdueTotal = receivables.filter((t) => t.status === "overdue").reduce((s, t) => s + t.amount, 0);
    const payPendingTotal = payables.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);
    const payOverdueTotal = payables.filter((t) => t.status === "overdue").reduce((s, t) => s + t.amount, 0);

    const billedMonth = receivables
      .filter((t) => inThisMonth(t.dueDate))
      .reduce((s, t) => s + t.amount, 0);
    const expensesMonthTotal = payables
      .filter((t) => inThisMonth(t.dueDate))
      .reduce((s, t) => s + t.amount, 0);

    const pending = recPendingTotal + recOverdueTotal;
    const overdueCount = transactions.filter((t) => t.status === "overdue").length;
    const goalPct = Math.min(Math.round((incomeMonth / monthlyGoal) * 100), 100);

    return {
      incomeMonth, expenseMonth, profit: incomeMonth - expenseMonth,
      pending, overdueCount, monthlyGoal, goalPct,
      recPendingTotal, recOverdueTotal, payPendingTotal, payOverdueTotal,
      billedMonth, expensesMonthTotal,
    };
  }, [transactions, monthlyGoal]);
}

export function useMonthlySeries(transactions: Transaction[], months = 6) {
  return useMemo(() => {
    const now = new Date();
    const series: { month: string; receita: number; despesas: number; saldo: number }[] = [];
    let saldo = 0;
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
      saldo += receita - despesas;
      series.push({ month: label.charAt(0).toUpperCase() + label.slice(1), receita, despesas, saldo });
    }
    return series;
  }, [transactions, months]);
}
