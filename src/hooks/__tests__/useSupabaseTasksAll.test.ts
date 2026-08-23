// G53/B2 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md`
// §3.4/§7) — hook de leitura real (React Query real, só o repository/
// useClientsDataSource mockados), mesmo padrão de
// useSupabaseFinanceTransactions.test.ts/useSupabaseProjects.test.tsx —
// exercita a integração real em vez de mockar o hook inteiro.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { tasksRepository } from "@/repositories/tasksRepository";
import type { SupabaseTask } from "@/repositories/tasksRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/repositories/tasksRepository", () => ({
  tasksRepository: {
    listTasks: vi.fn(),
    listTasksByProject: vi.fn(),
    createProjectBaseTasks: vi.fn(),
    updateTaskStatus: vi.fn(),
    updateTask: vi.fn(),
    softDeleteTask: vi.fn(),
    importTask: vi.fn(),
  },
}));

function makeRow(overrides: Partial<SupabaseTask> = {}): SupabaseTask {
  return {
    id: "st-1", workspace_id: "ws1", title: "Tarefa X", status: "a_fazer",
    priority: "média", source: "manual", sort_order: 0, is_demo: false, archived: false,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);
});

describe("useSupabaseTasksAll · leitura Supabase, read-only, todas as tarefas do workspace (G53/B2)", () => {
  it("[G32] sem workspace ativo, não dispara fetch nenhum (enabled: !!workspaceId)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: false, error: null,
    } as never);

    renderHook(() => useSupabaseTasksAll(), { wrapper });

    expect(tasksRepository.listTasks).not.toHaveBeenCalled();
  });

  it("carrega e mapeia todas as tarefas do workspace pro formato Task local (via mapSupabaseTaskToLocal)", async () => {
    vi.mocked(tasksRepository.listTasks).mockResolvedValue([
      makeRow({ id: "st-1", title: "Tarefa 1" }),
      makeRow({ id: "st-2", title: "Tarefa 2" }),
    ]);

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(tasksRepository.listTasks).toHaveBeenCalledWith("ws1");
    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks.map((t) => t.title)).toEqual(["Tarefa 1", "Tarefa 2"]);
  });

  it("resolve client via useClientsDataSource — mesmo padrão de clientNameById de finance/projects", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{ id: "client-uuid-1", name: "Acme Corp" }],
    } as never);
    vi.mocked(tasksRepository.listTasks).mockResolvedValue([
      makeRow({ client_id: "client-uuid-1" }),
    ]);

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks[0].client).toBe("Acme Corp");
  });

  it("erro do repository vira mensagem amigável, nunca quebra o hook", async () => {
    vi.mocked(tasksRepository.listTasks).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
    expect(result.current.tasks).toEqual([]);
  });
});

// B5 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §7) — escrita
// real. [G30] por desenho: create/update/move/delete escrevem a resposta da
// própria mutation direto no cache (`setQueryData`), nunca só
// `invalidateQueries` — mesmo molde de useSupabaseFinanceTransactions.ts.
describe("useSupabaseTasksAll · escrita nativa (B5) — G30 por desenho", () => {
  it("createTask usa importTask com source_local_id nativo e insere a linha no cache sem esperar refetch", async () => {
    vi.mocked(tasksRepository.listTasks).mockResolvedValue([]);
    const created = makeRow({ id: "st-novo", title: "Tarefa nova" });
    vi.mocked(tasksRepository.importTask).mockResolvedValue(created);

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createTask({
        title: "Tarefa nova", description: "", client: "", project: "",
        priority: "média", deadline: "", status: "a_fazer", tags: [], subtasks: [], comments: [],
      });
    });

    expect(tasksRepository.importTask).toHaveBeenCalledWith(
      "ws1", expect.stringContaining("native:"), expect.objectContaining({ title: "Tarefa nova" }),
    );
    // listTasks nunca foi re-chamado — a UI usa a resposta da própria
    // mutation, não um refetch (G30).
    expect(tasksRepository.listTasks).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.tasks.some((t) => String(t.id) === "st-novo")).toBe(true));
  });

  it("updateTask reflete o patch novo mesmo se um refetch subsequente ainda devolvesse a linha antiga (G30)", async () => {
    vi.mocked(tasksRepository.listTasks).mockResolvedValue([makeRow({ id: "st-1", priority: "baixa" })]);
    vi.mocked(tasksRepository.updateTask).mockResolvedValue(makeRow({ id: "st-1", priority: "alta" }));

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks[0].priority).toBe("baixa");

    await act(async () => {
      await result.current.updateTask("st-1", { priority: "alta" });
    });

    expect(tasksRepository.updateTask).toHaveBeenCalledWith("ws1", "st-1", { priority: "alta" });
    expect(tasksRepository.listTasks).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.tasks[0].priority).toBe("alta"));
  });

  it("moveTask (status) reflete o status novo via tasksRepository.updateTaskStatus, sem refetch (G30)", async () => {
    vi.mocked(tasksRepository.listTasks).mockResolvedValue([makeRow({ id: "st-1", status: "a_fazer" })]);
    vi.mocked(tasksRepository.updateTaskStatus).mockResolvedValue(makeRow({ id: "st-1", status: "concluido" }));

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks[0].status).toBe("a_fazer");

    await act(async () => {
      await result.current.moveTask("st-1", "concluido");
    });

    expect(tasksRepository.updateTaskStatus).toHaveBeenCalledWith("ws1", "st-1", "concluido");
    expect(tasksRepository.listTasks).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.tasks[0].status).toBe("concluido"));
  });

  it("deleteTask remove a linha do cache com a confirmação do próprio soft-delete", async () => {
    vi.mocked(tasksRepository.listTasks).mockResolvedValue([
      makeRow({ id: "st-1" }), makeRow({ id: "st-2" }),
    ]);
    vi.mocked(tasksRepository.softDeleteTask).mockResolvedValue(makeRow({ id: "st-1", deleted_at: "2026-08-22T12:00:00Z" }));

    const { result } = renderHook(() => useSupabaseTasksAll(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.deleteTask("st-1");
    });

    expect(tasksRepository.softDeleteTask).toHaveBeenCalledWith("ws1", "st-1");
    await waitFor(() => expect(result.current.tasks.map((t) => String(t.id))).toEqual(["st-2"]));
  });
});
