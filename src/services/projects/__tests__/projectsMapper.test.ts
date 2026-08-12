// Etapa 5 · Fatia 7 (projects/tasks) — testes do mapper: fan-out (3 maps), e o
// requisito de implementação do §7.2/veredito de Fase B: a tradução de vocabulário
// "orçamento" -> "quote" (sem ela, ux_projects_from_quote vira índice decorativo).
//
// Etapa 5 · Flip Projetos (item 5, retomada 2026-08-11) — acrescenta a direção
// nuvem -> local (leitura, item 2): tradução de status nos dois sentidos
// (incluindo o alias legado 'active' e o fallback cloudStatusRaw), source
// reverso, e mapSupabaseProjectToLocal completo.
import { describe, it, expect } from "vitest";
import type { SupabaseProject } from "@/repositories/projectsRepository";
import {
  mapLocalProjectToSupabase,
  mapSupabaseProjectToLocal,
  resolveProjectFk,
  resolveCloudProjectSource,
  resolveLocalProjectSource,
  translateCloudProjectStatusToLocal,
} from "@/services/projects/projectsMapper";
import type { Project } from "@/hooks/useProjects";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pj-1",
    name: "Projeto X",
    clientName: "Cliente X",
    status: "planning",
    priority: "medium",
    progress: 0,
    tags: [],
    createdAt: "2026-07-01T00:00:00Z",
    isDemo: false,
    ...overrides,
  };
}

function makeSupabaseProject(overrides: Partial<SupabaseProject> = {}): SupabaseProject {
  return {
    id: "sp1",
    workspace_id: "w1",
    title: "Projeto Nuvem",
    status: "planning",
    is_demo: false,
    archived: false,
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

describe("resolveProjectFk — padrão Q4 (mapeado -> uuid; ausente -> null, nunca id cru)", () => {
  it("devolve o uuid quando o id local está mapeado", () => {
    expect(resolveProjectFk(42, { "42": "uuid-42" })).toBe("uuid-42");
  });
  it("devolve null quando o id local NÃO está mapeado", () => {
    expect(resolveProjectFk(99, { "42": "uuid-42" })).toBeNull();
  });
  it("devolve null quando o id local é null/undefined/vazio", () => {
    expect(resolveProjectFk(null, {})).toBeNull();
    expect(resolveProjectFk(undefined, {})).toBeNull();
    expect(resolveProjectFk("", {})).toBeNull();
  });
});

describe("resolveCloudProjectSource — TRADUÇÃO DE VOCABULÁRIO (requisito de implementação, §7.2)", () => {
  it('projeto local "orçamento" COM quote_id resolvido -> literal "quote" gravado na nuvem', () => {
    expect(resolveCloudProjectSource("orçamento", "quote-uuid-1")).toBe("quote");
  });

  it('projeto local "orçamento" SEM quote_id resolvido (órfão) -> "manual", NUNCA "quote"', () => {
    // Sem quote_id de verdade, o predicado WHERE source='quote' do índice parcial não
    // teria com o que casar de forma coerente — fica manual até a quote ser mapeada.
    expect(resolveCloudProjectSource("orçamento", null)).toBe("manual");
  });

  it('projeto local "manual" -> "manual", passagem direta, mesmo com quote_id presente', () => {
    expect(resolveCloudProjectSource("manual", "quote-uuid-1")).toBe("manual");
  });

  it('source local ausente (undefined) -> "manual"', () => {
    expect(resolveCloudProjectSource(undefined, null)).toBe("manual");
  });
});

describe("mapLocalProjectToSupabase — fan-out dos 3 import-maps + tradução de source integrada", () => {
  const maps = {
    clients: { "7": "client-uuid-7" },
    quotes: { "qt-1": "quote-uuid-1" },
    opportunities: { "3": "opp-uuid-3" },
  };

  it("resolve client_id/quote_id/opportunity_id para uuid quando mapeados", () => {
    const project = makeProject({ clientId: 7, quoteId: "qt-1", opportunityId: 3, source: "orçamento" });
    const payload = mapLocalProjectToSupabase(project, maps);
    expect(payload.client_id).toBe("client-uuid-7");
    expect(payload.quote_id).toBe("quote-uuid-1");
    expect(payload.opportunity_id).toBe("opp-uuid-3");
  });

  it('projeto quote-linked com quote_id resolvido: payload.source é literalmente "quote"', () => {
    const project = makeProject({ quoteId: "qt-1", source: "orçamento" });
    const payload = mapLocalProjectToSupabase(project, maps);
    expect(payload.source).toBe("quote");
  });

  it('projeto quote-linked mas quote_id NÃO mapeado (order): payload.source é "manual", nunca "quote"', () => {
    const project = makeProject({ quoteId: "qt-desconhecida", source: "orçamento" });
    const payload = mapLocalProjectToSupabase(project, maps);
    expect(payload.quote_id).toBeNull();
    expect(payload.source).toBe("manual");
  });

  it("resolve para null quando os ids locais NÃO estão mapeados (nunca id cru)", () => {
    const project = makeProject({ clientId: 999, quoteId: "qt-desconhecida", opportunityId: 999 });
    const payload = mapLocalProjectToSupabase(project, maps);
    expect(payload.client_id).toBeNull();
    expect(payload.quote_id).toBeNull();
    expect(payload.opportunity_id).toBeNull();
    expect(payload.client_id).not.toBe(999);
    expect(payload.quote_id).not.toBe("qt-desconhecida");
  });

  it("quantiza budget a centavos (artefato de float do JS)", () => {
    const payload = mapLocalProjectToSupabase(makeProject({ budget: 0.1 + 0.2 }));
    expect(payload.budget).toBe(0.3);
  });

  it("budget ausente vira 0, não undefined/NaN", () => {
    const payload = mapLocalProjectToSupabase(makeProject({ budget: undefined }));
    expect(payload.budget).toBe(0);
  });

  it("nunca grava archived=true (achado item 3-b: boolean é campo morto na escrita atual)", () => {
    const payload = mapLocalProjectToSupabase(makeProject({ status: "archived" }));
    expect(payload.archived).toBe(false);
    expect(payload.status).toBe("archived");
  });
});

describe("projectsMapper — status: item 3-a, tradução nos dois sentidos", () => {
  it("os 7 valores locais fazem passthrough (import geral grava verbatim)", () => {
    const known: Array<Project["status"]> = [
      "planning", "in_progress", "review", "delivered", "paused", "cancelled", "archived",
    ];
    for (const status of known) {
      expect(translateCloudProjectStatusToLocal(status, false)).toEqual({ status });
    }
  });

  it("'active' é alias legado (DEFAULT da coluna + createProjectFromQuote) -> 'in_progress'", () => {
    expect(translateCloudProjectStatusToLocal("active", false)).toEqual({ status: "in_progress" });
  });

  it("archived boolean=true vence sobre qualquer status bruto", () => {
    expect(translateCloudProjectStatusToLocal("planning", true)).toEqual({ status: "archived" });
    expect(translateCloudProjectStatusToLocal("active", true)).toEqual({ status: "archived" });
    expect(translateCloudProjectStatusToLocal(null, true)).toEqual({ status: "archived" });
  });

  it("status texto 'archived' também vence sozinho — boolean é campo morto na escrita atual", () => {
    expect(translateCloudProjectStatusToLocal("archived", false)).toEqual({ status: "archived" });
  });

  it("status desconhecido cai no fallback 'planning' + cloudStatusRaw (UI nunca mascara)", () => {
    expect(translateCloudProjectStatusToLocal("xyz", false)).toEqual({
      status: "planning",
      cloudStatusRaw: "xyz",
    });
  });

  it("status ausente/null cai no mesmo fallback, sem cloudStatusRaw (nada bruto pra mostrar)", () => {
    expect(translateCloudProjectStatusToLocal(null, false)).toEqual({
      status: "planning",
      cloudStatusRaw: undefined,
    });
    expect(translateCloudProjectStatusToLocal(undefined, false)).toEqual({
      status: "planning",
      cloudStatusRaw: undefined,
    });
  });

  it("round-trip: local -> nuvem -> local preserva os 7 valores locais", () => {
    const statuses: Array<Project["status"]> = [
      "planning", "in_progress", "review", "delivered", "paused", "cancelled", "archived",
    ];
    for (const status of statuses) {
      const cloud = mapLocalProjectToSupabase(makeProject({ status }));
      const sp = makeSupabaseProject({ status: cloud.status, archived: cloud.archived });
      expect(mapSupabaseProjectToLocal(sp, {}).status).toBe(status);
    }
  });
});

describe("projectsMapper — resolveLocalProjectSource (inverso de resolveCloudProjectSource)", () => {
  it("só 'quote' vira 'orçamento'; qualquer outro valor -> 'manual'", () => {
    expect(resolveLocalProjectSource("quote")).toBe("orçamento");
    expect(resolveLocalProjectSource("manual")).toBe("manual");
    expect(resolveLocalProjectSource(null)).toBe("manual");
    expect(resolveLocalProjectSource(undefined)).toBe("manual");
    expect(resolveLocalProjectSource("xyz")).toBe("manual");
  });

  it("round-trip: orçamento resolvido -> quote -> orçamento", () => {
    const cloud = resolveCloudProjectSource("orçamento", "uuid-1");
    expect(resolveLocalProjectSource(cloud)).toBe("orçamento");
  });
});

describe("projectsMapper — mapSupabaseProjectToLocal (leitura, item 2)", () => {
  it("mapeia campos básicos e resolve clientName via clientNameById", () => {
    const sp = makeSupabaseProject({
      title: "Website Acme",
      client_id: "uuid-client-1",
      status: "in_progress",
      budget: 5000,
      start_date: "2026-07-01",
      due_date: "2026-08-01",
    });
    const project = mapSupabaseProjectToLocal(sp, { "uuid-client-1": "Acme Corp" });
    expect(project).toMatchObject({
      id: "sp1",
      name: "Website Acme",
      clientName: "Acme Corp",
      status: "in_progress",
      budget: 5000,
      startDate: "2026-07-01",
      dueDate: "2026-08-01",
      priority: "medium",
      tags: [],
      isDemo: false,
    });
  });

  it("client_id sem entrada no mapa -> clientName vazio (nunca quebra)", () => {
    const sp = makeSupabaseProject({ client_id: "uuid-desconhecido" });
    expect(mapSupabaseProjectToLocal(sp, {}).clientName).toBe("");
  });

  it("sem client_id -> clientName vazio", () => {
    const sp = makeSupabaseProject({ client_id: null });
    expect(mapSupabaseProjectToLocal(sp, { x: "y" }).clientName).toBe("");
  });

  it("status 'active' (alias legado) mapeia pra 'in_progress' na leitura da tela principal", () => {
    const sp = makeSupabaseProject({ status: "active" });
    expect(mapSupabaseProjectToLocal(sp, {}).status).toBe("in_progress");
  });

  it("status desconhecido preserva cloudStatusRaw no Project mapeado (UI nunca mascara)", () => {
    const sp = makeSupabaseProject({ status: "algo-novo" });
    const project = mapSupabaseProjectToLocal(sp, {});
    expect(project.status).toBe("planning");
    expect(project.cloudStatusRaw).toBe("algo-novo");
  });

  it("deliverables ausente (coluna ainda não aplicada, item 3-a) -> [] e progress 0", () => {
    const sp = makeSupabaseProject({ deliverables: undefined });
    const project = mapSupabaseProjectToLocal(sp, {});
    expect(project.deliverables).toEqual([]);
    expect(project.progress).toBe(0);
  });

  it("progress é SEMPRE derivado de deliverables (não existe coluna progress na nuvem)", () => {
    const sp = makeSupabaseProject({
      deliverables: [
        { id: "d1", title: "Etapa 1", status: "concluido" },
        { id: "d2", title: "Etapa 2", status: "concluido" },
        { id: "d3", title: "Etapa 3", status: "pendente" },
      ],
    });
    expect(mapSupabaseProjectToLocal(sp, {}).progress).toBe(67); // 2/3 arredondado
  });

  it("source 'quote' mapeia pra 'orçamento' local", () => {
    const sp = makeSupabaseProject({ source: "quote", quote_id: "uuid-quote-1" });
    const project = mapSupabaseProjectToLocal(sp, {});
    expect(project.source).toBe("orçamento");
    expect(project.quoteId).toBe("uuid-quote-1");
  });
});
