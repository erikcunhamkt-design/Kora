// G53/B3 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md`
// §7) — prova o hook compartilhado pelos consumidores. Mocka
// useTasks/useSupabaseTasksAll diretamente (já testados isoladamente em
// seus próprios arquivos) — este teste prova só a escolha de fonte, mesmo
// escopo de useBifurcatedFinance.test.ts.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { TASKS_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useTasks", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks");
  return { ...actual, useTasks: vi.fn() };
});
vi.mock("@/hooks/useSupabaseTasksAll", () => ({ useSupabaseTasksAll: vi.fn() }));

function makeLocalTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1, title: "Local X", description: "", client: "", project: "",
    priority: "média", deadline: "", status: "a_fazer", createdAt: "2026-07-01",
    tags: [], subtasks: [], comments: [],
    ...overrides,
  };
}

function makeCloudTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 2, title: "Nuvem X", description: "", client: "", project: "",
    priority: "média", deadline: "", status: "a_fazer", createdAt: "2026-08-01",
    tags: [], subtasks: [], comments: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// Diferente de useBifurcatedFinance (Pacote do Flip já flipou o default pra
// "supabase"): kora.tasks.dataSource.v1 nasce PRÉ-flip, default "local" —
// só "supabase" explícito seleciona nuvem (P5 do protocolo).
describe("useBifurcatedTasks — modo local (default pré-flip)", () => {
  it("seletor nunca tocado (ausente) devolve as tarefas locais — mesmo comportamento de kora.finance.dataSource.v1 ANTES do Pacote do Flip flipar o default", () => {
    vi.mocked(useTasks).mockReturnValue({ tasks: [makeLocalTask()] } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [makeCloudTask()] } as never);

    const { result } = renderHook(() => useBifurcatedTasks());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Local X");
  });

  it("\"local\" explícito devolve as tarefas locais", () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "local");
    vi.mocked(useTasks).mockReturnValue({ tasks: [makeLocalTask()] } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [makeCloudTask()] } as never);

    const { result } = renderHook(() => useBifurcatedTasks());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Local X");
  });
});

describe("useBifurcatedTasks — modo Supabase (explícito)", () => {
  it("\"supabase\" explícito devolve as tarefas já mapeadas de useSupabaseTasksAll", () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useTasks).mockReturnValue({ tasks: [makeLocalTask()] } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [makeCloudTask()] } as never);

    const { result } = renderHook(() => useBifurcatedTasks());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Nuvem X");
  });
});
