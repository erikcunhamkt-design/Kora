// B4 (etapa-5-flip-tarefas-pacote.md §7) — Tarefas.tsx passa a ler `tasks`
// via useBifurcatedTasks (escrita continua local, useTasks, nesta rodada).
// Cobre também o fix G67-classe do deep link `?task=<id>` (comparação por
// string, não Number() — o mesmo padrão já usado em CRM.tsx/QuotesSection.tsx).
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Tarefas from "@/pages/Tarefas";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useTaskProjects } from "@/hooks/useTaskProjects";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { usePlan } from "@/contexts/plan-context-value";

vi.mock("@/hooks/useTasks", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks");
  return { ...actual, useTasks: vi.fn() };
});
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
vi.mock("@/hooks/useTaskProjects", () => ({ useTaskProjects: vi.fn() }));
vi.mock("@/hooks/useTaskReminders", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTaskReminders")>("@/hooks/useTaskReminders");
  return { ...actual, useTaskReminders: vi.fn() };
});
vi.mock("@/contexts/plan-context-value", () => ({ usePlan: vi.fn() }));

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 1,
    title: "Tarefa",
    description: "",
    client: "",
    project: "",
    priority: "média",
    deadline: "",
    status: "a_fazer",
    createdAt: "2026-08-01T00:00:00.000Z",
    tags: [],
    subtasks: [],
    comments: [],
    ...overrides,
  };
}

const LOCAL_TASK_WRITES = {
  addTask: vi.fn(), updateTask: vi.fn(), moveTask: vi.fn(), toggleSubtask: vi.fn(),
  addSubtask: vi.fn(), duplicateTask: vi.fn(), archiveTask: vi.fn(), deleteTask: vi.fn(),
};

function setup(tasks: Task[], initialEntries: string[] = ["/tarefas"]) {
  vi.mocked(useTasks).mockReturnValue({ tasks, ...LOCAL_TASK_WRITES } as never);
  vi.mocked(useBifurcatedTasks).mockReturnValue(tasks as never);
  vi.mocked(useTaskProjects).mockReturnValue({
    projects: [], addProject: vi.fn(), renameProject: vi.fn(), archiveProject: vi.fn(), deleteProject: vi.fn(),
  } as never);
  vi.mocked(useTaskReminders).mockReturnValue({ permission: "default", requestPermission: vi.fn(), supported: false } as never);
  vi.mocked(usePlan).mockReturnValue({
    plan: "pro", isPro: true,
    limits: { maxClients: Infinity, maxProjects: Infinity, maxTasks: Infinity, maxLeads: Infinity },
    wouldExceed: () => false, showPaywall: vi.fn(),
    paywallOpen: false, paywallResource: "", closePaywall: vi.fn(),
    usage: { clients: 0, projects: 0, tasks: 0, leads: 0 }, setUsage: vi.fn(),
  } as never);

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Tarefas />
    </MemoryRouter>,
  );
}

describe("Tarefas · B4 — leitura via useBifurcatedTasks (etapa-5-flip-tarefas-pacote.md §7)", () => {
  it("tarefa só-nuvem (useBifurcatedTasks, ausente de useTasks local) aparece na visão 'Minhas tarefas'", async () => {
    // useTasks() (local) devolve lista vazia — a task só existe via
    // useBifurcatedTasks (equivalente a flag de fonte de dados = supabase).
    vi.mocked(useTasks).mockReturnValue({ tasks: [], ...LOCAL_TASK_WRITES } as never);
    vi.mocked(useBifurcatedTasks).mockReturnValue([
      makeTask({ id: "cloud-uuid-1" as unknown as number, title: "Tarefa só-nuvem" }),
    ] as never);
    vi.mocked(useTaskProjects).mockReturnValue({
      projects: [], addProject: vi.fn(), renameProject: vi.fn(), archiveProject: vi.fn(), deleteProject: vi.fn(),
    } as never);
    vi.mocked(useTaskReminders).mockReturnValue({ permission: "default", requestPermission: vi.fn(), supported: false } as never);
    vi.mocked(usePlan).mockReturnValue({
      plan: "pro", isPro: true,
      limits: { maxClients: Infinity, maxProjects: Infinity, maxTasks: Infinity, maxLeads: Infinity },
      wouldExceed: () => false, showPaywall: vi.fn(),
      paywallOpen: false, paywallResource: "", closePaywall: vi.fn(),
      usage: { clients: 0, projects: 0, tasks: 0, leads: 0 }, setUsage: vi.fn(),
    } as never);

    render(
      <MemoryRouter initialEntries={["/tarefas"]}>
        <Tarefas />
      </MemoryRouter>,
    );

    screen.getByRole("button", { name: /Minhas tarefas/i }).click();
    expect(await screen.findByText("Tarefa só-nuvem")).toBeInTheDocument();
  });

  it("deep link ?task=<uuid> (G67-classe) acha a tarefa por comparação de string, sem Number()", async () => {
    setup([
      makeTask({ id: "3fa85f64-5717-4562-b3fc-2c963f66afa6" as unknown as number, title: "Tarefa com id uuid" }),
    ], ["/tarefas?task=3fa85f64-5717-4562-b3fc-2c963f66afa6"]);

    // O deep link abre a Sheet de detalhe com o título da tarefa selecionada.
    expect(await screen.findByRole("heading", { name: "Tarefa com id uuid" })).toBeInTheDocument();
  });

  it("regressão modo local: deep link ?task=<id numérico> continua funcionando", async () => {
    setup([
      makeTask({ id: 42, title: "Tarefa numérica local" }),
    ], ["/tarefas?task=42"]);

    expect(await screen.findByRole("heading", { name: "Tarefa numérica local" })).toBeInTheDocument();
  });
});
