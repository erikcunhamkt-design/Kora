// Etapa 5 · Fatia 2 (opportunities) — A1: re-mapeamento seguro das FKs.
// É AQUI que o bug bloqueante morava: quote_id/converted_client_id iam como id LOCAL cru
// para colunas `uuid` (→ "invalid input syntax for type uuid" no INSERT). O mapper agora
// resolve via import-maps: mapeado → UUID; não-mapeado/ausente → null; NUNCA id local cru.
//
// Ver docs/qa/etapa-5-fatia-2-opportunities.md (A1).
import { describe, it, expect, vi } from "vitest";

import type { Lead } from "@/hooks/useLeads";
import type { SupabaseOpportunity } from "@/repositories/crmOpportunitiesRepository";
import {
  mapLocalLeadToSupabaseOpportunity,
  mapSupabaseOpportunityToLocalLead,
} from "@/services/crm/crmOpportunityMapper";

function baseLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1,
    name: "Oportunidade X",
    company: "Acme",
    email: "a@x.com",
    phone: "11999999999",
    serviceType: "Branding",
    estimatedValue: 1000,
    priority: "média",
    lastInteraction: "2026-07-01",
    stage: "lead",
    description: "",
    history: [],
    notes: "",
    ...overrides,
  };
}

describe("mapLocalLeadToSupabaseOpportunity — re-mapeamento de FKs (A1)", () => {
  it("traduz client_id / quote_id / converted_client_id de id local para UUID via maps", () => {
    const lead = baseLead({ clientId: 5, quoteId: "qt-1", convertedClientId: 9 });

    const out = mapLocalLeadToSupabaseOpportunity(lead, {
      clients: { "5": "uuid-client-5", "9": "uuid-conv-9" },
      quotes: { "qt-1": "uuid-quote-1" },
    });

    expect(out.client_id).toBe("uuid-client-5");
    expect(out.quote_id).toBe("uuid-quote-1");
    expect(out.converted_client_id).toBe("uuid-conv-9");
  });

  it("id local NÃO mapeado vira null — nunca o id local cru (evita insert em coluna uuid)", () => {
    const lead = baseLead({ clientId: 5, quoteId: "qt-x", convertedClientId: 9 });

    const out = mapLocalLeadToSupabaseOpportunity(lead, { clients: {}, quotes: {} });

    expect(out.client_id).toBeNull();
    expect(out.quote_id).toBeNull();
    expect(out.converted_client_id).toBeNull();
    // Garantia explícita contra a regressão do bug: o id local jamais vaza.
    expect(out.client_id).not.toBe("5");
    expect(out.quote_id).not.toBe("qt-x");
    expect(out.converted_client_id).not.toBe("9");
  });

  it("sem argumento de maps (default) → todas as FKs null", () => {
    const lead = baseLead({ clientId: 5, quoteId: "qt-1", convertedClientId: 9 });

    const out = mapLocalLeadToSupabaseOpportunity(lead);

    expect(out.client_id).toBeNull();
    expect(out.quote_id).toBeNull();
    expect(out.converted_client_id).toBeNull();
  });

  it("remapeamento parcial: cliente mapeado, orçamento não → quote_id null", () => {
    const lead = baseLead({ clientId: 5, quoteId: "qt-x" });

    const out = mapLocalLeadToSupabaseOpportunity(lead, {
      clients: { "5": "uuid-client-5" },
      quotes: {},
    });

    expect(out.client_id).toBe("uuid-client-5");
    expect(out.quote_id).toBeNull();
  });

  it("lead sem referências → FKs null e campos base preservados", () => {
    const lead = baseLead({ name: "Sem FK", estimatedValue: 2500 });

    const out = mapLocalLeadToSupabaseOpportunity(lead, { clients: { "5": "x" }, quotes: {} });

    expect(out.client_id).toBeNull();
    expect(out.quote_id).toBeNull();
    expect(out.converted_client_id).toBeNull();
    expect(out.title).toBe("Sem FK");
    expect(out.potential_value).toBe(2500);
  });
});

// G57 — mapLocalLeadToSupabaseOpportunity (caminho de IMPORT) tinha
// `won_at: lead.wonAt || (...)`: preservava um `wonAt` local já truthy mesmo
// quando o `stage` atual não é mais "fechado" — nunca limpava, ao contrário
// de crmOpportunitiesRepository.moveOpportunityStage (o caminho PRIMÁRIO de
// mudança de stage), que zera won_at/lost_at/lost_reason nas 3 direções.
// Inofensivo até hoje porque nenhum caminho local grava Lead.wonAt (só a
// leitura da nuvem o popula) — mas um caminho SECUNDÁRIO (import) não pode
// depender de uma pré-condição implícita de outro módulo pra estar correto.
describe("mapLocalLeadToSupabaseOpportunity — G57 (won_at limpo ao sair de 'fechado')", () => {
  it("stage !== 'fechado' com wonAt local já preenchido (round-trip) → won_at sai null, nunca preserva o valor stale", () => {
    const lead = baseLead({ stage: "perdido", wonAt: "2026-07-01T00:00:00.000Z" });
    const out = mapLocalLeadToSupabaseOpportunity(lead);
    expect(out.won_at).toBeNull();
  });

  it("stage 'lead'/'contato'/'proposta'/'negociacao' com wonAt stale → sempre null (mesma classe, todas as direções não-fechado)", () => {
    for (const stage of ["lead", "contato", "proposta", "negociacao"] as const) {
      const out = mapLocalLeadToSupabaseOpportunity(baseLead({ stage, wonAt: "2026-06-01T00:00:00.000Z" }));
      expect(out.won_at).toBeNull();
    }
  });

  it("stage 'fechado' sem wonAt prévio → seta timestamp novo (comportamento existente preservado)", () => {
    const out = mapLocalLeadToSupabaseOpportunity(baseLead({ stage: "fechado" }));
    expect(out.won_at).not.toBeNull();
    expect(typeof out.won_at).toBe("string");
  });

  // Cenário HIPOTÉTICO — só ocorre se `lead.wonAt` já chegar preenchido no
  // objeto Lead ANTES da chamada (ex.: um lead lido da nuvem, com wonAt já
  // populado por mapSupabaseOpportunityToLocalLead, reimportado sem edição).
  // NÃO é o caminho real de useLocalOpportunitiesImport.ts hoje — ver o
  // teste seguinte para o comportamento real de reimport.
  it("stage 'fechado' COM wonAt já preenchido no objeto Lead recebido → preserva esse valor, não reseta pra agora", () => {
    const original = "2026-05-15T10:00:00.000Z";
    const out = mapLocalLeadToSupabaseOpportunity(baseLead({ stage: "fechado", wonAt: original }));
    expect(out.won_at).toBe(original);
  });

  // G57 — achado do revisor (não coberto na 1ª rodada do fix): a "idempotência
  // do import" só existe SE `lead.wonAt` já vier preenchido (teste acima) — mas
  // `Lead.wonAt` NUNCA é escrito por nenhum caminho local (useLeads.ts/CRM.tsx,
  // confirmado por grep exaustivo), só populado ao LER da nuvem
  // (mapSupabaseOpportunityToLocalLead). No fluxo real de reimport
  // (useLocalOpportunitiesImport.ts:180, `raw: local` vindo direto de
  // `useLeads()`), `lead.wonAt` é sempre `undefined` — então reimportar o
  // MESMO lead "fechado" 2x GERA um `won_at` NOVO a cada vez. Não há guarda
  // em `crmOpportunitiesRepository.upsertImportedOpportunity` (:146-162, `
  // .upsert()` cru, sem leitura prévia da linha existente) que preserve o
  // valor já gravado na nuvem. Prova disso, não do contrário:
  it("reimportar o MESMO lead fechado 2x (wonAt local sempre undefined, como no fluxo real) GERA um won_at novo a cada vez — sem guarda de idempotência", () => {
    vi.useFakeTimers();
    try {
      // Mesmo objeto Lead nas duas chamadas — Lead.wonAt nunca é escrito
      // localmente entre uma "importação" e a próxima (mesma limitação do
      // fluxo real: useLeads() nunca popula esse campo).
      const lead = baseLead({ stage: "fechado" });

      vi.setSystemTime(new Date("2026-08-01T10:00:00.000Z"));
      const firstImport = mapLocalLeadToSupabaseOpportunity(lead);

      vi.setSystemTime(new Date("2026-08-02T10:00:00.000Z"));
      const secondImport = mapLocalLeadToSupabaseOpportunity(lead);

      expect(firstImport.won_at).toBe("2026-08-01T10:00:00.000Z");
      expect(secondImport.won_at).toBe("2026-08-02T10:00:00.000Z");
      expect(secondImport.won_at).not.toBe(firstImport.won_at);
    } finally {
      vi.useRealTimers();
    }
  });
});

// Etapa 5 · Fatia 8 (cutover de escrita) — O1: tags/history (migration
// 20260723000100) fazem o round-trip completo local↔nuvem, sem zerar em
// nenhuma direção. Antes desta fatia, o sentido nuvem→local hardcodava
// `history: []` e não existia campo nenhum para `tags`. Ver
// docs/qa/etapa-5-fatia-8-crm-cutover.md §6.2.
function baseSupabaseOpportunity(overrides: Partial<SupabaseOpportunity> = {}): SupabaseOpportunity {
  return {
    id: "opp-uuid-1",
    workspace_id: "ws-1",
    client_id: null,
    title: "Oportunidade Teste",
    company: null,
    contact_name: null,
    email: null,
    phone: null,
    whatsapp: null,
    stage: "lead",
    status: "open",
    source: null,
    temperature: null,
    priority: null,
    potential_value: 1000,
    probability: null,
    next_action: null,
    next_action_date: null,
    expected_close_date: null,
    notes: null,
    quote_id: null,
    quote_title: null,
    converted_client_id: null,
    won_at: null,
    lost_at: null,
    lost_reason: null,
    is_demo: false,
    archived: false,
    source_local_id: null,
    tags: null,
    history: null,
    created_at: "2026-07-23T00:00:00Z",
    updated_at: "2026-07-23T00:00:00Z",
    ...overrides,
  };
}

describe("mapLocalLeadToSupabaseOpportunity — O1 (tags/history)", () => {
  it("grava tags e history quando o lead local tem os dois preenchidos", () => {
    const lead = baseLead({
      tags: ["vip", "urgente"],
      history: [{ date: "2026-07-20", text: "Primeiro contato" }],
    });
    const out = mapLocalLeadToSupabaseOpportunity(lead);
    expect(out.tags).toEqual(["vip", "urgente"]);
    expect(out.history).toEqual([{ date: "2026-07-20", text: "Primeiro contato" }]);
  });

  it("tags ausente/vazio vira null (coluna sem default); history ausente vira [] (coluna com default '[]')", () => {
    const semTags = mapLocalLeadToSupabaseOpportunity(baseLead({ tags: undefined, history: [] }));
    expect(semTags.tags).toBeNull();
    expect(semTags.history).toEqual([]);

    const tagsVazio = mapLocalLeadToSupabaseOpportunity(baseLead({ tags: [] }));
    expect(tagsVazio.tags).toBeNull();
  });
});

describe("mapSupabaseOpportunityToLocalLead — O1 (tags/history)", () => {
  it("lê de volta tags e history gravados — antes desta fatia, history era hardcoded [] aqui", () => {
    const opportunity = baseSupabaseOpportunity({
      tags: ["vip", "urgente"],
      history: [{ date: "2026-07-20", text: "Primeiro contato" }],
    });
    const lead = mapSupabaseOpportunityToLocalLead(opportunity);
    expect(lead.tags).toEqual(["vip", "urgente"]);
    expect(lead.history).toEqual([{ date: "2026-07-20", text: "Primeiro contato" }]);
  });

  it("linha pré-migration (tags/history NULL no banco) não quebra — history vira [], tags vira undefined", () => {
    const lead = mapSupabaseOpportunityToLocalLead(baseSupabaseOpportunity({ tags: null, history: null }));
    expect(lead.history).toEqual([]);
    expect(lead.tags).toBeUndefined();
  });

  it("round-trip completo: local -> Supabase -> local preserva tags e history", () => {
    const original = baseLead({
      tags: ["a", "b", "c"],
      history: [
        { date: "2026-07-01", text: "Criado" },
        { date: "2026-07-10", text: "Follow-up" },
      ],
    });
    const payload = mapLocalLeadToSupabaseOpportunity(original);
    const roundTripped = mapSupabaseOpportunityToLocalLead(
      baseSupabaseOpportunity({ tags: payload.tags ?? null, history: payload.history ?? null }),
    );
    expect(roundTripped.tags).toEqual(original.tags);
    expect(roundTripped.history).toEqual(original.history);
  });
});
