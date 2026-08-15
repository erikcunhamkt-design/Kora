// G53 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §3.5) — G30 em
// useSupabaseProjectTasks.updateStatus. Mesmo molde de
// useSupabaseProjects.test.ts (Flip Projetos, Fase D, Caso 2): updateMutation
// só fazia invalidate() e esperava um refetch pra atualizar o cache — um GET
// subsequente (listTasksByProject) que enxergue a escrita com QUALQUER lag
// (réplica, cache do PostgREST, timing de rede) reverte o cache pro valor
// antigo até o próximo refetch. Fix: usar a própria linha devolvida pelo
// UPDATE (`.select().single()`, já confirmada pelo banco) pra escrever o
// cache direto — nunca depende do refetch pra refletir a própria escrita.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseProjectTasks } from "@/hooks/useSupabaseProjectTasks";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { tasksRepository, type SupabaseTask } from "@/repositories/tasksRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/tasksRepository", () => ({
  tasksRepository: { listTasksByProject: vi.fn(), updateTaskStatus: vi.fn() },
}));

function baseRow(overrides: Partial<SupabaseTask> = {}): SupabaseTask {
  return {
    id: "st-1", workspace_id: "ws1", project_id: "pj-1", title: "Tarefa Nuvem",
    status: "a_fazer", priority: "média", source: "manual", sort_order: 0,
    is_demo: false, archived: false,
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
});

describe("useSupabaseProjectTasks · G30 — updateStatus escreve o cache com a resposta do próprio UPDATE", () => {
  it("tasks reflete o status novo mesmo se um refetch subsequente ainda devolver a linha antiga (lag de leitura)", async () => {
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([baseRow()]);
    vi.mocked(tasksRepository.updateTaskStatus).mockResolvedValue(baseRow({ status: "concluido" }));

    const { result } = renderHook(() => useSupabaseProjectTasks("pj-1"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks[0].status).toBe("a_fazer");

    await act(async () => {
      await result.current.updateStatus("st-1", "concluido");
    });

    // listTasksByProject nunca foi re-chamado pra confirmar o novo status —
    // a UI usa a resposta do próprio UPDATE, não um refetch.
    expect(tasksRepository.listTasksByProject).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.tasks[0].status).toBe("concluido"));
  });

  it("updateStatus preserva as demais linhas do cache — só substitui a que mudou", async () => {
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([
      baseRow({ id: "st-1", title: "A" }),
      baseRow({ id: "st-2", title: "B" }),
    ]);
    vi.mocked(tasksRepository.updateTaskStatus).mockResolvedValue(
      baseRow({ id: "st-1", title: "A", status: "revisao" }),
    );

    const { result } = renderHook(() => useSupabaseProjectTasks("pj-1"), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateStatus("st-1", "revisao");
    });

    await waitFor(() => expect(result.current.tasks.find((t) => t.id === "st-1")?.status).toBe("revisao"));
    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks.find((t) => t.id === "st-2")?.status).toBe("a_fazer");
  });

  it("workspace ausente rejeita antes de chamar o repository (guarda existente, comportamento preservado)", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: false, error: null,
    } as never);

    const { result } = renderHook(() => useSupabaseProjectTasks("pj-1"), { wrapper });

    await expect(result.current.updateStatus("st-1", "concluido")).rejects.toThrow("Workspace ativo ausente");
    expect(tasksRepository.updateTaskStatus).not.toHaveBeenCalled();
  });
});
