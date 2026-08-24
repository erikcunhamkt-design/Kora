// G53/B3 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md`
// §7) — prova o hook compartilhado pelos consumidores. Mocka
// useTasks/useSupabaseTasksAll diretamente (já testados isoladamente em
// seus próprios arquivos) — este teste prova só a escolha de fonte, mesmo
// escopo de useBifurcatedFinance.test.ts.
//
// Fase C do Pacote do Flip de Tarefas — `kora.tasks.dataSource.v1` default
// flipado pra "supabase" (só "local" explícito escolhe local), mesmo
// formato de `kora.finance.dataSource.v1` pós-flip. Describe "modo local"
// passou de "default" pra "explícito" — divergência DELIBERADA (ver
// relatório da rodada de flip): nenhum teste do default antigo fica pra
// trás passando por acidente.
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

describe("useBifurcatedTasks — modo local (explícito)", () => {
  it("\"local\" explícito devolve as tarefas locais", () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "local");
    vi.mocked(useTasks).mockReturnValue({ tasks: [makeLocalTask()] } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [makeCloudTask()] } as never);

    const { result } = renderHook(() => useBifurcatedTasks());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Local X");
  });
});

describe("useBifurcatedTasks — modo Supabase", () => {
  it("devolve as tarefas da nuvem quando o seletor nunca foi tocado (novo default, Fase C do flip)", () => {
    vi.mocked(useTasks).mockReturnValue({ tasks: [makeLocalTask()] } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [makeCloudTask()] } as never);

    const { result } = renderHook(() => useBifurcatedTasks());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Nuvem X");
  });

  it("devolve as tarefas já mapeadas de useSupabaseTasksAll quando o seletor está em \"supabase\" (explícito)", () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    vi.mocked(useTasks).mockReturnValue({ tasks: [makeLocalTask()] } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [makeCloudTask()] } as never);

    const { result } = renderHook(() => useBifurcatedTasks());

    expect(result.current).toHaveLength(1);
    expect(result.current[0].title).toBe("Nuvem X");
  });
});
