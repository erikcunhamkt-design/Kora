// Etapa 5 · Pacote do Flip (projects) — Fase B, item 3. Primeiro teste
// dedicado do drawer — antes desta fatia, `blockWrite()` bloqueava toda
// escrita em modo Supabase; agora testa o CRUD real dos dois modos:
// (1) local — grava local + espelho best-effort (padrão G22, fatia N,
// inalterado); (2) supabase — grava DIRETO na nuvem via updateProject,
// com tradução de status correta (O12: archived vira texto neutro +
// boolean, nunca mais status="archived" cru).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import { ProjectDetailDrawer } from "@/components/projects/ProjectDetailDrawer";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useTasks } from "@/hooks/useTasks";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { TASKS_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseTasksWriteFlag";
import { TASKS_DATA_SOURCE_KEY } from "@/config/flags";
import { useClients } from "@/hooks/useClients";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PROJECTS_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseProjectsWriteFlag";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";

vi.mock("@/hooks/useProjects", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProjects")>("@/hooks/useProjects");
  return { ...actual, useProjects: vi.fn() };
});
vi.mock("@/hooks/useSupabaseProjects", () => ({ useSupabaseProjects: vi.fn() }));
vi.mock("@/hooks/useTasks", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks");
  return { ...actual, useTasks: vi.fn() };
});
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
vi.mock("@/hooks/useSupabaseTasksAll", () => ({ useSupabaseTasksAll: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/services/projects/projectsCloudMirror", () => ({ mirrorProjectToSupabase: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

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

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pj-1", name: "Rebranding Acme", clientName: "Acme Corp",
    status: "planning", priority: "medium", progress: 0, tags: [],
    createdAt: "2026-07-01", isDemo: false, source: "manual",
    ...overrides,
  };
}

function setupCommonMocks() {
  vi.mocked(useTasks).mockReturnValue({ addTask: vi.fn(), moveTask: vi.fn() } as never);
  vi.mocked(useBifurcatedTasks).mockReturnValue([] as never);
  vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask: vi.fn(), moveTask: vi.fn() } as never);
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setupCommonMocks();
});

async function openActionsMenu() {
  const trigger = screen.getByRole("button", { name: "Ações" });
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(trigger);
  return screen.findByText("Arquivar");
}

function renderDrawer(project: Project, dataSource: "local" | "supabase" = "local") {
  return render(
    <MemoryRouter>
      <ProjectDetailDrawer project={project} open onOpenChange={() => {}} dataSource={dataSource} />
    </MemoryRouter>,
  );
}

describe("ProjectDetailDrawer · modo local (padrão G22, inalterado)", () => {
  it("handleStatus grava local E tenta o espelho quando o flag mestre está ON", async () => {
    const updateLocalProject = vi.fn();
    vi.mocked(useProjects).mockReturnValue({ updateProject: updateLocalProject } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(mirrorProjectToSupabase).mockResolvedValue({ id: "cloud-uuid" } as never);
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");

    const project = makeProject();
    renderDrawer(project, "local");
    await openActionsMenu();
    fireEvent.click(screen.getByText("Arquivar"));

    expect(updateLocalProject).toHaveBeenCalledWith("pj-1", { status: "archived" });
    await waitFor(() => expect(mirrorProjectToSupabase).toHaveBeenCalledWith(
      "ws1", expect.objectContaining({ status: "archived" }),
    ));
  });

  it("flag mestre OFF (override explícito, Pacote do Flip virou opt-out) — grava local, NUNCA chama o espelho", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    const updateLocalProject = vi.fn();
    vi.mocked(useProjects).mockReturnValue({ updateProject: updateLocalProject } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);

    renderDrawer(makeProject(), "local");
    await openActionsMenu();
    fireEvent.click(screen.getByText("Arquivar"));

    expect(updateLocalProject).toHaveBeenCalled();
    expect(mirrorProjectToSupabase).not.toHaveBeenCalled();
  });
});

describe("ProjectDetailDrawer · modo Supabase — CRUD real (Pacote do Flip, Fase B)", () => {
  it("handleStatus('archived') chama updateProject direto na nuvem com O12 (status neutro + archived:true) — NUNCA updateProject local", async () => {
    const updateLocalProject = vi.fn();
    const updateSupabaseProject = vi.fn().mockResolvedValue({ id: "pj-1" });
    vi.mocked(useProjects).mockReturnValue({ updateProject: updateLocalProject } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: updateSupabaseProject } as never);

    renderDrawer(makeProject(), "supabase");
    await openActionsMenu();
    fireEvent.click(screen.getByText("Arquivar"));

    await waitFor(() => expect(updateSupabaseProject).toHaveBeenCalledWith(
      "pj-1", { status: "planning", archived: true },
    ));
    expect(updateLocalProject).not.toHaveBeenCalled();
    expect(mirrorProjectToSupabase).not.toHaveBeenCalled();
  });

  it("handleStatus('in_progress') — status conhecido passa direto, archived:false", async () => {
    const updateSupabaseProject = vi.fn().mockResolvedValue({ id: "pj-1" });
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: updateSupabaseProject } as never);

    renderDrawer(makeProject({ status: "planning" }), "supabase");
    await openActionsMenu();
    fireEvent.click(screen.getByText("Iniciar projeto"));

    await waitFor(() => expect(updateSupabaseProject).toHaveBeenCalledWith(
      "pj-1", { status: "in_progress", archived: false },
    ));
  });

  it("falha ao salvar na nuvem vira toast de erro explícito — nunca um sucesso falso", async () => {
    const updateSupabaseProject = vi.fn().mockRejectedValue(new Error("network down"));
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: updateSupabaseProject } as never);

    renderDrawer(makeProject(), "supabase");
    await openActionsMenu();
    fireEvent.click(screen.getByText("Arquivar"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Falha ao salvar no Supabase"),
    ));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("setDeliverableStatus (checklist) grava direto na nuvem, sem campo progress (não existe coluna)", async () => {
    const updateSupabaseProject = vi.fn().mockResolvedValue({ id: "pj-1" });
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: updateSupabaseProject } as never);

    const project = makeProject({
      deliverables: [{ id: "d1", title: "Etapa 1", status: "pendente" }],
    });
    renderDrawer(project, "supabase");

    fireEvent.click(screen.getByLabelText("Concluir entregável"));

    await waitFor(() => expect(updateSupabaseProject).toHaveBeenCalledWith(
      "pj-1",
      { deliverables: [{ id: "d1", title: "Etapa 1", status: "concluido" }] },
    ));
    const [, patch] = updateSupabaseProject.mock.calls[0];
    expect(patch).not.toHaveProperty("progress");
  });
});

describe("ProjectDetailDrawer · B4 — tarefas leem via useBifurcatedTasks (etapa-5-flip-tarefas-pacote.md §7)", () => {
  it("tarefa só-nuvem (useBifurcatedTasks, ausente de useTasks local) vinculada ao projeto aparece na lista", async () => {
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      { id: "cloud-task-uuid", title: "Tarefa só-nuvem", projectId: "pj-1", archived: false, status: "a_fazer", priority: "média" },
    ] as never);

    renderDrawer(makeProject());

    expect(await screen.findByText("Tarefa só-nuvem")).toBeInTheDocument();
  });

  it("regressão: tarefa local continua aparecendo normalmente", async () => {
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      { id: 42, title: "Tarefa local", projectId: "pj-1", archived: false, status: "a_fazer", priority: "média" },
    ] as never);

    renderDrawer(makeProject());

    expect(await screen.findByText("Tarefa local")).toBeInTheDocument();
  });
});

describe("ProjectDetailDrawer · cutover de escrita de Tarefas (getTasksDataSource + flag nativa, mesmo gate de Tarefas.tsx/G77)", () => {
  async function createTaskViaForm(title: string) {
    fireEvent.click(screen.getByText("Nova tarefa"));
    fireEvent.change(screen.getByPlaceholderText("Título da tarefa"), { target: { value: title } });
    fireEvent.click(screen.getByText("Criar"));
  }

  it("modo Supabase + flag de escrita ligada — criar tarefa vai pro caminho nativo (createTask), NUNCA addTaskLocal", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "true");
    const addTaskLocal = vi.fn();
    const createSupabaseTask = vi.fn().mockResolvedValue({ id: "cloud-task-uuid" });
    vi.mocked(useTasks).mockReturnValue({ addTask: addTaskLocal, moveTask: vi.fn() } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask: createSupabaseTask, moveTask: vi.fn() } as never);
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);

    renderDrawer(makeProject({ id: "pj-1", clientId: 1, quoteId: "q-1" }));
    await createTaskViaForm("Tarefa nova");

    await waitFor(() => expect(createSupabaseTask).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Tarefa nova", projectId: "pj-1", clientId: 1, quoteId: "q-1", source: "projeto",
      }),
    ));
    expect(addTaskLocal).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefa criada"));
  });

  it("modo Supabase + flag de escrita ligada — concluir/reabrir tarefa vai pro caminho nativo (moveTask, id como string — G67), NUNCA moveTaskLocal", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "true");
    const moveTaskLocal = vi.fn();
    const moveSupabaseTask = vi.fn().mockResolvedValue({ id: "cloud-task-uuid" });
    vi.mocked(useTasks).mockReturnValue({ addTask: vi.fn(), moveTask: moveTaskLocal } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask: vi.fn(), moveTask: moveSupabaseTask } as never);
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      { id: "cloud-task-uuid", title: "Tarefa só-nuvem", projectId: "pj-1", archived: false, status: "a_fazer", priority: "média" },
    ] as never);

    renderDrawer(makeProject());
    fireEvent.click(screen.getByLabelText("Concluir tarefa"));

    await waitFor(() => expect(moveSupabaseTask).toHaveBeenCalledWith("cloud-task-uuid", "concluido"));
    expect(moveTaskLocal).not.toHaveBeenCalled();
  });

  it("modo local (dataSource de Tarefas = local, explícito) — regressão: criar/concluir continuam locais, nunca o caminho nativo", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "local");
    const addTaskLocal = vi.fn();
    const moveTaskLocal = vi.fn();
    const createSupabaseTask = vi.fn();
    const moveSupabaseTask = vi.fn();
    vi.mocked(useTasks).mockReturnValue({ addTask: addTaskLocal, moveTask: moveTaskLocal } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask: createSupabaseTask, moveTask: moveSupabaseTask } as never);
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      { id: 42, title: "Tarefa local", projectId: "pj-1", archived: false, status: "a_fazer", priority: "média" },
    ] as never);

    renderDrawer(makeProject());
    fireEvent.click(screen.getByLabelText("Concluir tarefa"));
    await waitFor(() => expect(moveTaskLocal).toHaveBeenCalledWith(42, "concluido"));
    expect(moveSupabaseTask).not.toHaveBeenCalled();

    await createTaskViaForm("Local nova");
    await waitFor(() => expect(addTaskLocal).toHaveBeenCalledWith(expect.objectContaining({ title: "Local nova" })));
    expect(createSupabaseTask).not.toHaveBeenCalled();
  });

  it("modo Supabase + flag de escrita DESLIGADA — bloqueio honesto (G76): nunca chama nativo nem local, toast de erro explícito", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "false");
    const addTaskLocal = vi.fn();
    const createSupabaseTask = vi.fn();
    const moveTaskLocal = vi.fn();
    const moveSupabaseTask = vi.fn();
    vi.mocked(useTasks).mockReturnValue({ addTask: addTaskLocal, moveTask: moveTaskLocal } as never);
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask: createSupabaseTask, moveTask: moveSupabaseTask } as never);
    vi.mocked(useProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ updateProject: vi.fn() } as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      { id: "cloud-task-uuid", title: "Tarefa só-nuvem", projectId: "pj-1", archived: false, status: "a_fazer", priority: "média" },
    ] as never);

    renderDrawer(makeProject());
    fireEvent.click(screen.getByLabelText("Concluir tarefa"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("modo Supabase")));
    expect(moveSupabaseTask).not.toHaveBeenCalled();
    expect(moveTaskLocal).not.toHaveBeenCalled();

    vi.mocked(toast.error).mockClear();
    await createTaskViaForm("Bloqueada");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Criar tarefa aqui")));
    expect(createSupabaseTask).not.toHaveBeenCalled();
    expect(addTaskLocal).not.toHaveBeenCalled();
  });
});
