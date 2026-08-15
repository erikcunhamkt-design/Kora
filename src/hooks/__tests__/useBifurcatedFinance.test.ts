// Etapa 5 · Financeiro Fase B (Pacote do Flip, §3 do desenho) — prova o
// hook compartilhado pelos consumidores fora da tela principal. Mocka
// useFinance/useSupabaseFinanceTransactions diretamente (já testados
// isoladamente em seus próprios arquivos) — este teste prova só a escolha
// de fonte, mesmo escopo de useBifurcatedProjects.test.ts.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useFinance, type Transaction } from "@/hooks/useFinance";
import { useSupabaseFinanceTransactions } from "@/hooks/useSupabaseFinanceTransactions";
import { FINANCE_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useFinance", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useFinance")>("@/hooks/useFinance");
  return { ...actual, useFinance: vi.fn() };
});
vi.mock("@/hooks/useSupabaseFinanceTransactions", () => ({ useSupabaseFinanceTransactions: vi.fn() }));

function makeLocalTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-local-1", type: "income", title: "Local X", amount: 100, category: "Serviços",
    dueDate: "2026-08-01", status: "pending", paymentMethod: "pix", recurrence: "none",
    source: "manual", createdAt: "2026-07-01", isDemo: false,
    ...overrides,
  };
}

function makeCloudTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-cloud-1", type: "income", title: "Nuvem X", amount: 200, category: "Sem categoria (nuvem)",
    dueDate: "2026-08-05", status: "pending", paymentMethod: "other", recurrence: "none",
    source: "manual", createdAt: "2026-08-01", isDemo: false,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("useBifurcatedFinance — modo local (default, pré-flip)", () => {
  it("devolve as transações locais quando o seletor nunca foi tocado (default local)", () => {
    vi.mocked(useFinance).mockReturnValue({ transactions: [makeLocalTx()] } as never);
    vi.mocked(useSupabaseFinanceTransactions).mockReturnValue({ transactions: [] } as never);

    const { result } = renderHook(() => useBifurcatedFinance());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Local X");
  });

  it("\"local\" explícito também devolve as locais", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "local");
    vi.mocked(useFinance).mockReturnValue({ transactions: [makeLocalTx()] } as never);
    vi.mocked(useSupabaseFinanceTransactions).mockReturnValue({ transactions: [makeCloudTx()] } as never);

    const { result } = renderHook(() => useBifurcatedFinance());

    expect(result.current[0].title).toBe("Local X");
  });
});

describe("useBifurcatedFinance — modo Supabase (explícito)", () => {
  it("devolve as transações já mapeadas de useSupabaseFinanceTransactions quando o seletor está em 'supabase'", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useFinance).mockReturnValue({ transactions: [makeLocalTx()] } as never);
    vi.mocked(useSupabaseFinanceTransactions).mockReturnValue({ transactions: [makeCloudTx()] } as never);

    const { result } = renderHook(() => useBifurcatedFinance());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Nuvem X");
  });
});
