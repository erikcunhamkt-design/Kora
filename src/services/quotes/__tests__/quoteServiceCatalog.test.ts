// G96/G98 — regras puras catálogo↔orçamento (uuid real nas fixtures).
import { describe, it, expect } from "vitest";
import { countServiceUsage, isServiceSelectableInQuotes } from "@/services/quotes/quoteServiceCatalog";
import { mapSupabaseQuoteItemToLocalItem } from "@/services/quotes/quoteMapper";
import type { Quote } from "@/hooks/useQuotes";
import type { SupabaseQuoteItem } from "@/repositories/quotesRepository";

const SVC_A = "3f2b7c1e-9a4d-4e8b-8c55-1d2e3f4a5b6c";
const SVC_B = "9c8b7a6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

describe("G96 — isServiceSelectableInQuotes (availableInQuotes passa a ser honrado)", () => {
  it("ativo + availableInQuotes=true → oferecido", () => {
    expect(isServiceSelectableInQuotes({ active: true, availableInQuotes: true })).toBe(true);
  });
  it("ativo + availableInQuotes=false → escondido (antes o toggle gravava e ninguém lia)", () => {
    expect(isServiceSelectableInQuotes({ active: true, availableInQuotes: false })).toBe(false);
  });
  it("serviço legado sem o campo (undefined) → oferecido (só o false explícito esconde)", () => {
    expect(isServiceSelectableInQuotes({ active: true })).toBe(true);
  });
  it("inativo → escondido, mesmo com availableInQuotes=true", () => {
    expect(isServiceSelectableInQuotes({ active: false, availableInQuotes: true })).toBe(false);
  });
});

describe("G98 — countServiceUsage conta orçamentos da NUVEM (serviceId lido de volta do service_id)", () => {
  const cloudItem = (id: string, serviceId: string | null): Pick<Quote, "items">["items"][number] =>
    mapSupabaseQuoteItemToLocalItem({
      id, quote_id: "q", service_id: serviceId, name: "x", quantity: 1, unit_price: 1,
      created_at: "", updated_at: "",
    } as unknown as SupabaseQuoteItem);

  it("soma itens por serviço em vários orçamentos; item manual (sem service_id) não conta", () => {
    const quotes = [
      { items: [cloudItem("1", SVC_A), cloudItem("2", SVC_B), cloudItem("3", null)] },
      { items: [cloudItem("4", SVC_A)] },
    ];
    const usage = countServiceUsage(quotes);
    expect(usage.get(SVC_A)).toBe(2);
    expect(usage.get(SVC_B)).toBe(1);
    expect(usage.size).toBe(2);
  });

  it("sem orçamentos / sem itens → vazio", () => {
    expect(countServiceUsage([]).size).toBe(0);
    expect(countServiceUsage([{ items: [] }]).size).toBe(0);
  });
});
