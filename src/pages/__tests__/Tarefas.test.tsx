// B4 (etapa-5-flip-tarefas-pacote.md §7) — Tarefas.tsx passa a ler `tasks`
// via useBifurcatedTasks (escrita continua local, useTasks, nesta rodada).
// Cobre também o fix G67-classe do deep link `?task=<id>` (comparação por
// string, não Number() — o mesmo padrão já usado em CRM.tsx/QuotesSection.tsx).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Tarefas from "@/pages/Tarefas";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { useSupabaseTasksWriteFlag } from "@/hooks/useSupabaseTasksWriteFlag";
import { useTaskProjects } from "@/hooks/useTaskProjects";
import { useTaskReminders } from "@/hooks/useTaskReminders";
import { usePlan } from "@/contexts/plan-context-value";
import { TASKS_DATA_SOURCE_KEY } from "@/config/flags";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

vi.mock("@/hooks/useTasks", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useTasks")>("@/hooks/useTasks");
  return { ...actual, useTasks: vi.fn() };
});
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
// B5 — Tarefas.tsx passa a chamar useSupabaseTasksAll() diretamente (pras
// mutations nativas) e useSupabaseTasksWriteFlag() (gate da flag de escrita).
// Sem mock, useSupabaseTasksAll() dispara useCurrentWorkspace() -> useAuth()
// e quebra por falta de AuthProvider na árvore de teste — mesma razão do
// mock de useClientsDataSource (G44)/useBifurcatedFinance (G69) em outros
// arquivos desta suíte.
vi.mock("@/hooks/useSupabaseTasksAll", () => ({ useSupabaseTasksAll: vi.fn() }));
vi.mock("@/hooks/useSupabaseTasksWriteFlag", () => ({ useSupabaseTasksWriteFlag: vi.fn() }));
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

// B5 — mutations nativas mockadas; devolvem Promise resolvida (mesmo
// contrato de useSupabaseTasksAll real, `mutateAsync`) — os wrappers de
// Tarefas.tsx chamam `.catch(...)` na resposta, que quebraria contra
// `undefined` sem isso. Testes desta suíte (B4) não exercitam escrita
// nativa, só leitura — default aqui garante que nenhuma delas seja chamada
// por acidente (describe "B5" abaixo é quem prova o caminho nuvem).
const SUPABASE_TASK_WRITES = {
  createTask: vi.fn().mockResolvedValue(undefined),
  updateTask: vi.fn().mockResolvedValue(undefined),
  moveTask: vi.fn().mockResolvedValue(undefined),
  deleteTask: vi.fn().mockResolvedValue(undefined),
};

function setup(tasks: Task[], initialEntries: string[] = ["/tarefas"], writeEnabled = false) {
  vi.mocked(useTasks).mockReturnValue({ tasks, ...LOCAL_TASK_WRITES } as never);
  vi.mocked(useBifurcatedTasks).mockReturnValue(tasks as never);
  vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [], loading: false, error: null, refresh: vi.fn(), ...SUPABASE_TASK_WRITES } as never);
  vi.mocked(useSupabaseTasksWriteFlag).mockReturnValue({ enabled: writeEnabled, setEnabled: vi.fn(), toggle: vi.fn() } as never);
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
    vi.mocked(useSupabaseTasksAll).mockReturnValue({ tasks: [], loading: false, error: null, refresh: vi.fn(), ...SUPABASE_TASK_WRITES } as never);
    vi.mocked(useSupabaseTasksWriteFlag).mockReturnValue({ enabled: false, setEnabled: vi.fn(), toggle: vi.fn() } as never);
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

// B5 (etapa-5-flip-tarefas-pacote.md §7) — escrita nativa em modo Supabase.
// dataSource lido de `kora.tasks.dataSource.v1` (TASKS_DATA_SOURCE_KEY),
// flag de escrita mockada via useSupabaseTasksWriteFlag — cloudWriteMode =
// dataSource==="supabase" && writeEnabled. addTask/updateTask/moveTask/
// deleteTask (nomes preservados, `Tarefas.tsx`) roteiam pra
// createTask/updateTask/moveTask/deleteTask de useSupabaseTasksAll quando
// cloudWriteMode está ligado; senão caem no addTask/updateTask/moveTask/
// deleteTask ORIGINAIS de useTasks (local), sem nenhuma mudança de
// comportamento.
describe("Tarefas · B5 — escrita nativa em modo Supabase (etapa-5-flip-tarefas-pacote.md §7)", () => {
  it("criar via captura rápida em modo nuvem (dataSource=supabase, flag ligada) chama createTask nativo, nunca addTask local", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    setup([], ["/tarefas"], true);

    const input = screen.getByPlaceholderText(/Adicionar tarefa/i);
    fireEvent.change(input, { target: { value: "Nova tarefa nuvem" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(SUPABASE_TASK_WRITES.createTask).toHaveBeenCalledTimes(1));
    expect(SUPABASE_TASK_WRITES.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Nova tarefa nuvem" }),
    );
    expect(LOCAL_TASK_WRITES.addTask).not.toHaveBeenCalled();
  });

  it("criar via captura rápida com a flag de escrita DESLIGADA (mesmo em modo Supabase) continua local, byte a byte", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    setup([], ["/tarefas"], false);

    const input = screen.getByPlaceholderText(/Adicionar tarefa/i);
    fireEvent.change(input, { target: { value: "Tarefa local" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(LOCAL_TASK_WRITES.addTask).toHaveBeenCalledTimes(1));
    expect(SUPABASE_TASK_WRITES.createTask).not.toHaveBeenCalled();
  });

  it("concluir tarefa (toggle) em modo nuvem chama moveTask nativo com String(id) + status cloud", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    setup([
      makeTask({ id: "cloud-uuid-9" as unknown as number, title: "Tarefa a concluir" }),
    ], ["/tarefas"], true);

    fireEvent.click(screen.getByRole("button", { name: /Minhas tarefas/i }));
    fireEvent.click(await screen.findByLabelText("Concluir"));

    await waitFor(() => expect(SUPABASE_TASK_WRITES.moveTask).toHaveBeenCalledWith("cloud-uuid-9", "concluido"));
    expect(LOCAL_TASK_WRITES.moveTask).not.toHaveBeenCalled();
  });

  it("concluir tarefa com a flag desligada continua chamando moveTask local — zero regressão", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    setup([
      makeTask({ id: 7, title: "Tarefa local a concluir" }),
    ], ["/tarefas"], false);

    fireEvent.click(screen.getByRole("button", { name: /Minhas tarefas/i }));
    fireEvent.click(await screen.findByLabelText("Concluir"));

    await waitFor(() => expect(LOCAL_TASK_WRITES.moveTask).toHaveBeenCalledWith(7, "concluido"));
    expect(SUPABASE_TASK_WRITES.moveTask).not.toHaveBeenCalled();
  });

  it("excluir tarefa (Sheet de detalhe + confirmação) em modo nuvem chama deleteTask nativo", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    setup([
      makeTask({ id: "cloud-uuid-5" as unknown as number, title: "Tarefa a excluir" }),
    ], ["/tarefas?task=cloud-uuid-5"], true);

    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const confirmButtons = await screen.findAllByRole("button", { name: "Excluir" });
    fireEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => expect(SUPABASE_TASK_WRITES.deleteTask).toHaveBeenCalledWith("cloud-uuid-5"));
    expect(LOCAL_TASK_WRITES.deleteTask).not.toHaveBeenCalled();
  });

  it("editar prazo (dueDate, campo com coluna cloud real) em modo nuvem chama updateTask nativo com due_date", async () => {
    localStorage.setItem(TASKS_DATA_SOURCE_KEY, "supabase");
    setup([
      makeTask({ id: "cloud-uuid-3" as unknown as number, title: "Tarefa com prazo", dueDate: "2026-09-01" }),
    ], ["/tarefas?task=cloud-uuid-3"], true);

    const dueInput = await screen.findByDisplayValue("2026-09-01");
    fireEvent.change(dueInput, { target: { value: "2026-09-15" } });
    fireEvent.blur(dueInput);

    await waitFor(() => expect(SUPABASE_TASK_WRITES.updateTask).toHaveBeenCalledWith("cloud-uuid-3", { due_date: "2026-09-15" }));
    expect(LOCAL_TASK_WRITES.updateTask).not.toHaveBeenCalled();
  });
  // Campo local-only (recurrence/scope/taskProjectId/lembrete) via Select —
  // não testado por UI aqui (Radix Select em jsdom exige polyfill de
  // scrollIntoView/pointer capture, fragilidade desnecessária); coberto de
  // forma direta e precisa pelo describe "splitTaskUpdatePatch" abaixo, que
  // testa a mesma função pura que o wrapper `updateTask` usa por trás.
});

// splitTaskUpdatePatch (PATCH MISTO) — testado em
// src/services/tasks/__tests__/tasksMapper.test.ts, junto do resto do
// mapper de onde a função vive.
