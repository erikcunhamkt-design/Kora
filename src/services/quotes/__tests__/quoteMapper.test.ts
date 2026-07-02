import { describe, it, expect } from "vitest";

import type { Quote, QuoteItem } from "@/hooks/useQuotes";
import type {
  SupabaseQuote,
  SupabaseQuoteItem,
} from "@/repositories/quotesRepository";
import {
  mapLocalQuoteItemToSupabaseItem,
  mapLocalQuoteToSupabaseQuote,
  mapSupabaseQuoteItemToLocalItem,
  mapSupabaseQuoteToLocalQuote,
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
      status: "enviado",
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
