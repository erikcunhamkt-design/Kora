// Etapa 5 · Flip Projetos — Fase D (Caso 2, G30). Teste de integração ponta
// a ponta (ProjectsSection real + ProjectDetailDrawer real + useSupabaseProjects
// real, só a camada de repository é mockada) — os outros testes de
// ProjectsSection.test.tsx e ProjectDetailDrawer.test.tsx mockam
// useSupabaseProjects por inteiro, então nunca exercitam a integração real
// com o React Query e não pegariam esta classe de bug (ver G30 no catálogo,
// docs/architecture/kora-hub-auditoria-e-plano.md).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ProjectsSection } from "@/components/projetos/ProjectsSection";
import { useProjects } from "@/hooks/useProjects";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { projectsRepository } from "@/repositories/projectsRepository";

vi.mock("@/hooks/useProjects", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProjects")>("@/hooks/useProjects");
  return { ...actual, useProjects: vi.fn() };
});
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/repositories/projectsRepository", () => ({
  projectsRepository: { listProjects: vi.fn(), updateProject: vi.fn() },
}));

function baseRow() {
  return {
    id: "sp-1", workspace_id: "ws1", title: "Projeto Nuvem", status: "planning",
    client_id: null, is_demo: false, archived: false,
    created_at: "2026-07-20T00:00:00Z", updated_at: "2026-07-20T00:00:00Z",
    deliverables: [],
  };
}

if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfill de teste, jsdom não implementa PointerEvent.
  window.PointerEvent = PointerEventPolyfill;
}
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useTasks).mockReturnValue({ tasks: [], addTask: vi.fn(), moveTask: vi.fn() } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(useProjects).mockReturnValue({ projects: [], addProject: vi.fn() } as never);
});

async function openActionsMenu() {
  const trigger = screen.getByRole("button", { name: "Ações" });
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(trigger);
  return screen.findByText("Arquivar");
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjectsSection />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProjectsSection + ProjectDetailDrawer · G30 — drawer aberto reflete a própria mutação em modo Supabase", () => {
  it("badge do drawer vira 'Em andamento' sem fechar/reabrir, mesmo se um refetch pós-invalidate ainda devolvesse a linha antiga", async () => {
    // listProjects SEMPRE devolve a linha velha (status "planning") — simula
    // qualquer lag entre o UPDATE confirmado e um GET subsequente enxergar o
    // resultado (réplica, cache do PostgREST, timing de rede). Se a UI só
    // confiasse no refetch (invalidate), reverteria pro status velho — é
    // exatamente o sintoma reportado (Fase D, Caso 1: banco em in_progress,
    // drawer preso em "Planejado" até fechar/reabrir).
    vi.mocked(projectsRepository.listProjects).mockResolvedValue([baseRow()]);
    vi.mocked(projectsRepository.updateProject).mockResolvedValue({ ...baseRow(), status: "in_progress" } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    const title = await screen.findByText("Projeto Nuvem");
    fireEvent.click(title.closest('[role="button"]') as HTMLElement);
    await screen.findAllByText("Projeto Nuvem");

    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(within(dialog).getByText("Planejado")).toBeInTheDocument();

    await openActionsMenu();
    fireEvent.click(screen.getByText("Iniciar projeto"));

    await waitFor(() => expect(projectsRepository.updateProject).toHaveBeenCalled());
    await waitFor(() => expect(within(dialog).getByText("Em andamento")).toBeInTheDocument());
    expect(within(dialog).queryByText("Planejado")).not.toBeInTheDocument();
  });
});
