// Etapa 5 · Tarefas Fase B (Pacote do Flip, §7 B4, 22/ago/2026) — prova que
// useDayCenterData lê `tasks` via useBifurcatedTasks() (local OU nuvem,
// conforme kora.tasks.dataSource.v1), não mais useTasks() cru. Antes desta
// rodada, uma tarefa só-nuvem (criada por createProjectBaseTasks, por
// exemplo) nunca aparecia na Central do Dia em modo Supabase — ficava
// "100% local, fora de escopo" (comentário G29 corrigido nesta rodada).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useDayCenterData } from "@/hooks/useDayCenterData";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useTasks } from "@/hooks/useTasks";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useClients } from "@/hooks/useClients";
import { useAllClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { computeDayCenter } from "@/lib/dayCenter";

vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useBifurcatedProjects", () => ({ useBifurcatedProjects: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientActivityLogs", () => ({ useAllClientActivityLogs: vi.fn() }));
vi.mock("@/lib/dayCenter", async () => {
  const actual = await vi.importActual<typeof import("@/lib/dayCenter")>("@/lib/dayCenter");
  return { ...actual, computeDayCenter: vi.fn(actual.computeDayCenter) };
});

const cloudOnlyTask = {
  id: "sft-tarefa-nuvem" as unknown as number, // uuid contrabandeado, mesmo padrão de useBifurcatedTasks
  title: "HOMOLOG-TAR-tarefa-nuvem",
  status: "a_fazer" as const,
  priority: "alta" as const,
  isDemo: false,
  createdAt: "2026-08-20T00:00:00.000Z",
  archived: false,
} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBifurcatedTasks).mockReturnValue([cloudOnlyTask] as never);
  vi.mocked(useTasks).mockReturnValue({ tasks: [] } as never);
  vi.mocked(useLeads).mockReturnValue({ leads: [] } as never);
  vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
  vi.mocked(useBifurcatedProjects).mockReturnValue([] as never);
  vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useAllClientActivityLogs).mockReturnValue([] as never);
});

describe("useDayCenterData · leitura bifurcada de tasks (§7 B4)", () => {
  it("passa os tasks de useBifurcatedTasks() pro computeDayCenter — não os de useTasks()", () => {
    renderHook(() => useDayCenterData());

    expect(useBifurcatedTasks).toHaveBeenCalled();
    expect(useTasks).not.toHaveBeenCalled();
    expect(computeDayCenter).toHaveBeenCalledWith(
      expect.objectContaining({ tasks: [cloudOnlyTask] }),
    );
  });

  it("uma tarefa só-nuvem (id uuid) aparece no resultado da Central do Dia", () => {
    const { result } = renderHook(() => useDayCenterData());

    const taskItem = result.current.items.find((i) => i.relatedType === "task");
    expect(taskItem).toBeDefined();
    expect(taskItem?.title).toBe("HOMOLOG-TAR-tarefa-nuvem");
  });
});
