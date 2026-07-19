// Etapa 5 · Fatia 2 (opportunities) — A1: re-mapeamento seguro das FKs.
// É AQUI que o bug bloqueante morava: quote_id/converted_client_id iam como id LOCAL cru
// para colunas `uuid` (→ "invalid input syntax for type uuid" no INSERT). O mapper agora
// resolve via import-maps: mapeado → UUID; não-mapeado/ausente → null; NUNCA id local cru.
//
// Ver docs/qa/etapa-5-fatia-2-opportunities.md (A1).
import { describe, it, expect } from "vitest";

import type { Lead } from "@/hooks/useLeads";
import { mapLocalLeadToSupabaseOpportunity } from "@/services/crm/crmOpportunityMapper";

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
