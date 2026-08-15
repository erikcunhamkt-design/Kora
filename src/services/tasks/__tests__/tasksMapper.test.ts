// Etapa 5 · Fatia 7 (projects/tasks) — testes do mapper: fan-out (3 maps, incl. o 4º
// map novo de projects), opportunity_id sempre null (ausência estrutural, não órfã),
// e ausência de tradução de vocabulário (source/status/priority já disjuntos, §7.3).
import { describe, it, expect } from "vitest";
import {
  mapLocalTaskToSupabase,
  mapSupabaseTaskToLocal,
  resolveTaskFk,
  normalizeCloudTaskStatus,
} from "@/services/tasks/tasksMapper";
import type { Task } from "@/hooks/useTasks";
import type { SupabaseTask } from "@/repositories/tasksRepository";

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

  // G53 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §3.2, G37 por
  // desenho) — mesma exceção já aplicada em projectsMapper.ts/financeMapper.ts:
  // um localId que já é uuid real (ex.: quoteId vindo de uma quote lida da
  // nuvem) passa direto, nunca procura no import-map (que só mapeia id LOCAL
  // -> uuid e nunca teria essa entrada).
  it("já sendo um uuid válido, passa direto — nunca procura no import-map", () => {
    const uuid = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";
    expect(resolveTaskFk(uuid, {})).toBe(uuid);
    expect(resolveTaskFk(uuid, { [uuid]: "outro-uuid-que-nunca-deveria-ganhar" })).toBe(uuid);
  });

  it("uma string que não é uuid continua tratada como id local (comportamento inalterado, regressão do import geral)", () => {
    expect(resolveTaskFk("tk-local-1", { "tk-local-1": "uuid-real-1" })).toBe("uuid-real-1");
    expect(resolveTaskFk("tk-local-nao-mapeada", {})).toBeNull();
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

// G53 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §3.4) — direção
// nuvem -> local, mesmo molde de mapSupabaseTransactionToLocal
// (financeMapper.test.ts): payload completo desde o dia 1 (G37), tratamento
// campo a campo dos gaps de schema (§1 da triagem), status normalizado via
// G40.
function makeSupabaseTask(overrides: Partial<SupabaseTask> = {}): SupabaseTask {
  return {
    id: "st-1",
    workspace_id: "ws-1",
    title: "Tarefa Nuvem",
    status: "a_fazer",
    priority: "média",
    source: "manual",
    sort_order: 0,
    is_demo: false,
    archived: false,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapSupabaseTaskToLocal — payload completo desde o dia 1 (lição G37 do financeMapper)", () => {
  it("mapeia campos básicos, resolve client via clientNameById", () => {
    const st = makeSupabaseTask({ title: "Revisar contrato", client_id: "client-uuid-1" });
    const task = mapSupabaseTaskToLocal(st, { "client-uuid-1": "Acme Corp" });

    expect(task.title).toBe("Revisar contrato");
    expect(task.client).toBe("Acme Corp");
  });

  it("client_id sem entrada no mapa -> client vazio (nunca quebra, nunca inventa um nome)", () => {
    const task = mapSupabaseTaskToLocal(makeSupabaseTask({ client_id: "client-desconhecido" }), {});
    expect(task.client).toBe("");
  });

  it("sem client_id -> client vazio", () => {
    expect(mapSupabaseTaskToLocal(makeSupabaseTask()).client).toBe("");
  });

  it("id/clientId: uuid da nuvem smuggled como number (mesmo precedente de projectsMapper/financeMapper); quoteId/projectId passagem direta (já são string no tipo local)", () => {
    const task = mapSupabaseTaskToLocal(makeSupabaseTask({
      id: "task-uuid-1", client_id: "client-uuid-1", quote_id: "quote-uuid-1", project_id: "project-uuid-1",
    }));
    expect(task.id).toBe("task-uuid-1" as unknown as number);
    expect(task.clientId).toBe("client-uuid-1" as unknown as number);
    expect(task.quoteId).toBe("quote-uuid-1");
    expect(task.projectId).toBe("project-uuid-1");
  });

  it("status usa normalizeCloudTaskStatus (G40) — vocabulário legado em inglês vira o equivalente local", () => {
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ status: "todo" })).status).toBe("a_fazer");
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ status: "in_progress" })).status).toBe("em_andamento");
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ status: "revisao" })).status).toBe("revisao");
  });

  it("priority é passagem direta, SEM normalização — gap conhecido (G49): valor legado em inglês passa intocado", () => {
    // createProjectBaseTasks (G49, correção em outra lane) ainda grava
    // priority em inglês hoje — este mapper não traduz, registrado como
    // decisão explícita (ver comentário de mapSupabaseTaskToLocal), não
    // um esquecimento.
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ priority: "medium" })).priority).toBe("medium");
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ priority: "alta" })).priority).toBe("alta");
  });

  it('source "project_template" (G49, gerador de tarefas-base) cai no fallback "manual" — vocabulário disjunto por construção', () => {
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ source: "project_template" })).source).toBe("manual");
  });

  it("source local conhecido (manual/projeto/orçamento) passa direto", () => {
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ source: "projeto" })).source).toBe("projeto");
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ source: "orçamento" })).source).toBe("orçamento");
  });

  it("deadline e project ficam vazios — nunca fabricados (deadline é legado, dueDate é a fonte preferencial; project exigiria join fora de escopo)", () => {
    const task = mapSupabaseTaskToLocal(makeSupabaseTask({ due_date: "2026-08-20" }));
    expect(task.deadline).toBe("");
    expect(task.project).toBe("");
    expect(task.dueDate).toBe("2026-08-20");
  });

  // "Reportar, não inventar" — os 7 gaps de schema da triagem (§1 do pacote,
  // nenhuma migration aplicada ainda): membro neutro pro enum, coleção vazia
  // pra array, undefined pra campo FK-shaped/sem sentido de placeholder.
  describe("gaps de schema (§1 da triagem) — membro neutro / coleção vazia / undefined, nunca um valor inventado", () => {
    it("scope/recurrence caem no membro neutro do enum", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.scope).toBe("work");
      expect(task.recurrence).toBe("none");
    });

    it("tags/subtasks/comments ficam como coleção vazia", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.tags).toEqual([]);
      expect(task.subtasks).toEqual([]);
      expect(task.comments).toEqual([]);
    });

    it("taskProjectId/milestoneId/reminderAt/reminderSentAt ficam undefined — nunca um valor inventado", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.taskProjectId).toBeUndefined();
      expect(task.milestoneId).toBeUndefined();
      expect(task.reminderAt).toBeUndefined();
      expect(task.reminderSentAt).toBeUndefined();
    });

    it("reminderEnabled cai no default neutro/seguro false (mesmo default de useTaskReminders.ts)", () => {
      expect(mapSupabaseTaskToLocal(makeSupabaseTask()).reminderEnabled).toBe(false);
    });
  });

  it("archived/isDemo são passagem direta (colunas NOT NULL, sempre presentes)", () => {
    const task = mapSupabaseTaskToLocal(makeSupabaseTask({ archived: true, is_demo: true }));
    expect(task.archived).toBe(true);
    expect(task.isDemo).toBe(true);
  });
});
