// G49 (docs/architecture/kora-hub-auditoria-e-plano.md) — CreateProjectBaseTasksDialog
// gravava status="todo" (hardcoded) e priority="medium"/"high"/"low" (de
// DEFAULT_TASKS/Select), um 2º dialeto em inglês na mesma coluna que
// updateTaskStatus já corrigiu no R1/G40 — o vocabulário oficial de
// public.tasks (o que importTask/mapLocalTaskToSupabase já gravam, verbatim)
// sempre foi o local (a_fazer/em_andamento/revisao/concluido,
// alta/média/baixa, português).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { CreateProjectBaseTasksDialog } from "@/components/projects/CreateProjectBaseTasksDialog";
import { tasksRepository } from "@/repositories/tasksRepository";
import { toast } from "sonner";

vi.mock("@/repositories/tasksRepository", () => ({
  tasksRepository: { listTasksByProject: vi.fn(), createProjectBaseTasks: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

// Radix Select (usado pelo <Select> de prioridade) precisa desses polyfills
// em jsdom — mesmo setup já usado em QuotesSection.test.tsx.
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

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  workspaceId: "ws-1",
  projectId: "project-uuid-1",
  clientId: "client-uuid-1",
  quoteId: null,
  opportunityId: null,
  onSuccess: vi.fn(),
};

describe("CreateProjectBaseTasksDialog — G49 (vocabulário de status/priority)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(tasksRepository.listTasksByProject).mockResolvedValue([]);
    vi.mocked(tasksRepository.createProjectBaseTasks).mockResolvedValue(
      Array.from({ length: 9 }, (_, i) => ({ id: `task-${i}` })) as never,
    );
  });

  it("todas as tarefas base são gravadas com status='a_fazer' e priority em português (alta/média/baixa)", async () => {
    render(<CreateProjectBaseTasksDialog {...baseProps} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(tasksRepository.createProjectBaseTasks).toHaveBeenCalledTimes(1));

    const [, payload] = vi.mocked(tasksRepository.createProjectBaseTasks).mock.calls[0];
    expect(payload.length).toBe(9);
    for (const task of payload) {
      expect(task.status).toBe("a_fazer");
      expect(["alta", "média", "baixa"]).toContain(task.priority);
    }
    // Nenhum valor em inglês deve sobreviver — nem no status nem na priority.
    expect(payload.every((t) => t.status !== "todo")).toBe(true);
    expect(payload.every((t) => !["high", "medium", "low"].includes(t.priority ?? ""))).toBe(true);
  });

  it("editar a prioridade de uma tarefa pelo Select grava o valor local escolhido, não o rótulo em inglês", async () => {
    render(<CreateProjectBaseTasksDialog {...baseProps} />);

    // 1º Select de prioridade da lista (tarefa "Kickoff com cliente", média por padrão).
    const priorityTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.pointerDown(priorityTrigger, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(priorityTrigger);
    // 2 armadilhas aqui: (1) o <select> nativo escondido (autofill) também
    // tem um <option>Alta</option>; (2) a tarefa "Produzir primeira entrega"
    // já nasce com priority "alta" (DEFAULT_TASKS) — seu próprio trigger
    // FECHADO já mostra o texto "Alta". Só o item de verdade dentro do
    // dropdown ABERTO tem um ancestral com role="option" (o texto em si
    // fica num <span> filho, via SelectPrimitive.ItemText — não é o próprio
    // nó com o role).
    const options = await screen.findAllByText("Alta");
    const realOption = options.find((el) => el.closest('[role="option"]')) ?? options[0];
    fireEvent.click(realOption);

    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(tasksRepository.createProjectBaseTasks).toHaveBeenCalledTimes(1));
    const [, payload] = vi.mocked(tasksRepository.createProjectBaseTasks).mock.calls[0];
    expect(payload[0].priority).toBe("alta");
  });

  it("sucesso mostra o toast esperado, sem erro", async () => {
    render(<CreateProjectBaseTasksDialog {...baseProps} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Tarefas base geradas com sucesso no Supabase!"));
    expect(toast.error).not.toHaveBeenCalled();
  });
});
