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
  translateLocalProjectStatusToCloud,
  EMPTY_PROJECT_IMPORT_MAPS,
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

  // G37 — QuoteToProjectDialog.tsx passa quoteId: quote.id direto; em modo
  // Supabase, quote.id já é o uuid real de public.quotes (mapSupabaseQuoteToLocalQuote
  // não faz cast/tradução nenhuma, ao contrário de clientId/opportunityId). Sem
  // esta exceção, o lookup no import-map (só mapeia id LOCAL) nunca bate, e o
  // FK sempre volta null mesmo com um vínculo real.
  it("já sendo um uuid válido, passa direto — nunca procura no import-map", () => {
    const uuid = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";
    expect(resolveProjectFk(uuid, {})).toBe(uuid);
    expect(resolveProjectFk(uuid, { [uuid]: "outro-uuid-que-nunca-deveria-ganhar" })).toBe(uuid);
  });

  it("uma string que não é uuid continua tratada como id local (comportamento inalterado)", () => {
    expect(resolveProjectFk("qt-1755000000000", { "qt-1755000000000": "quote-uuid-1" })).toBe("quote-uuid-1");
    expect(resolveProjectFk("qt-nao-mapeada", {})).toBeNull();
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

  it("O12 resolvido (Pacote do Flip, Fase B): status 'archived' grava archived=true + status neutro", () => {
    const payload = mapLocalProjectToSupabase(makeProject({ status: "archived" }));
    expect(payload.archived).toBe(true);
    expect(payload.status).toBe("planning");
  });

  it("qualquer outro status grava archived=false, passagem direta", () => {
    const known: Array<Project["status"]> = ["planning", "in_progress", "review", "delivered", "paused", "cancelled"];
    for (const status of known) {
      const payload = mapLocalProjectToSupabase(makeProject({ status }));
      expect(payload.archived).toBe(false);
      expect(payload.status).toBe(status);
    }
  });

  // G37 (Fase D, Caso 5.2) — vermelho: "Gerar projeto" (Vendas) a partir de
  // uma quote NATIVA DA NUVEM (quote.id já é uuid real) espelhava com
  // source="manual", quote_id=null, deliverables=[] — mesmo o projeto local
  // tendo source "orçamento", quoteId real e entregáveis. Reprodução exata
  // do cenário: quoteId chega como uuid (não um id local "qt-..."), não
  // existe em NENHUM import-map (a quote nunca passou pelo import — nasceu
  // direto na nuvem), e o projeto tem 2 deliverables.
  it("G37 — quote nativa da nuvem (quoteId já é uuid): quote_id/source resolvem certo mesmo SEM entrada no import-map", () => {
    const cloudQuoteUuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const project = makeProject({
      source: "orçamento",
      quoteId: cloudQuoteUuid,
      deliverables: [
        { id: "d1", title: "Etapa 1", status: "pendente" },
        { id: "d2", title: "Etapa 2", status: "pendente" },
      ],
    });
    // maps vazio de propósito — a quote nunca foi importada, não tem entrada
    // nenhuma em kora.quotes.supabaseImport.v1. Antes do fix, isso derrubava
    // quote_id/source pro fallback "sem vínculo" mesmo o vínculo sendo real.
    const payload = mapLocalProjectToSupabase(project, EMPTY_PROJECT_IMPORT_MAPS);

    expect(payload.quote_id).toBe(cloudQuoteUuid);
    expect(payload.source).toBe("quote");
    expect(payload.deliverables).toEqual([
      { id: "d1", title: "Etapa 1", status: "pendente" },
      { id: "d2", title: "Etapa 2", status: "pendente" },
    ]);
  });

  it("G37 — deliverables ausente vira [] (nunca undefined — coluna é NOT NULL)", () => {
    const payload = mapLocalProjectToSupabase(makeProject({ deliverables: undefined }));
    expect(payload.deliverables).toEqual([]);
  });
});

describe("translateLocalProjectStatusToCloud — item 1 da Fase B, resolve O12", () => {
  it("'archived' -> texto neutro 'planning' + archived: true", () => {
    expect(translateLocalProjectStatusToCloud("archived")).toEqual({ status: "planning", archived: true });
  });

  it("os outros 6 valores fazem passagem direta, archived sempre false", () => {
    const known: Array<Project["status"]> = ["planning", "in_progress", "review", "delivered", "paused", "cancelled"];
    for (const status of known) {
      expect(translateLocalProjectStatusToCloud(status)).toEqual({ status, archived: false });
    }
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
