// Etapa 5 · Fatia 7 (projects/tasks) — testes do mapper: fan-out (3 maps), e o
// requisito de implementação do §7.2/veredito de Fase B: a tradução de vocabulário
// "orçamento" -> "quote" (sem ela, ux_projects_from_quote vira índice decorativo).
import { describe, it, expect } from "vitest";
import {
  mapLocalProjectToSupabase,
  resolveProjectFk,
  resolveCloudProjectSource,
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
});
