// Caso 7.2 (homologação de Tarefas) — cutover total do "Gerar projeto" em
// modo Supabase: projeto E starter tasks vão direto pra nuvem (nunca mais
// local+espelho pras tasks, que nunca tiveram espelho nenhum e ficavam
// invisíveis assim que Tarefas.tsx passasse a ler da nuvem). G37: mesmo
// payload que o modo local já mandava, só trocando addTask/addProject
// (local) por createSupabaseTask/createSupabaseProject (nativo).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { QuoteToProjectDialog } from "@/components/vendas/QuoteToProjectDialog";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PROJECTS_DATA_SOURCE_KEY, TASKS_DATA_SOURCE_KEY } from "@/config/flags";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { useSupabaseTasksWriteFlag } from "@/hooks/useSupabaseTasksWriteFlag";
import { tasksRepository } from "@/repositories/tasksRepository";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import type { Quote } from "@/hooks/useQuotes";
import { toast } from "sonner";

vi.mock("@/hooks/useProjects", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProjects")>("@/hooks/useProjects");
  return { ...actual, useProjects: vi.fn() };
});
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn(), formatPtBr: (iso: string) => iso }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/services/projects/projectsCloudMirror", () => ({ mirrorProjectToSupabase: vi.fn() }));
vi.mock("@/hooks/useSupabaseProjects", () => ({ useSupabaseProjects: vi.fn() }));
vi.mock("@/hooks/useSupabaseTasksAll", () => ({ useSupabaseTasksAll: vi.fn() }));
vi.mock("@/hooks/useSupabaseTasksWriteFlag", () => ({ useSupabaseTasksWriteFlag: vi.fn() }));
vi.mock("@/repositories/tasksRepository", () => ({ tasksRepository: { listTasksByProject: vi.fn() } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-uuid-1", clientName: "Acme Corp", clientEmail: "", clientWhatsapp: "",
    title: "Website institucional", description: "", items: [],
    subtotal: 1000, discount: 0, total: 1000, paymentCondition: "",
    deliveryDeadline: "", validityDays: 15, status: "aprovado",
    createdAt: "2026-07-01", clientId: "client-uuid-1" as never,
    ...overrides,
  };
}

const CREATED_ROW = {
  id: "project-uuid-created",
  workspace_id: "ws1",
  title: "Projeto — Website institucional",
  status: "planning",
  client_id: "client-uuid-1",
  quote_id: "quote-uuid-1",
  is_demo: false,
  archived: false,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
};

function setupSupabaseProjects(createProject = vi.fn().mockResolvedValue(CREATED_ROW)) {
  vi.mocked(useSupabaseProjects).mockReturnValue({ createProject } as never);
  return createProject;
}

function setupSupabaseTasks(createTask = vi.fn().mockResolvedValue({ id: "task-uuid" })) {
  vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask } as never);
  return createTask;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "supabase");
  localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(useSupabaseTasksWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() } as never);
  vi.mocked(useProjects).mockReturnValue({ addProject: vi.fn() } as never);
  vi.mocked(useTasks).mockReturnValue({ addTask: vi.fn() } as never);
  vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([]);
  setupSupabaseProjects();
  setupSupabaseTasks();
});

function renderDialog(quote: Quote) {
  return render(
    <QuoteToProjectDialog quote={quote} open onOpenChange={() => {}} onGenerated={() => {}} />,
  );
}

describe("QuoteToProjectDialog · cutover (Caso 7.2) — modo Supabase, projeto nativo", () => {
  it("cria o projeto via createSupabaseProject (nativo) — NUNCA addProject local nem espelho", async () => {
    const createProject = setupSupabaseProjects();
    const addProject = vi.fn();
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createProject).toHaveBeenCalled());
    expect(addProject).not.toHaveBeenCalled();
    expect(mirrorProjectToSupabase).not.toHaveBeenCalled();
  });

  it("G37: payload do projeto nativo carrega clientId/quoteId/opportunityId da quote", async () => {
    const createProject = setupSupabaseProjects();
    renderDialog(makeQuote({ opportunityId: "opp-uuid-1" as never }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-uuid-1",
        quoteId: "quote-uuid-1",
        opportunityId: "opp-uuid-1",
        source: "orçamento",
      }),
    ));
  });
});

describe("QuoteToProjectDialog · cutover (Caso 7.2) — starter tasks nativas, projectId real", () => {
  it("as 4 starter tasks vão via createSupabaseTask (nativo), vinculadas ao uuid REAL do projeto criado", async () => {
    const createTask = setupSupabaseTasks();
    const addTask = vi.fn();
    vi.mocked(useTasks).mockReturnValue({ addTask } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
    expect(addTask).not.toHaveBeenCalled();
    createTask.mock.calls.forEach(([task]) => {
      expect(task.projectId).toBe("project-uuid-created"); // uuid REAL, não posicional
    });
  });

  it("vocabulário (G40/G49): status/priority saem nos literais oficiais do banco — a_fazer/média, sem tradução", async () => {
    const createTask = setupSupabaseTasks();
    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
    createTask.mock.calls.forEach(([task]) => {
      expect(task.status).toBe("a_fazer");
      expect(task.priority).toBe("média");
    });
  });

  it("source: 'projeto' (nunca 'project_template') — evita colisão com a checagem de duplicidade do CreateProjectBaseTasksDialog", async () => {
    const createTask = setupSupabaseTasks();
    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
    createTask.mock.calls.forEach(([task]) => {
      expect(task.source).toBe("projeto");
      expect(task.source).not.toBe("project_template");
    });
  });

  it("item com nome de orçamento gera a 5ª tarefa 'Iniciar entrega: <item>', também nativa", async () => {
    const createTask = setupSupabaseTasks();
    renderDialog(makeQuote({ items: [{ name: "Landing page", quantity: 1, unitPrice: 500, total: 500 }] as never }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(5));
    expect(createTask.mock.calls.some(([t]) => t.title === "Iniciar entrega: Landing page")).toBe(true);
  });

  it("switch 'Criar tarefas iniciais' desligado — zero chamada a createSupabaseTask", async () => {
    const createTask = setupSupabaseTasks();
    renderDialog(makeQuote());
    // Ordem no JSX: [0] "Criar marcos a partir dos itens" (createDeliverables),
    // [1] "Criar tarefas iniciais" (createTasks) — o switch que este teste liga/desliga.
    fireEvent.click(screen.getAllByRole("switch")[1]);
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(useSupabaseProjects).toHaveBeenCalled());
    expect(createTask).not.toHaveBeenCalled();
  });
});

describe("QuoteToProjectDialog · cutover (Caso 7.2) — falhas", () => {
  it("falha ao criar o projeto na nuvem: toast de erro explícito, NENHUMA task é criada, dialog não fecha (onGenerated não dispara)", async () => {
    const createProject = setupSupabaseProjects(vi.fn().mockRejectedValue({ message: "network down" }));
    const createTask = setupSupabaseTasks();
    const onGenerated = vi.fn();

    render(<QuoteToProjectDialog quote={makeQuote()} open onOpenChange={() => {}} onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createProject).toHaveBeenCalled());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
      "Falha ao criar projeto no Supabase",
      expect.anything(),
    ));
    expect(createTask).not.toHaveBeenCalled();
    expect(onGenerated).not.toHaveBeenCalled();
  });

  it("projeto criado, mas 1 de 4 starter tasks falha: warning explícito com contagem, projeto ainda é considerado criado", async () => {
    let call = 0;
    const createTask = vi.fn().mockImplementation(() => {
      call += 1;
      return call === 2 ? Promise.reject({ message: "boom" }) : Promise.resolve({ id: `task-${call}` });
    });
    setupSupabaseTasks(createTask);
    const onGenerated = vi.fn();

    render(<QuoteToProjectDialog quote={makeQuote()} open onOpenChange={() => {}} onGenerated={onGenerated} />);
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("1 de 4 tarefas iniciais falharam"),
    ));
    expect(onGenerated).toHaveBeenCalled(); // projeto em si foi criado com sucesso
  });
});

describe("QuoteToProjectDialog · cutover (Caso 7.2) — tasksWriteEnabled desligado (flag isolado)", () => {
  it("projeto nativo (cloudMode), mas flag de escrita de tasks OFF: starter tasks caem pro caminho LOCAL, com o uuid real do projeto", async () => {
    vi.mocked(useSupabaseTasksWriteFlag).mockReturnValue({ enabled: false, setEnabled: vi.fn(), toggle: vi.fn() } as never);
    const createTask = setupSupabaseTasks();
    const addTask = vi.fn();
    vi.mocked(useTasks).mockReturnValue({ addTask } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(addTask).toHaveBeenCalledTimes(4));
    expect(createTask).not.toHaveBeenCalled();
    addTask.mock.calls.forEach(([task]) => {
      expect(task.projectId).toBe("project-uuid-created");
    });
  });
});

describe('QuoteToProjectDialog · G90 — repetir "Gerar projeto" não duplica as starter tasks', () => {
  it("1ª chamada (listTasksByProject vazio — projeto novo, sem starter tasks ainda): cria as 4 normalmente", async () => {
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([]);
    const createTask = setupSupabaseTasks();

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(tasksRepository.listTasksByProject).toHaveBeenCalledWith("ws1", "project-uuid-created"));
    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
  });

  it("2ª chamada pro mesmo orçamento (projeto idempotente já tem tarefa com source='projeto'): NÃO duplica, avisa no toast", async () => {
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([
      { id: "t1", source: "projeto" } as never,
    ]);
    const createTask = setupSupabaseTasks();

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(tasksRepository.listTasksByProject).toHaveBeenCalled());
    expect(createTask).not.toHaveBeenCalled();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("já existia"),
      expect.anything(),
    ));
  });

  it("tarefas existentes de outra origem (source='project_template', do CreateProjectBaseTasksDialog) NÃO bloqueiam — vocabulário disjunto, ainda cria as 4 starter tasks", async () => {
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([
      { id: "t1", source: "project_template" } as never,
    ]);
    const createTask = setupSupabaseTasks();

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
  });

  it("starter tasks de uma rodada anterior foram excluídas (soft-delete — listTasksByProject já filtra deleted_at e devolve vazio): recria normalmente, não fica travado em 'já existe'", async () => {
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([]);
    const createTask = setupSupabaseTasks();

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(4));
    expect(toast.success).not.toHaveBeenCalledWith(expect.stringContaining("já existia"), expect.anything());
  });
});
