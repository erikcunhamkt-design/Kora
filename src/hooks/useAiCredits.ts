import { useCallback, useEffect, useMemo, useState } from "react";

// TODO(backend): In production, AI credits MUST live server-side.
// - Balance debits must be transactional (atomic decrement before AI call).
// - Real purchases credited only via signed webhooks (Stripe/Asaas/etc).
// - Frontend should only READ balance; never trust client-side mutations.

export type CreditTxType =
  | "purchase"
  | "purchase_simulated"
  | "usage"
  | "bonus"
  | "adjustment";

export interface CreditTransaction {
  id: string;
  type: CreditTxType;
  amount: number;
  description: string;
  createdAt: string;
  isDemo: boolean;
}

export interface AiCreditState {
  balance: number;
  transactions: CreditTransaction[];
}

const STORAGE_KEY = "orbyt.ai.credits.v1";

const seed: AiCreditState = {
  balance: 25,
  transactions: [
    { id: "tx-demo-1", type: "bonus", amount: 25, description: "Bônus de boas-vindas", createdAt: new Date().toISOString(), isDemo: true },
    { id: "tx-demo-2", type: "usage", amount: -3, description: "Uso simulado — Copy Pro", createdAt: new Date().toISOString(), isDemo: true },
  ],
};

export function openCreditsWallet() {
  window.dispatchEvent(new CustomEvent("orbyt:open-credits"));
}

export function useAiCredits() {
  const [state, setState] = useState<AiCreditState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return seed;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }, [state]);

  const addTransaction = useCallback(
    (tx: Omit<CreditTransaction, "id" | "createdAt" | "isDemo"> & { isDemo?: boolean }) => {
      setState((prev) => ({
        balance: Math.max(0, prev.balance + tx.amount),
        transactions: [
          {
            ...tx,
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: new Date().toISOString(),
            isDemo: tx.isDemo ?? false,
          },
          ...prev.transactions,
        ],
      }));
    },
    [],
  );

  const consumeCredit = useCallback((amount = 1, description = "Uso simulado") => {
    let ok = false;
    setState((prev) => {
      if (prev.balance < amount) return prev;
      ok = true;
      return {
        balance: Math.max(0, prev.balance - amount),
        transactions: [
          { id: `tx-${Date.now()}`, type: "usage", amount: -amount, description, createdAt: new Date().toISOString(), isDemo: false },
          ...prev.transactions,
        ],
      };
    });
    return ok;
  }, []);

  const simulatePurchase = useCallback(
    (pack: { name: string; credits: number }) => {
      setState((prev) => ({
        balance: prev.balance + pack.credits,
        transactions: [
          {
            id: `tx-${Date.now()}`,
            type: "purchase_simulated",
            amount: pack.credits,
            description: `Pacote ${pack.name} (compra simulada)`,
            createdAt: new Date().toISOString(),
            isDemo: false,
          },
          ...prev.transactions,
        ],
      }));
    },
    [],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
    const usageTxs = state.transactions.filter((t) => t.type === "usage");
    const monthUsage = usageTxs
      .filter((t) => {
        const d = new Date(t.createdAt);
        return `${d.getFullYear()}-${d.getMonth()}` === monthKey;
      })
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const lastUsed = usageTxs[0]?.createdAt ?? null;
    const totalUsage = usageTxs.reduce((s, t) => s + Math.abs(t.amount), 0);
    const avgPerAction = usageTxs.length ? totalUsage / usageTxs.length : 0;
    return { monthUsage, lastUsed, avgPerAction, totalActions: usageTxs.length };
  }, [state.transactions]);

  return { ...state, addTransaction, consumeCredit, simulatePurchase, stats };
}
