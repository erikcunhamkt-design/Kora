// Etapa 5 · Fatia 7 (projects/tasks) — prova a GUARDA de source_local_id de
// importTask. Sem árvore de decisão (§7.3): o vocabulário local de Task.source
// nunca colide com "project_template" (gerador de tarefas base, Etapa 3), então o
// upsert geral basta sempre — sem caminho especial a testar aqui.
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const upsertSingle = vi.fn();
  const upsertSelect = vi.fn(() => ({ single: upsertSingle }));
  const upsert = vi.fn(() => ({ select: upsertSelect }));
  const updateSingle = vi.fn();
  const updateSelect = vi.fn(() => ({ single: updateSingle }));
  const updateIs = vi.fn(() => ({ select: updateSelect }));
  const updateEqWorkspace = vi.fn(() => ({ is: updateIs }));
  const updateEqId = vi.fn(() => ({ eq: updateEqWorkspace }));
  const update = vi.fn(() => ({ eq: updateEqId }));
  const from = vi.fn(() => ({ upsert, update }));
  return {
    upsertSingle, upsert, upsertSelect, from,
    update, updateEqId, updateEqWorkspace, updateIs, updateSelect, updateSingle,
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));

import { tasksRepository } from "@/repositories/tasksRepository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tasksRepository.importTask — guarda de source_local_id", () => {
  it("rejeita source_local_id vazio ANTES de qualquer chamada ao banco", async () => {
    await expect(
      tasksRepository.importTask("ws1", "", { title: "x", status: "todo" }),
    ).rejects.toThrow(/source_local_id/);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("rejeita source_local_id só com espaços em branco", async () => {
    await expect(
      tasksRepository.importTask("ws1", "   ", { title: "x", status: "todo" }),
    ).rejects.toThrow(/source_local_id/);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});

describe("tasksRepository.importTask — sempre o caminho geral (sem árvore de decisão)", () => {
  it("usa upsert(onConflict: workspace_id,source_local_id), qualquer que seja o source", async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "tk-1" }, error: null });

    await tasksRepository.importTask("ws1", "install-x:tk-local-1", {
      title: "Tarefa qualquer",
      status: "a_fazer",
      priority: "média",
      source: "manual",
    });

    expect(mocks.from).toHaveBeenCalledWith("tasks");
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws1",
        source_local_id: "install-x:tk-local-1",
        source: "manual",
      }),
      { onConflict: "workspace_id,source_local_id" },
    );
  });

  it('mesmo com source="projeto" (tarefa gerada a partir de um projeto local) usa o caminho geral', async () => {
    mocks.upsertSingle.mockResolvedValue({ data: { id: "tk-2" }, error: null });

    await tasksRepository.importTask("ws1", "install-x:tk-local-2", {
      title: "Tarefa de projeto",
      status: "a_fazer",
      priority: "média",
      source: "projeto",
      project_id: "project-uuid-1",
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ source: "projeto", project_id: "project-uuid-1" }),
      { onConflict: "workspace_id,source_local_id" },
    );
  });
});

// R1 (docs/qa/tarefas-r2-auditoria.md §2.2) — updateTaskStatus só aceitava
// todo/in_progress/done; "revisão" (4º valor do vocabulário local,
// useTasks.ts) não tinha pra onde ir. Prova o round-trip dos 4 valores —
// falha contra a assinatura anterior (TS rejeitaria "revisao"/"a_fazer"/
// "em_andamento" como argumento; aqui provamos em runtime que os 4 chegam
// intactos no payload do UPDATE, sem tradução nenhuma).
describe("tasksRepository.updateTaskStatus — R1, vocabulário dos 4 estados locais", () => {
  it.each(["a_fazer", "em_andamento", "revisao", "concluido"] as const)(
    "grava o status \"%s\" verbatim no UPDATE, sem tradução",
    async (status) => {
      mocks.updateSingle.mockResolvedValue({ data: { id: "tk-1", status }, error: null });

      const result = await tasksRepository.updateTaskStatus("ws1", "tk-1", status);

      expect(mocks.from).toHaveBeenCalledWith("tasks");
      expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status }));
      expect(mocks.updateEqId).toHaveBeenCalledWith("id", "tk-1");
      expect(mocks.updateEqWorkspace).toHaveBeenCalledWith("workspace_id", "ws1");
      expect(result.status).toBe(status);
    },
  );
});
