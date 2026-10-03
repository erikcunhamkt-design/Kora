// Etapa 5 · Flip Projetos — Fase D (Caso 2, G30). Primeiro teste dedicado do
// hook (antes desta fatia, useSupabaseProjects.ts não tinha teste próprio —
// só era exercitado indiretamente via mocks em ProjectsSection.test.tsx e
// ProjectDetailDrawer.test.tsx, que substituem o hook inteiro e por isso
// nunca exercitam a integração real com o React Query).
//
// G30 — causa raiz: updateMutation só fazia invalidate() e esperava um
// refetch pra atualizar o cache. Um GET subsequente (listProjects) que
// enxergue a escrita com QUALQUER lag (réplica, cache do PostgREST, timing
// de rede) reverte o cache pro valor antigo até o próximo refetch — o drawer
// aberto (ProjectDetailDrawer.tsx, deriva o `project` exibido do cache vivo
// via ProjectsSection.tsx) fica preso mostrando o status velho, mesmo com o
// banco já gravado. Fix: usar a própria linha devolvida pelo UPDATE
// (`.select().single()`, já confirmada pelo banco) pra escrever o cache
// direto — nunca depende do refetch pra refletir a própria escrita.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository, type SupabaseProject } from "@/repositories/projectsRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/projectsRepository", () => ({
  projectsRepository: { listProjects: vi.fn(), updateProject: vi.fn(), importProject: vi.fn() },
}));

function baseRow(overrides: Partial<SupabaseProject> = {}): SupabaseProject {
  return {
    id: "sp-1", workspace_id: "ws1", title: "Projeto Nuvem", status: "planning",
    is_demo: false, archived: false,
    created_at: "2026-07-20T00:00:00Z", updated_at: "2026-07-20T00:00:00Z",
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

describe("useSupabaseProjects · G30 — updateProject escreve o cache com a resposta do próprio UPDATE", () => {
  it("projects reflete o status novo mesmo se um refetch subsequente ainda devolver a linha antiga (lag de leitura)", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([baseRow()]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue(baseRow({ status: "in_progress" }));

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projects[0].status).toBe("planning");

    await act(async () => {
      await result.current.updateProject("sp-1", { status: "in_progress", archived: false });
    });

    // listProjects nunca foi re-chamado pra confirmar o novo status — a UI
    // usa a resposta do próprio UPDATE, não um refetch.
    expect(projectsRepository.listProjects).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.projects[0].status).toBe("in_progress"));
  });

  it("updateProject preserva as demais linhas do cache — só substitui a que mudou", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([
      baseRow({ id: "sp-1", title: "A" }),
      baseRow({ id: "sp-2", title: "B" }),
    ]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue(
      baseRow({ id: "sp-1", title: "A", status: "delivered" }),
    );

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("sp-1", { status: "delivered" });
    });

    await waitFor(() => expect(result.current.projects.find((p) => p.id === "sp-1")?.status).toBe("delivered"));
    expect(result.current.projects).toHaveLength(2);
    expect(result.current.projects.find((p) => p.id === "sp-2")?.status).toBe("planning");
  });
});

// G60 (docs/architecture/kora-hub-auditoria-e-plano.md) — o fix original de
// G30 (Fase D, Caso 2) só corrigiu updateMutation; createMutation, no mesmo
// arquivo, manteve o padrão invalidate-only. Mesmo sintoma da classe G30
// (cache preso na leitura antiga até o próximo refetch), agora em "criar"
// em vez de "editar".
describe("useSupabaseProjects · G30 (G60) — createProject escreve o cache com a resposta do próprio INSERT", () => {
  const newProjectInput = {
    name: "Projeto Novo", clientName: "Cliente X", status: "planning" as const,
    priority: "medium" as const, progress: 0, tags: [],
  };

  it("projects reflete o projeto criado mesmo sem nenhum refetch subsequente", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([baseRow({ id: "sp-1" })]);
    vi.mocked(projectsRepository.importProject).mockResolvedValue(
      baseRow({ id: "sp-2", title: "Projeto Novo" }),
    );

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projects).toHaveLength(1);

    await act(async () => {
      await result.current.createProject(newProjectInput);
    });

    // listProjects nunca foi re-chamado pra confirmar a criação — a UI usa a
    // resposta do próprio INSERT, não um refetch.
    expect(projectsRepository.listProjects).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.projects.map((p) => p.id)).toContain("sp-2"));
    expect(result.current.projects).toHaveLength(2);
  });

  it("projeto criado aparece primeiro na lista (mais recente primeiro, mesmo molde de useSupabaseFinanceTransactions)", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([baseRow({ id: "sp-1" })]);
    vi.mocked(projectsRepository.importProject).mockResolvedValue(baseRow({ id: "sp-2" }));

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.createProject(newProjectInput);
    });

    await waitFor(() => expect(result.current.projects[0]?.id).toBe("sp-2"));
  });
});

// §8-b — ProjectDetailDrawer.tsx:179-183 (handleStatus) monta o patch só com
// {status, archived} (translateLocalProjectStatusToCloud) — nunca passa por
// mapLocalProjectToSupabase, o único produtor de projects que não passava.
// Sem esta injeção no wrapper de updateProject, mudar o status pra
// "delivered" em modo Supabase nativo nunca gravaria completed_at, mesmo
// com a coluna existindo.
describe("useSupabaseProjects · §8-b — updateProject injeta completed_at ao entrar em 'delivered'", () => {
  it("projeto sem completed_at anterior: patch enviado ao repository ganha completed_at (now)", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([baseRow({ id: "sp-1" })]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue(
      baseRow({ id: "sp-1", status: "delivered", completed_at: "2026-08-20T00:00:00.000Z" }),
    );

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("sp-1", { status: "delivered" });
    });

    const [, , patch] = vi.mocked(projectsRepository.updateProject).mock.calls[0];
    expect(patch.status).toBe("delivered");
    expect(patch.completed_at).toEqual(expect.any(String));
  });

  it("projeto que JÁ tem completed_at: patch enviado NÃO sobrescreve (nunca reseta na 2ª entrega)", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([
      baseRow({ id: "sp-1", status: "delivered", completed_at: "2026-01-01T00:00:00.000Z" }),
    ]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue(
      baseRow({ id: "sp-1", status: "delivered", completed_at: "2026-01-01T00:00:00.000Z" }),
    );

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("sp-1", { status: "delivered" });
    });

    const [, , patch] = vi.mocked(projectsRepository.updateProject).mock.calls[0];
    expect(patch.completed_at).toBeUndefined();
  });

  it("regressão: sair de 'delivered' (ex.: voltar pra 'in_progress') NUNCA limpa completed_at — decisão de manter valor histórico", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([
      baseRow({ id: "sp-1", status: "delivered", completed_at: "2026-01-01T00:00:00.000Z" }),
    ]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue(
      baseRow({ id: "sp-1", status: "in_progress", completed_at: "2026-01-01T00:00:00.000Z" }),
    );

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("sp-1", { status: "in_progress" });
    });

    const [, , patch] = vi.mocked(projectsRepository.updateProject).mock.calls[0];
    expect(patch).not.toHaveProperty("completed_at");
  });

  it("caller pode sobrescrever completed_at explicitamente — a injeção nunca substitui um valor já presente no patch", async () => {
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([baseRow({ id: "sp-1" })]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue(
      baseRow({ id: "sp-1", status: "delivered", completed_at: "2020-01-01T00:00:00.000Z" }),
    );

    const { result } = renderHook(() => useSupabaseProjects(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.updateProject("sp-1", { status: "delivered", completed_at: "2020-01-01T00:00:00.000Z" });
    });

    const [, , patch] = vi.mocked(projectsRepository.updateProject).mock.calls[0];
    expect(patch.completed_at).toBe("2020-01-01T00:00:00.000Z");
  });
});
