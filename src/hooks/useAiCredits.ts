import { useCallback, useEffect, useState } from "react";

export type CreditTxType = "purchase" | "usage" | "bonus";

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

  const addTransaction = useCallback((tx: Omit<CreditTransaction, "id" | "createdAt" | "isDemo">) => {
    setState((prev) => ({
      balance: Math.max(0, prev.balance + tx.amount),
      transactions: [
        { ...tx, id: `tx-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false },
        ...prev.transactions,
      ],
    }));
  }, []);

  const consumeCredit = useCallback((amount = 1, description = "Uso simulado") => {
    setState((prev) => {
      if (prev.balance <= 0) return prev;
      return {
        balance: Math.max(0, prev.balance - amount),
        transactions: [
          { id: `tx-${Date.now()}`, type: "usage", amount: -amount, description, createdAt: new Date().toISOString(), isDemo: false },
          ...prev.transactions,
        ],
      };
    });
  }, []);

  return { ...state, addTransaction, consumeCredit };
}
