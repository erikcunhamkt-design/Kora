import { describe, it, expect } from "vitest";

import type { Quote, QuoteItem } from "@/hooks/useQuotes";
import type {
  SupabaseQuote,
  SupabaseQuoteItem,
} from "@/repositories/quotesRepository";
import {
  EMPTY_QUOTE_IMPORT_MAPS,
  mapLocalQuoteItemToSupabaseItem,
  mapLocalQuoteToSupabaseQuote,
  mapSupabaseQuoteItemToLocalItem,
  mapSupabaseQuoteToLocalQuote,
  resolveQuoteFk,
  translateCloudStatusToLocal,
  translateLocalStatusToCloud,
} from "@/services/quotes/quoteMapper";

function baseQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q0",
    clientName: "Cliente",
    clientEmail: "c@x.com",
    clientWhatsapp: "",
    title: "Orcamento",
    description: "",
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 0,
    status: "rascunho",
    createdAt: "2026-07-01",
    ...overrides,
  };
}

describe("quoteMapper — quote", () => {
  it("maps a local Quote to the Supabase insert shape", () => {
    const quote = baseQuote({
      clientName: "Acme Ltda",
      clientEmail: "contato@acme.com",
      title: "Website institucional",
      description: "Projeto de site",
      subtotal: 1000,
      discount: 100,
      total: 900,
      status: "enviado",
    });

    expect(mapLocalQuoteToSupabaseQuote(quote)).toMatchObject({
      client_name: "Acme Ltda",
      client_email: "contato@acme.com",
      title: "Website institucional",
      description: "Projeto de site",
      subtotal: 1000,
      discount: 100,
      total: 900,
      // Etapa 5 · Fatia 9 (Q9): status agora sai traduzido pro vocabulário da
      // nuvem — "enviado" vira "sent", nunca mais o literal PT cru (achado §8.0).
      status: "sent",
      archived: false,
    });
  });

  it("derives archived=true only when status is 'arquivado'", () => {
    expect(mapLocalQuoteToSupabaseQuote(baseQuote({ status: "arquivado" })).archived).toBe(true);
    expect(mapLocalQuoteToSupabaseQuote(baseQuote({ status: "aprovado" })).archived).toBe(false);
  });

  it("maps a SupabaseQuote back to the local Quote type", () => {
    const sq: SupabaseQuote = {
      id: "q1",
      workspace_id: "w1",
      client_name: "Acme Ltda",
      client_email: "contato@acme.com",
      title: "Website institucional",
      description: "Projeto de site",
      subtotal: 1000,
      discount: 100,
      total: 900,
      status: "enviado",
      created_at: "2026-07-01T12:34:56.000Z",
      updated_at: "2026-07-01T12:34:56.000Z",
      archived: false,
      approved_at: null,
      rejected_at: null,
    };

    const local = mapSupabaseQuoteToLocalQuote(sq);

    expect(local.id).toBe("q1");
    expect(local.clientName).toBe("Acme Ltda");
    expect(local.title).toBe("Website institucional");
    expect(local.subtotal).toBe(1000);
    expect(local.total).toBe(900);
    expect(local.status).toBe("enviado");
    // created_at is truncated to a YYYY-MM-DD date.
    expect(local.createdAt).toBe("2026-07-01");
    expect(local.items).toEqual([]);
  });

  it("coerces numeric strings and null text fields on the way back", () => {
    // PostgREST can return numeric columns as strings; the mapper's Number()
    // coercions and ?? "" fallbacks must normalize them.
    const sq = {
      id: "q2",
      workspace_id: "w1",
      client_name: null,
      client_email: null,
      title: "Sem cliente",
      description: null,
      subtotal: "250.5",
      discount: "0",
      total: "250.5",
      status: "rascunho",
      created_at: "2026-07-02T00:00:00.000Z",
      updated_at: "2026-07-02T00:00:00.000Z",
      archived: false,
    } as unknown as SupabaseQuote;

    const local = mapSupabaseQuoteToLocalQuote(sq);

    expect(local.clientName).toBe("");
    expect(local.clientEmail).toBe("");
    expect(local.description).toBe("");
    expect(local.subtotal).toBe(250.5);
    expect(typeof local.subtotal).toBe("number");
  });

  it("round-trips core fields: local -> supabase -> local", () => {
    const original = baseQuote({
      id: "q3",
      clientName: "Beta SA",
      clientEmail: "beta@sa.com",
      title: "App mobile",
      description: "Aplicativo",
      subtotal: 5000,
      discount: 500,
      total: 4500,
      status: "aprovado",
    });

    const sq = {
      ...mapLocalQuoteToSupabaseQuote(original),
      id: original.id,
      workspace_id: "w1",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      approved_at: null,
      rejected_at: null,
    } as SupabaseQuote;

    const back = mapSupabaseQuoteToLocalQuote(sq);

    expect(back.clientName).toBe(original.clientName);
    expect(back.clientEmail).toBe(original.clientEmail);
    expect(back.title).toBe(original.title);
    expect(back.description).toBe(original.description);
    expect(back.subtotal).toBe(original.subtotal);
    expect(back.discount).toBe(original.discount);
    expect(back.total).toBe(original.total);
    expect(back.status).toBe(original.status);
  });
});

describe("quoteMapper — item", () => {
  it("maps a local QuoteItem to a Supabase item", () => {
    const item: QuoteItem = { id: "i1", name: "Design", quantity: 2, unitPrice: 150 };

    expect(mapLocalQuoteItemToSupabaseItem(item)).toEqual({
      service_id: undefined,
      name: "Design",
      quantity: 2,
      unit_price: 150,
    });
  });

  it("maps a Supabase item back and coerces unit_price to a number", () => {
    const si = {
      id: "i1",
      quote_id: "q1",
      name: "Design",
      quantity: 2,
      unit_price: "150.75",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    } as unknown as SupabaseQuoteItem;

    const local = mapSupabaseQuoteItemToLocalItem(si);

    expect(local).toEqual({ id: "i1", name: "Design", quantity: 2, unitPrice: 150.75 });
    expect(typeof local.unitPrice).toBe("number");
  });

  it("round-trips a QuoteItem: local -> supabase -> local", () => {
    const original: QuoteItem = {
      id: "i2",
      name: "Hospedagem",
      quantity: 1,
      unitPrice: 99.9,
    };

    const mapped = mapLocalQuoteItemToSupabaseItem(original);
    const back = mapSupabaseQuoteItemToLocalItem({
      ...mapped,
      id: original.id,
      quote_id: "q1",
      service_id: mapped.service_id ?? null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    } as SupabaseQuoteItem);

    expect(back.name).toBe(original.name);
    expect(back.quantity).toBe(original.quantity);
    expect(back.unitPrice).toBe(original.unitPrice);
  });
});

describe("quoteMapper — fan-out de FKs (Q4)", () => {
  it("caso 1: mapeado → UUID (client_id e opportunity_id)", () => {
    const quote = { ...baseQuote({ clientId: 950001 }), leadId: "lead9" };
    const out = mapLocalQuoteToSupabaseQuote(quote, {
      clients: { "950001": "uuid-cli" },
      opportunities: { lead9: "uuid-opp" },
    });
    expect(out.client_id).toBe("uuid-cli");
    expect(out.opportunity_id).toBe("uuid-opp");
  });

  it("caso 2: não-mapeado → null, NUNCA o id local cru", () => {
    const quote = { ...baseQuote({ clientId: 950999 }), leadId: "leadX" };
    const out = mapLocalQuoteToSupabaseQuote(quote, { clients: { "111": "x" }, opportunities: {} });
    expect(out.client_id).toBeNull();
    expect(out.opportunity_id).toBeNull();
    // garantia central: jamais o id local cru numa coluna uuid
    expect(out.client_id).not.toBe("950999");
    expect(out.client_id).not.toBe(950999);
    expect(out.opportunity_id).not.toBe("leadX");
  });

  it("caso 3: sem maps (default) → null", () => {
    const quote = { ...baseQuote({ clientId: 950001 }), leadId: "lead9" };
    expect(mapLocalQuoteToSupabaseQuote(quote, EMPTY_QUOTE_IMPORT_MAPS).client_id).toBeNull();
    expect(mapLocalQuoteToSupabaseQuote(quote).opportunity_id).toBeNull();
  });

  it("usa opportunityId numérico como fallback quando não há leadId", () => {
    const out = mapLocalQuoteToSupabaseQuote(baseQuote({ opportunityId: 42 }), {
      clients: {},
      opportunities: { "42": "uuid-opp-42" },
    });
    expect(out.opportunity_id).toBe("uuid-opp-42");
  });
});

describe("quoteMapper — precisão monetária (Q5)", () => {
  it("quantiza dinheiro a centavos (mata artefato de float)", () => {
    const out = mapLocalQuoteToSupabaseQuote(baseQuote({ subtotal: 0.1 + 0.2, discount: 1.005, total: 12.349 }));
    expect(out.subtotal).toBe(0.3);
    expect(out.discount).toBe(1.01);
    expect(out.total).toBe(12.35);
  });

  it("preserva quantity fracionária (Q5b: schema é numeric) e quantiza unit_price", () => {
    const out = mapLocalQuoteItemToSupabaseItem({ id: "i", name: "Hora", quantity: 1.5, unitPrice: 10.009 } as QuoteItem);
    expect(out.quantity).toBe(1.5); // NÃO arredonda mais a inteiro (Q5b)
    expect(out.unit_price).toBe(10.01);
  });

  it("quantiza quantity a 3 casas quando a fração local tem mais precisão", () => {
    const out = mapLocalQuoteItemToSupabaseItem({ id: "i", name: "Consultoria", quantity: 1.23456, unitPrice: 10 } as QuoteItem);
    expect(out.quantity).toBe(1.235);
  });

  it("mantém quantity inteira intacta (regressão)", () => {
    const out = mapLocalQuoteItemToSupabaseItem({ id: "i", name: "Peça", quantity: 3, unitPrice: 10 } as QuoteItem);
    expect(out.quantity).toBe(3);
  });
});

// Etapa 5 · Fatia 9 (Q8) — os 6 campos sem coluna antes desta fatia. Ver
// docs/qa/etapa-5-fatia-9-quotes-cutover.md §2 (uso real confirmado por grep).
describe("quoteMapper — Q8 (paridade de schema, 6 campos)", () => {
  it("local -> nuvem: envia os 6 campos preenchidos", () => {
    const quote = baseQuote({
      clientWhatsapp: "(11) 99999-9999",
      company: "Acme Ltda",
      paymentCondition: "À vista no Pix",
      deliveryDeadline: "15 dias",
      validityDays: 30,
      notes: "Observações do orçamento",
    });
    const out = mapLocalQuoteToSupabaseQuote(quote);
    expect(out.client_whatsapp).toBe("(11) 99999-9999");
    expect(out.company).toBe("Acme Ltda");
    expect(out.payment_condition).toBe("À vista no Pix");
    expect(out.delivery_deadline).toBe("15 dias");
    expect(out.validity_days).toBe(30);
    expect(out.notes).toBe("Observações do orçamento");
  });

  it("local -> nuvem: string vazia vira null, não \"\" (0 permanece 0, não vira null)", () => {
    const out = mapLocalQuoteToSupabaseQuote(
      baseQuote({ clientWhatsapp: "", company: undefined, paymentCondition: "", validityDays: 0, notes: undefined }),
    );
    expect(out.client_whatsapp).toBeNull();
    expect(out.company).toBeNull();
    expect(out.payment_condition).toBeNull();
    expect(out.validity_days).toBe(0);
    expect(out.notes).toBeNull();
  });

  it("nuvem -> local: lê os 6 campos de volta corretos", () => {
    const sq: SupabaseQuote = {
      id: "q4",
      workspace_id: "w1",
      title: "Com Q8",
      subtotal: 100,
      discount: 0,
      total: 100,
      status: "draft",
      created_at: "2026-07-23T00:00:00.000Z",
      updated_at: "2026-07-23T00:00:00.000Z",
      archived: false,
      client_whatsapp: "(11) 98888-8888",
      company: "Beta SA",
      payment_condition: "30/60/90",
      delivery_deadline: "30 dias",
      validity_days: 20,
      notes: "czcszc",
    };
    const local = mapSupabaseQuoteToLocalQuote(sq);
    expect(local.clientWhatsapp).toBe("(11) 98888-8888");
    expect(local.company).toBe("Beta SA");
    expect(local.paymentCondition).toBe("30/60/90");
    expect(local.deliveryDeadline).toBe("30 dias");
    expect(local.validityDays).toBe(20);
    expect(local.notes).toBe("czcszc");
  });

  it("nuvem -> local: linha pré-migration (6 campos NULL) não quebra — vira \"\"/0, nunca undefined/crash", () => {
    const sq = {
      id: "q5",
      workspace_id: "w1",
      title: "Pré-Q8",
      subtotal: 0,
      discount: 0,
      total: 0,
      status: "draft",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      archived: false,
      client_whatsapp: null,
      company: null,
      payment_condition: null,
      delivery_deadline: null,
      validity_days: null,
      notes: null,
    } as unknown as SupabaseQuote;
    const local = mapSupabaseQuoteToLocalQuote(sq);
    expect(local.clientWhatsapp).toBe("");
    expect(local.paymentCondition).toBe("");
    expect(local.deliveryDeadline).toBe("");
    expect(local.validityDays).toBe(0);
    expect(local.company).toBeUndefined();
    expect(local.notes).toBeUndefined();
  });

  it("round-trip completo: local -> nuvem -> local preserva os 6 campos", () => {
    const original = baseQuote({
      clientWhatsapp: "(21) 97777-7777",
      company: "Gama ME",
      paymentCondition: "Parcelado 3x",
      deliveryDeadline: "45 dias",
      validityDays: 10,
      notes: "Observação final",
    });
    const payload = mapLocalQuoteToSupabaseQuote(original);
    const sq = {
      ...payload,
      id: "q6",
      workspace_id: "w1",
      created_at: "2026-07-23T00:00:00.000Z",
      updated_at: "2026-07-23T00:00:00.000Z",
    } as SupabaseQuote;
    const back = mapSupabaseQuoteToLocalQuote(sq);
    expect(back.clientWhatsapp).toBe(original.clientWhatsapp);
    expect(back.company).toBe(original.company);
    expect(back.paymentCondition).toBe(original.paymentCondition);
    expect(back.deliveryDeadline).toBe(original.deliveryDeadline);
    expect(back.validityDays).toBe(original.validityDays);
    expect(back.notes).toBe(original.notes);
  });
});

// Etapa 5 · Fatia 9 (Q9) — tradução bidirecional de status, incluindo o achado
// §8.0 (passthrough legado) e o terceiro caso (status desconhecido, nunca
// oculto — docs/qa/etapa-5-fatia-9-quotes-cutover.md §9a).
describe("quoteMapper — Q9 (tradução de status PT<->EN)", () => {
  it("local -> nuvem: os 4 status vivos traduzem para o literal em inglês", () => {
    expect(translateLocalStatusToCloud("rascunho")).toEqual({ status: "draft", archived: false });
    expect(translateLocalStatusToCloud("enviado")).toEqual({ status: "sent", archived: false });
    expect(translateLocalStatusToCloud("aprovado")).toEqual({ status: "approved", archived: false });
    expect(translateLocalStatusToCloud("recusado")).toEqual({ status: "rejected", archived: false });
  });

  it("local -> nuvem: \"arquivado\" vira archived=true + status neutro, nunca um 7º literal", () => {
    expect(translateLocalStatusToCloud("arquivado")).toEqual({ status: "draft", archived: true });
  });

  it("local -> nuvem: \"vencido\" (estado impossível — é sempre computado, nunca armazenado) tem fallback seguro", () => {
    expect(translateLocalStatusToCloud("vencido")).toEqual({ status: "draft", archived: false });
  });

  it("nuvem -> local: os 4 literais em inglês traduzem para o vocabulário local", () => {
    expect(translateCloudStatusToLocal("draft", false)).toEqual({ status: "rascunho" });
    expect(translateCloudStatusToLocal("sent", false)).toEqual({ status: "enviado" });
    expect(translateCloudStatusToLocal("approved", false)).toEqual({ status: "aprovado" });
    expect(translateCloudStatusToLocal("rejected", false)).toEqual({ status: "recusado" });
  });

  it("nuvem -> local: archived=true SEMPRE vence, independente do status bruto por baixo", () => {
    expect(translateCloudStatusToLocal("approved", true)).toEqual({ status: "arquivado" });
    expect(translateCloudStatusToLocal("draft", true)).toEqual({ status: "arquivado" });
    expect(translateCloudStatusToLocal("qualquer-coisa-invalida", true)).toEqual({ status: "arquivado" });
  });

  it("achado §8.0 — passthrough legado: literais PT crus (gravados antes desta fatia) são reconhecidos sem backfill", () => {
    expect(translateCloudStatusToLocal("rascunho", false)).toEqual({ status: "rascunho" });
    expect(translateCloudStatusToLocal("enviado", false)).toEqual({ status: "enviado" });
    expect(translateCloudStatusToLocal("aprovado", false)).toEqual({ status: "aprovado" });
    expect(translateCloudStatusToLocal("recusado", false)).toEqual({ status: "recusado" });
  });

  it("terceiro caso — status desconhecido: fallback seguro + cloudStatusRaw preenchido, NUNCA oculto silenciosamente", () => {
    const result = translateCloudStatusToLocal("pending_review", false);
    expect(result.status).toBe("rascunho");
    expect(result.cloudStatusRaw).toBe("pending_review");
  });

  it("terceiro caso não ocorre quando archived=true (arquivado vence antes de checar o mapa)", () => {
    const result = translateCloudStatusToLocal("valor-desconhecido", true);
    expect(result.status).toBe("arquivado");
    expect(result.cloudStatusRaw).toBeUndefined();
  });

  it("status null/undefined da nuvem cai no terceiro caso, sem crash", () => {
    expect(translateCloudStatusToLocal(null, false)).toEqual({ status: "rascunho", cloudStatusRaw: undefined });
    expect(translateCloudStatusToLocal(undefined, false)).toEqual({ status: "rascunho", cloudStatusRaw: undefined });
  });

  it("mapSupabaseQuoteToLocalQuote propaga cloudStatusRaw pro objeto Quote completo", () => {
    const sq = {
      id: "q7",
      workspace_id: "w1",
      title: "Status estranho",
      subtotal: 0,
      discount: 0,
      total: 0,
      status: "in_negotiation",
      created_at: "2026-07-23T00:00:00.000Z",
      updated_at: "2026-07-23T00:00:00.000Z",
      archived: false,
    } as unknown as SupabaseQuote;
    const local = mapSupabaseQuoteToLocalQuote(sq);
    expect(local.status).toBe("rascunho");
    expect(local.cloudStatusRaw).toBe("in_negotiation");
  });

  it("mapSupabaseQuoteToLocalQuote não seta cloudStatusRaw para status reconhecido (undefined, não string vazia)", () => {
    const sq = {
      id: "q8",
      workspace_id: "w1",
      title: "Status normal",
      subtotal: 0,
      discount: 0,
      total: 0,
      status: "approved",
      created_at: "2026-07-23T00:00:00.000Z",
      updated_at: "2026-07-23T00:00:00.000Z",
      archived: false,
    } as unknown as SupabaseQuote;
    const local = mapSupabaseQuoteToLocalQuote(sq);
    expect(local.status).toBe("aprovado");
    expect(local.cloudStatusRaw).toBeUndefined();
  });

  it("round-trip: local -> nuvem -> local preserva o status pros 4 estados vivos", () => {
    for (const status of ["rascunho", "enviado", "aprovado", "recusado"] as const) {
      const payload = mapLocalQuoteToSupabaseQuote(baseQuote({ status }));
      const back = translateCloudStatusToLocal(payload.status, payload.archived);
      expect(back.status).toBe(status);
      expect(back.cloudStatusRaw).toBeUndefined();
    }
  });
});

// G68 (docs/architecture/kora-hub-auditoria-e-plano.md, `etapa-5-auditoria-g37-espelhos.md`
// §2) — mesmo molde literal de resolveProjectFk/resolveFinanceFk/resolveTaskFk pós-G37:
// resolveQuoteFk não tinha o passthrough de UUID antes deste fix.
describe("quoteMapper — resolveQuoteFk (G68, passthrough de UUID)", () => {
  it("já sendo um uuid válido, passa direto — nunca procura no import-map", () => {
    const uuid = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";
    expect(resolveQuoteFk(uuid, {})).toBe(uuid);
    expect(resolveQuoteFk(uuid, { [uuid]: "outro-uuid-que-nunca-deveria-ganhar" })).toBe(uuid);
  });

  it("uma string que não é uuid continua tratada como id local (comportamento inalterado)", () => {
    expect(resolveQuoteFk("q-local-1", { "q-local-1": "uuid-real-1" })).toBe("uuid-real-1");
    expect(resolveQuoteFk("q-local-nao-mapeada", {})).toBeNull();
  });

  it("clientId/opportunityId já-uuid atravessam mapLocalQuoteToSupabaseQuote inteiro, mesmo com maps vazios", () => {
    const uuid1 = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";
    const uuid2 = "b2c3d4e5-f6a7-4890-b123-c4d5e6f78901";
    const out = mapLocalQuoteToSupabaseQuote(
      { ...baseQuote({ clientId: uuid1 as unknown as number }), opportunityId: uuid2 as unknown as number },
      EMPTY_QUOTE_IMPORT_MAPS,
    );
    expect(out.client_id).toBe(uuid1);
    expect(out.opportunity_id).toBe(uuid2);
  });
});

// G68 — approved_at/rejected_at tinham coluna real e campo local genuinamente
// populado (useQuotes.ts:226-227), mas o mapper de import/criação nativa nunca
// enviava — um orçamento já aprovado localmente perdia a data ao ser
// importado/criado na nuvem.
describe("quoteMapper — approved_at/rejected_at (G68)", () => {
  it("envia approved_at quando o orçamento local já foi aprovado", () => {
    const approvedAt = "2026-07-15T10:00:00.000Z";
    const out = mapLocalQuoteToSupabaseQuote(baseQuote({ status: "aprovado", approvedAt }));
    expect(out.approved_at).toBe(approvedAt);
    expect(out.rejected_at).toBeNull();
  });

  it("envia rejected_at quando o orçamento local já foi recusado", () => {
    const rejectedAt = "2026-07-16T10:00:00.000Z";
    const out = mapLocalQuoteToSupabaseQuote(baseQuote({ status: "recusado", rejectedAt }));
    expect(out.rejected_at).toBe(rejectedAt);
    expect(out.approved_at).toBeNull();
  });

  it("orçamento nunca aprovado/recusado -> os 2 campos saem null, nunca undefined", () => {
    const out = mapLocalQuoteToSupabaseQuote(baseQuote({ status: "rascunho" }));
    expect(out.approved_at).toBeNull();
    expect(out.rejected_at).toBeNull();
  });
});
