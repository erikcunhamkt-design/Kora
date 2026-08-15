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

// Etapa 5 · Pacote do Flip (Fase C) — getFinanceDataSource() default virou
// "supabase" (só "local" explícito escolhe local, mesmo formato de
// CRM/quotes/projects). Este describe passou de "default" pra "explícito":
// o teste agora grava "local" no seletor antes de renderizar, provando que
// a escolha explícita continua funcionando — não mais o cenário de
// "seletor nunca tocado", que agora mostra nuvem (primeiro teste do
// describe abaixo).
describe("useBifurcatedFinance — modo local (explícito)", () => {
  it("\"local\" explícito devolve as transações locais", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "local");
    vi.mocked(useFinance).mockReturnValue({ transactions: [makeLocalTx()] } as never);
    vi.mocked(useSupabaseFinanceTransactions).mockReturnValue({ transactions: [makeCloudTx()] } as never);

    const { result } = renderHook(() => useBifurcatedFinance());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Local X");
  });
});

describe("useBifurcatedFinance — modo Supabase", () => {
  it("devolve as transações da nuvem quando o seletor nunca foi tocado (novo default, Pacote do Flip)", () => {
    vi.mocked(useFinance).mockReturnValue({ transactions: [] } as never);
    vi.mocked(useSupabaseFinanceTransactions).mockReturnValue({ transactions: [makeCloudTx()] } as never);

    const { result } = renderHook(() => useBifurcatedFinance());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Nuvem X");
  });

  it("devolve as transações já mapeadas de useSupabaseFinanceTransactions quando o seletor está em 'supabase' (explícito)", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useFinance).mockReturnValue({ transactions: [makeLocalTx()] } as never);
    vi.mocked(useSupabaseFinanceTransactions).mockReturnValue({ transactions: [makeCloudTx()] } as never);

    const { result } = renderHook(() => useBifurcatedFinance());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Nuvem X");
  });
});
