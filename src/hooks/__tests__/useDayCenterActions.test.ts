// Etapa 5 · Financeiro Fase B (Pacote do Flip, §3.1 do desenho) — prova a
// guarda que evita o no-op silencioso: transactions vem bifurcado
// (leitura), mas updateTransactionStatus continua o mutator LOCAL (escrita
// local-only por decisão do desenho). Sem a guarda, "marcar pago" numa
// transação exibida da nuvem chamaria updateTransactionStatus com um id
// que não existe em orbyt.finance.v1 — nenhum erro, nenhum efeito, toast de
// sucesso mesmo assim (mesma classe de risco do O2/O3/O4).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useDayCenterActions } from "@/hooks/useDayCenterActions";
import { useTasks } from "@/hooks/useTasks";
import { useFinance } from "@/hooks/useFinance";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useClientActivityLogs, useAllClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { useDayCenterResolvedActions } from "@/hooks/useDayCenterResolvedActions";
import { FINANCE_DATA_SOURCE_KEY } from "@/config/flags";
import { toast } from "sonner";
import type { DayActionItem } from "@/lib/dayCenter";

vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/hooks/useFinance", () => ({ useFinance: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useClientActivityLogs", () => ({
  useClientActivityLogs: vi.fn(),
  useAllClientActivityLogs: vi.fn(),
}));
vi.mock("@/hooks/useDayCenterResolvedActions", () => ({ useDayCenterResolvedActions: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const cloudReceivable = {
  id: "sft-1", type: "income" as const, title: "Recebível Nuvem", amount: 300,
  category: "Sem categoria (nuvem)", dueDate: "2026-08-20", status: "pending" as const,
  paymentMethod: "other" as const, recurrence: "none" as const, source: "quote" as const,
  createdAt: "2026-08-10", isDemo: false,
};

const item: DayActionItem = {
  id: "item-1", category: "finance", relatedType: "finance_transaction", relatedId: "sft-1",
  title: "Recebível Nuvem", priority: "medium",
} as never;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useTasks).mockReturnValue({ updateTask: vi.fn() } as never);
  vi.mocked(useFinance).mockReturnValue({ updateTransactionStatus: vi.fn() } as never);
  vi.mocked(useBifurcatedFinance).mockReturnValue([cloudReceivable] as never);
  vi.mocked(useClientActivityLogs).mockReturnValue({ updateLog: vi.fn() } as never);
  vi.mocked(useAllClientActivityLogs).mockReturnValue([] as never);
  vi.mocked(useDayCenterResolvedActions).mockReturnValue({
    addAction: vi.fn(), todayCount: 0, todayActions: [],
  } as never);
});

describe("useDayCenterActions · guarda contra no-op silencioso em modo Supabase (§3.1 do desenho)", () => {
  it("canMarkPaid é false em modo Supabase, mesmo com a transação elegível", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "supabase");
    const { result } = renderHook(() => useDayCenterActions());

    expect(result.current.canMarkPaid(item)).toBe(false);
  });

  it("canMarkPaid é true em modo local com a mesma transação elegível (comportamento preservado)", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "local");
    const { result } = renderHook(() => useDayCenterActions());

    expect(result.current.canMarkPaid(item)).toBe(true);
  });

  it("markReceivablePaid em modo Supabase nunca chama updateTransactionStatus — toast explícito, não um no-op silencioso", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "supabase");
    const updateTransactionStatus = vi.fn();
    vi.mocked(useFinance).mockReturnValue({ updateTransactionStatus } as never);

    const { result } = renderHook(() => useDayCenterActions());
    act(() => result.current.markReceivablePaid(item));

    expect(updateTransactionStatus).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("modo Supabase"));
  });

  it("markReceivablePaid em modo local continua chamando updateTransactionStatus normalmente", () => {
    localStorage.setItem(FINANCE_DATA_SOURCE_KEY, "local");
    const updateTransactionStatus = vi.fn();
    vi.mocked(useFinance).mockReturnValue({ updateTransactionStatus } as never);

    const { result } = renderHook(() => useDayCenterActions());
    act(() => result.current.markReceivablePaid(item));

    expect(updateTransactionStatus).toHaveBeenCalledWith("sft-1", "paid");
  });
});
