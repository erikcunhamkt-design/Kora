// Etapa 5 · Fatia 7 (projects/tasks) — testes do mapper: fan-out (3 maps, incl. o 4º
// map novo de projects), opportunity_id sempre null (ausência estrutural, não órfã),
// e ausência de tradução de vocabulário (source/status/priority já disjuntos, §7.3).
import { describe, it, expect } from "vitest";
import {
  mapLocalTaskToSupabase,
  mapSupabaseTaskToLocal,
  resolveTaskFk,
  normalizeCloudTaskStatus,
  normalizeCloudTaskPriority,
  normalizeCloudTaskScope,
  normalizeCloudTaskRecurrence,
  splitTaskUpdatePatch,
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

  // Fatia B1 (etapa-5-flip-tarefas-migrations-drafts.md §1-4) — os 4 campos
  // bloqueantes agora são gravados explícitos no payload de criação/import
  // (mesmo caminho usado por useSupabaseTasksAll.createMutation e
  // useLocalTasksImport.ts — os 2 compartilham esta função). Sem tradução:
  // vocabulário local/cloud idêntico pra scope/recurrence.
  describe("fatia B1 — os 4 campos bloqueantes vão explícitos no payload, nunca dependem do DEFAULT da coluna", () => {
    it("scope/tags/recurrence presentes na Task local passam direto, sem tradução", () => {
      const payload = mapLocalTaskToSupabase(makeTask({
        scope: "personal", tags: ["urgente"], recurrence: "weekly",
      }));
      expect(payload.scope).toBe("personal");
      expect(payload.tags).toEqual(["urgente"]);
      expect(payload.recurrence).toBe("weekly");
    });

    it("scope/recurrence ausentes na Task local caem no default explícito (work/none), nunca omitidos do payload", () => {
      const payload = mapLocalTaskToSupabase(makeTask({ scope: undefined, recurrence: undefined }));
      expect(payload.scope).toBe("work");
      expect(payload.recurrence).toBe("none");
    });

    it("reminderAt/reminderEnabled presentes passam direto", () => {
      const payload = mapLocalTaskToSupabase(makeTask({
        reminderAt: "2026-09-01T10:00:00.000Z", reminderEnabled: true,
      }));
      expect(payload.reminder_at).toBe("2026-09-01T10:00:00.000Z");
      expect(payload.reminder_enabled).toBe(true);
    });

    it("reminderAt ausente/vazio vira null, nunca undefined; reminderEnabled ausente vira false explícito", () => {
      const payload = mapLocalTaskToSupabase(makeTask({ reminderAt: undefined, reminderEnabled: undefined }));
      expect(payload.reminder_at).toBeNull();
      expect(payload.reminder_enabled).toBe(false);
    });

    it("[invariante] reminder_sent_at NUNCA aparece no payload — é do servidor, não do client", () => {
      const payload = mapLocalTaskToSupabase(makeTask({ reminderSentAt: "2026-08-30T09:00:00.000Z" }));
      expect(payload).not.toHaveProperty("reminder_sent_at");
    });
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

// Fatia B1 (etapa-5-flip-tarefas-migrations-drafts.md §1) — diferente de
// status/priority acima, `scope` nunca teve um 2º dialeto (coluna nova,
// vocabulário local/cloud IDÊNTICO desde o desenho) — este normalizador só
// protege contra NULL/valor fora do vocabulário, não traduz nada.
describe("normalizeCloudTaskScope — coluna nova, sem tradução, só proteção contra NULL/valor desconhecido", () => {
  it("os 2 valores locais passam intocados", () => {
    expect(normalizeCloudTaskScope("work")).toBe("work");
    expect(normalizeCloudTaskScope("personal")).toBe("personal");
  });

  it("NULL/undefined (linha legada, coluna nova) cai no default 'work'", () => {
    expect(normalizeCloudTaskScope(null)).toBe("work");
    expect(normalizeCloudTaskScope(undefined)).toBe("work");
  });

  it("valor fora do vocabulário cai no default 'work' — nunca mascara com um cast cru", () => {
    expect(normalizeCloudTaskScope("scope-bizarro")).toBe("work");
  });
});

// Fatia B1 — mesma classe de `normalizeCloudTaskScope` acima, agora pra
// `recurrence` (5 valores).
describe("normalizeCloudTaskRecurrence — coluna nova, sem tradução, só proteção contra NULL/valor desconhecido", () => {
  it("os 5 valores locais passam intocados", () => {
    expect(normalizeCloudTaskRecurrence("none")).toBe("none");
    expect(normalizeCloudTaskRecurrence("daily")).toBe("daily");
    expect(normalizeCloudTaskRecurrence("weekly")).toBe("weekly");
    expect(normalizeCloudTaskRecurrence("monthly")).toBe("monthly");
    expect(normalizeCloudTaskRecurrence("weekdays")).toBe("weekdays");
  });

  it("NULL/undefined (linha legada, coluna nova) cai no default 'none'", () => {
    expect(normalizeCloudTaskRecurrence(null)).toBe("none");
    expect(normalizeCloudTaskRecurrence(undefined)).toBe("none");
  });

  it("valor fora do vocabulário cai no default 'none' — nunca mascara com um cast cru", () => {
    expect(normalizeCloudTaskRecurrence("recurrence-bizarra")).toBe("none");
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

  // G49 (Lane B, aterrissou durante esta fundação) fechou o gap que G53
  // tinha deixado aberto de propósito — priority agora usa
  // normalizeCloudTaskPriority, mesmo molde de status/G40.
  it("priority usa normalizeCloudTaskPriority (G49) — vocabulário legado em inglês vira o equivalente local", () => {
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ priority: "medium" })).priority).toBe("média");
    expect(mapSupabaseTaskToLocal(makeSupabaseTask({ priority: "high" })).priority).toBe("alta");
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

  // Fatia B1 (etapa-5-flip-tarefas-migrations-drafts.md §1-4) — scope/tags/
  // recurrence/reminder GANHARAM coluna real; linha LEGADA (coluna nova,
  // NULL) continua caindo no mesmo default neutro de antes (nada mudou pra
  // quem já existia antes da migration). O que mudou: quando a coluna TEM
  // valor, ele agora é lido de verdade (round-trip), não mais ignorado.
  describe("fatia B1 — linha legada (colunas NULL) cai no mesmo default neutro de sempre", () => {
    it("scope/recurrence caem no membro neutro do enum quando a coluna é NULL", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.scope).toBe("work");
      expect(task.recurrence).toBe("none");
    });

    it("tags/subtasks/comments ficam como coleção vazia quando a coluna é NULL", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.tags).toEqual([]);
      expect(task.subtasks).toEqual([]);
      expect(task.comments).toEqual([]);
    });

    it("taskProjectId/milestoneId (gap genuíno, sem coluna cloud) ficam undefined — nunca um valor inventado", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.taskProjectId).toBeUndefined();
      expect(task.milestoneId).toBeUndefined();
    });

    it("reminderAt/reminderSentAt ficam undefined quando a coluna é NULL", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask());
      expect(task.reminderAt).toBeUndefined();
      expect(task.reminderSentAt).toBeUndefined();
    });

    it("reminderEnabled cai no default neutro/seguro false quando a coluna é NULL (mesmo default de useTaskReminders.ts)", () => {
      expect(mapSupabaseTaskToLocal(makeSupabaseTask()).reminderEnabled).toBe(false);
    });
  });

  // Achado #1 da homologação, agravado: scope/tags/recorrência/lembrete
  // estavam MORTOS em tarefa da nuvem (hardcode ignorava a coluna real).
  // Estes testes provam o round-trip de verdade — valor presente na coluna
  // chega ao Task local, não só o fallback de linha legada acima.
  describe("fatia B1 — round-trip: valor real da coluna chega ao Task local", () => {
    it("scope='personal' round-trips (não fica preso em 'work')", () => {
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ scope: "personal" })).scope).toBe("personal");
    });

    it("scope fora do vocabulário conhecido cai no default 'work' — nunca mascara, nunca quebra o tipo", () => {
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ scope: "scope-bizarro" })).scope).toBe("work");
    });

    it("recurrence não-'none' round-trips (os 4 valores reais, não só o default)", () => {
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ recurrence: "daily" })).recurrence).toBe("daily");
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ recurrence: "weekly" })).recurrence).toBe("weekly");
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ recurrence: "monthly" })).recurrence).toBe("monthly");
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ recurrence: "weekdays" })).recurrence).toBe("weekdays");
    });

    it("recurrence fora do vocabulário conhecido cai no default 'none' — nunca mascara, nunca quebra o tipo", () => {
      expect(mapSupabaseTaskToLocal(makeSupabaseTask({ recurrence: "recurrence-bizarra" })).recurrence).toBe("none");
    });

    it("tags round-trips (array real, não [] hardcoded)", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask({ tags: ["urgente", "cliente-x"] }));
      expect(task.tags).toEqual(["urgente", "cliente-x"]);
    });

    it("reminderAt/reminderEnabled round-trip juntos", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask({
        reminder_at: "2026-09-01T10:00:00.000Z", reminder_enabled: true,
      }));
      expect(task.reminderAt).toBe("2026-09-01T10:00:00.000Z");
      expect(task.reminderEnabled).toBe(true);
    });

    it("reminderSentAt é lido por completude (G37) mesmo sem nenhum produtor client-side gravando nele", () => {
      const task = mapSupabaseTaskToLocal(makeSupabaseTask({ reminder_sent_at: "2026-08-30T09:00:00.000Z" }));
      expect(task.reminderSentAt).toBe("2026-08-30T09:00:00.000Z");
    });
  });

  it("archived/isDemo são passagem direta (colunas NOT NULL, sempre presentes)", () => {
    const task = mapSupabaseTaskToLocal(makeSupabaseTask({ archived: true, is_demo: true }));
    expect(task.archived).toBe(true);
    expect(task.isDemo).toBe(true);
  });
});

// B5 (Tarefas.tsx, escrita nativa) — PATCH MISTO (campo cloud + campo
// local-only no mesmo patch). Desde a fatia B1 (scope/tags/recurrence/
// reminder ligados às colunas reais), 3 call sites reais de `updateTask`
// em Tarefas.tsx produzem patch misto TODO DIA (ver comentário do
// wrapper) — estes testes provam que os 2 lados sempre são preservados,
// nunca um `return` antecipado descarta o outro.
describe("splitTaskUpdatePatch (B5, PATCH MISTO)", () => {
  it("patch só com campos cloud → cloudPatch completo, localPatch vazio", () => {
    const { cloudPatch, localPatch } = splitTaskUpdatePatch({ title: "Novo título", priority: "alta" });
    expect(cloudPatch).toEqual({ title: "Novo título", priority: "alta" });
    expect(localPatch).toEqual({});
  });

  it("patch só com campos locais-only (sem coluna cloud) → localPatch completo, cloudPatch vazio", () => {
    const { cloudPatch, localPatch } = splitTaskUpdatePatch({ taskProjectId: "tp-1", milestoneId: "m-1" });
    expect(cloudPatch).toEqual({});
    expect(localPatch).toEqual({ taskProjectId: "tp-1", milestoneId: "m-1" });
  });

  it("PATCH MISTO (1 campo cloud + 1 campo local-only na mesma chamada) → divide corretamente os 2, nenhum se perde", () => {
    const { cloudPatch, localPatch } = splitTaskUpdatePatch({ priority: "alta", taskProjectId: "tp-1" });
    expect(cloudPatch).toEqual({ priority: "alta" });
    expect(localPatch).toEqual({ taskProjectId: "tp-1" });
  });

  it("dueDate vazio (limpar prazo) vira due_date: null no cloudPatch, nunca undefined; dueDate ausente não entra no patch", () => {
    const { cloudPatch } = splitTaskUpdatePatch({ dueDate: undefined, priority: "baixa" });
    expect(cloudPatch).toEqual({ priority: "baixa" });

    const cleared = splitTaskUpdatePatch({ dueDate: "" });
    expect(cleared.cloudPatch).toEqual({ due_date: null });
  });

  // Fatia B1 (etapa-5-flip-tarefas-migrations-drafts.md §1-4) — achado #1 da
  // homologação: scope/tags/recorrência/lembrete estavam MORTOS em tarefa da
  // nuvem porque splitTaskUpdatePatch os mandava pro localPatch (sem efeito
  // nenhum pra uma task que só existe em useSupabaseTasksAll). Estes testes
  // provam que os 4 campos bloqueantes agora vão pro cloudPatch.
  describe("fatia B1 — scope/tags/recurrence/reminder agora vão pro cloudPatch", () => {
    it("scope sozinho → cloudPatch (era localPatch antes desta fatia)", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({ scope: "personal" });
      expect(cloudPatch).toEqual({ scope: "personal" });
      expect(localPatch).toEqual({});
    });

    it("recurrence sozinho → cloudPatch (era localPatch antes desta fatia)", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({ recurrence: "weekly" });
      expect(cloudPatch).toEqual({ recurrence: "weekly" });
      expect(localPatch).toEqual({});
    });

    it("tags sozinho → cloudPatch", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({ tags: ["urgente", "cliente-x"] });
      expect(cloudPatch).toEqual({ tags: ["urgente", "cliente-x"] });
      expect(localPatch).toEqual({});
    });

    it("PATCH MISTO real: { taskProjectId, scope } — taskProjectId fica local, scope vai pra nuvem (2 call sites reais de Tarefas.tsx)", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({ taskProjectId: "tp-2", scope: "work" });
      expect(cloudPatch).toEqual({ scope: "work" });
      expect(localPatch).toEqual({ taskProjectId: "tp-2" });
    });

    it("[G52-classe] reminderAt + reminderEnabled juntos (setar lembrete novo) → os 2 vão pro cloudPatch", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({
        reminderAt: "2026-09-01T10:00:00.000Z",
        reminderEnabled: true,
        reminderSentAt: undefined,
      });
      expect(cloudPatch).toEqual({ reminder_at: "2026-09-01T10:00:00.000Z", reminder_enabled: true });
      // reminderSentAt (undefined) permanece no localPatch, mesmo estando
      // no mesmo patch que 2 campos cloud — PATCH MISTO real.
      expect(localPatch).toEqual({ reminderSentAt: undefined });
    });

    it("[G52-classe] só reminderEnabled (alternar liga/desliga) → só ele vai pro cloudPatch, reminderAt intocado", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({
        reminderEnabled: false,
        reminderSentAt: undefined,
      });
      expect(cloudPatch).toEqual({ reminder_enabled: false });
      expect(localPatch).toEqual({ reminderSentAt: undefined });
    });

    it("reminderAt vazio (limpar lembrete) vira reminder_at: null no cloudPatch, nunca undefined", () => {
      const { cloudPatch } = splitTaskUpdatePatch({ reminderAt: "", reminderEnabled: false });
      expect(cloudPatch).toEqual({ reminder_at: null, reminder_enabled: false });
    });

    it("[invariante] reminderSentAt NUNCA aparece no cloudPatch, mesmo sozinho no patch", () => {
      const { cloudPatch, localPatch } = splitTaskUpdatePatch({ reminderSentAt: "2026-08-30T12:00:00.000Z" });
      expect(cloudPatch).toEqual({});
      expect(localPatch).toEqual({ reminderSentAt: "2026-08-30T12:00:00.000Z" });
    });
  });
});
