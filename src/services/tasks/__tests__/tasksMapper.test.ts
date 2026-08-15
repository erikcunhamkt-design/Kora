// Etapa 5 · Fatia 7 (projects/tasks) — testes do mapper: fan-out (3 maps, incl. o 4º
// map novo de projects), opportunity_id sempre null (ausência estrutural, não órfã),
// e ausência de tradução de vocabulário (source/status/priority já disjuntos, §7.3).
import { describe, it, expect } from "vitest";
import { mapLocalTaskToSupabase, resolveTaskFk, normalizeCloudTaskStatus, normalizeCloudTaskPriority } from "@/services/tasks/tasksMapper";
import type { Task } from "@/hooks/useTasks";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "Tarefa X",
    description: "",
    client: "",
    project: "",
    priority: "média",
    deadline: "18 Abr 2026",
    status: "a_fazer",
    createdAt: "2026-07-01T00:00:00Z",
    tags: [],
    subtasks: [],
    comments: [],
    isDemo: false,
    ...overrides,
  };
}

describe("resolveTaskFk — padrão Q4 (mapeado -> uuid; ausente -> null, nunca id cru)", () => {
  it("devolve o uuid quando o id local está mapeado", () => {
    expect(resolveTaskFk(42, { "42": "uuid-42" })).toBe("uuid-42");
  });
  it("devolve null quando o id local NÃO está mapeado", () => {
    expect(resolveTaskFk(99, { "42": "uuid-42" })).toBeNull();
  });
  it("devolve null quando o id local é null/undefined/vazio", () => {
    expect(resolveTaskFk(null, {})).toBeNull();
    expect(resolveTaskFk(undefined, {})).toBeNull();
    expect(resolveTaskFk("", {})).toBeNull();
  });
});

describe("mapLocalTaskToSupabase — fan-out incl. o 4º map (projects), sem tradução de vocabulário", () => {
  const maps = {
    clients: { "7": "client-uuid-7" },
    quotes: { "qt-1": "quote-uuid-1" },
    projects: { "pj-1": "project-uuid-1" },
  };

  it("resolve client_id/quote_id/project_id para uuid quando mapeados (4º map novo desta fatia)", () => {
    const task = makeTask({ clientId: 7, quoteId: "qt-1", projectId: "pj-1" });
    const payload = mapLocalTaskToSupabase(task, maps);
    expect(payload.client_id).toBe("client-uuid-7");
    expect(payload.quote_id).toBe("quote-uuid-1");
    expect(payload.project_id).toBe("project-uuid-1");
  });

  it("projectId presente mas NÃO mapeado (projeto ainda não importado) -> project_id null, nunca inventado (garantia §8.1)", () => {
    const task = makeTask({ projectId: "pj-nao-importado-ainda" });
    const payload = mapLocalTaskToSupabase(task, maps);
    expect(payload.project_id).toBeNull();
    expect(payload.project_id).not.toBe("pj-nao-importado-ainda");
  });

  it("tarefa solta, sem projectId (caso de uso real, não transitório) -> project_id null", () => {
    const task = makeTask();
    const payload = mapLocalTaskToSupabase(task, maps);
    expect(payload.project_id).toBeNull();
  });

  it("resolve para null quando os ids locais NÃO estão mapeados (nunca id cru)", () => {
    const task = makeTask({ clientId: 999, quoteId: "qt-desconhecida" });
    const payload = mapLocalTaskToSupabase(task, maps);
    expect(payload.client_id).toBeNull();
    expect(payload.quote_id).toBeNull();
    expect(payload.client_id).not.toBe(999);
    expect(payload.quote_id).not.toBe("qt-desconhecida");
  });

  it("opportunity_id é sempre null — ausência estrutural do campo, não uma órfã", () => {
    const payload = mapLocalTaskToSupabase(makeTask());
    expect(payload.opportunity_id).toBeNull();
  });

  it("status/priority/source são passagem direta, sem tradução (§7.3 — vocabulário já disjunto)", () => {
    const payload = mapLocalTaskToSupabase(makeTask({ status: "revisao", priority: "alta", source: "projeto" }));
    expect(payload.status).toBe("revisao");
    expect(payload.priority).toBe("alta");
    expect(payload.source).toBe("projeto");
  });

  it('source ausente vira "manual", nunca undefined', () => {
    const payload = mapLocalTaskToSupabase(makeTask({ source: undefined }));
    expect(payload.source).toBe("manual");
  });
});

// R1 (docs/qa/tarefas-r2-auditoria.md §2.2) — updateTaskStatus só aceitava
// todo/in_progress/done (3 valores, inglês) — sem "revisão", divergindo do
// próprio contrato "sem tradução de vocabulário" que este arquivo já
// documentava (o vocabulário real, gravado por importTask, sempre foi o
// local em português).
describe("normalizeCloudTaskStatus — R1, alinha updateTaskStatus ao vocabulário que importTask já grava", () => {
  it("os 4 valores locais passam intocados", () => {
    expect(normalizeCloudTaskStatus("a_fazer")).toBe("a_fazer");
    expect(normalizeCloudTaskStatus("em_andamento")).toBe("em_andamento");
    expect(normalizeCloudTaskStatus("revisao")).toBe("revisao");
    expect(normalizeCloudTaskStatus("concluido")).toBe("concluido");
  });

  it("os 3 valores legados em inglês (só possíveis numa linha gravada antes do fix) viram o equivalente local", () => {
    expect(normalizeCloudTaskStatus("todo")).toBe("a_fazer");
    expect(normalizeCloudTaskStatus("in_progress")).toBe("em_andamento");
    expect(normalizeCloudTaskStatus("done")).toBe("concluido");
  });

  it("valor desconhecido passa intocado — nunca mascara, nunca inventa", () => {
    expect(normalizeCloudTaskStatus("status-bizarro")).toBe("status-bizarro");
  });
});

// G49 (docs/architecture/kora-hub-auditoria-e-plano.md) — mesmo defeito do R1
// acima, em priority: CreateProjectBaseTasksDialog.tsx gravava "medium"/
// "high"/"low" (inglês) direto em public.tasks.priority, divergindo do
// vocabulário oficial (local, alta/média/baixa) que este mapper sempre
// documentou como o contrato de passagem direta.
describe("normalizeCloudTaskPriority — G49, alinha CreateProjectBaseTasksDialog ao vocabulário que importTask já grava", () => {
  it("os 3 valores locais passam intocados", () => {
    expect(normalizeCloudTaskPriority("alta")).toBe("alta");
    expect(normalizeCloudTaskPriority("média")).toBe("média");
    expect(normalizeCloudTaskPriority("baixa")).toBe("baixa");
  });

  it("os 3 valores legados em inglês (só possíveis numa linha gravada antes do fix) viram o equivalente local", () => {
    expect(normalizeCloudTaskPriority("high")).toBe("alta");
    expect(normalizeCloudTaskPriority("medium")).toBe("média");
    expect(normalizeCloudTaskPriority("low")).toBe("baixa");
  });

  it("valor desconhecido passa intocado — nunca mascara, nunca inventa", () => {
    expect(normalizeCloudTaskPriority("priority-bizarra")).toBe("priority-bizarra");
  });
});
