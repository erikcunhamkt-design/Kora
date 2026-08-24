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
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { TASKS_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseTasksWriteFlag";
import { useClientActivityLogs, useAllClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { useDayCenterResolvedActions } from "@/hooks/useDayCenterResolvedActions";
import { FINANCE_DATA_SOURCE_KEY, TASKS_DATA_SOURCE_KEY } from "@/config/flags";
import { toast } from "sonner";
import type { DayActionItem } from "@/lib/dayCenter";

vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/hooks/useFinance", () => ({ useFinance: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useSupabaseTasksAll", () => ({ useSupabaseTasksAll: vi.fn() }));
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
  vi.mocked(useSupabaseTasksAll).mockReturnValue({ moveTask: vi.fn() } as never);
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

// Etapa 5 · Tarefas Fase B (Pacote do Flip, §7 B4, 22/ago/2026) — mesma
// classe de risco: useDayCenterData() passou a ler tasks via
// useBifurcatedTasks() nessa mesma rodada, então um item de tarefa aqui
// pode vir da nuvem (id uuid contrabandeado como number) enquanto
// updateTask segue o mutator LOCAL de useTasks(). Sem a guarda,
// updateTask(Number(uuid), ...) vira NaN, nenhuma tarefa local bate
// t.id !== NaN, o .map devolve o array intacto — nenhum erro, nenhum
// efeito, toast de sucesso mesmo assim (mesma classe do G67/G73).
const cloudTaskItem: DayActionItem = {
  id: "item-2", category: "task", relatedType: "task",
  relatedId: "11111111-1111-1111-1111-111111111111",
  title: "HOMOLOG-TAR-tarefa-nuvem", priority: "high",
} as never;

describe("useDayCenterActions · guarda contra no-op silencioso de completeTask em modo Supabase (§7 B4)", () => {
  it("completeTask em modo Supabase COM a flag de escrita OFF nunca chama updateTask nem moveTask — toast explícito, não um no-op silencioso", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "false");
    const updateTask = vi.fn();
    const moveTask = vi.fn();
    vi.mocked(useTasks).mockReturnValue({ updateTask } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ moveTask } as never);

    const { result } = renderHook(() => useDayCenterActions());
    await act(async () => { await result.current.completeTask(cloudTaskItem); });

    expect(updateTask).not.toHaveBeenCalled();
    expect(moveTask).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("modo Supabase"));
  });

  it("completeTask em modo local continua chamando updateTask normalmente (regressão)", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "local");
    const updateTask = vi.fn();
    vi.mocked(useTasks).mockReturnValue({ updateTask } as never);

    const localItem: DayActionItem = {
      id: "item-3", category: "task", relatedType: "task", relatedId: 42,
      title: "Tarefa local", priority: "high",
    } as never;

    const { result } = renderHook(() => useDayCenterActions());
    await act(async () => { await result.current.completeTask(localItem); });

    expect(updateTask).toHaveBeenCalledWith(42, { status: "concluido" });
  });
});

// Etapa 5 · Tarefas Fase C (G77, 23/ago/2026) — o guard do G76 vira gate
// FÓSSIL a partir do flip (default de dataSource passa a "supabase" pra
// QUALQUER sessão que nunca tocou o seletor). Fix: com a flag de escrita
// nativa (B5) ligada, completeTask passa a rotear pro moveTask NATIVO de
// useSupabaseTasksAll() — sem Number() no id, sem depender do mutator local.
describe("useDayCenterActions · caminho nativo quando dataSource=supabase + flag de escrita ligada (G77)", () => {
  it("completeTask chama moveTask NATIVO com String(id) e 'concluido' — não updateTask local", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "true");
    const updateTask = vi.fn();
    const moveTask = vi.fn().mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111", status: "concluido" });
    vi.mocked(useTasks).mockReturnValue({ updateTask } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ moveTask } as never);

    const { result } = renderHook(() => useDayCenterActions());
    await act(async () => { await result.current.completeTask(cloudTaskItem); });

    expect(moveTask).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111", "concluido");
    expect(updateTask).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Tarefa concluída");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("erro no moveTask nativo mostra toast de erro amigável, não trava em silêncio", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "true");
    const moveTask = vi.fn().mockRejectedValue(new Error("network down"));
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ moveTask } as never);

    const { result } = renderHook(() => useDayCenterActions());
    await act(async () => { await result.current.completeTask(cloudTaskItem); });

    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
