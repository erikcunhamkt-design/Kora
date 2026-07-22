// Etapa 5 · Fatia 7 (projects/tasks) — testes do mapper: fan-out (3 maps, incl. o 4º
// map novo de projects), opportunity_id sempre null (ausência estrutural, não órfã),
// e ausência de tradução de vocabulário (source/status/priority já disjuntos, §7.3).
import { describe, it, expect } from "vitest";
import { mapLocalTaskToSupabase, resolveTaskFk } from "@/services/tasks/tasksMapper";
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
