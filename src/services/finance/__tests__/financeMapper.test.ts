// Etapa 5 · Fatia 6 (finance) — testes do mapper: fan-out (3 maps), tradução de type,
// precisão monetária quantizada e o relatório de divergência amount vs quotes.total.
import { describe, it, expect } from "vitest";
import {
  mapLocalTransactionToSupabase,
  resolveFinanceFk,
  inspectFinanceMoney,
} from "@/services/finance/financeMapper";
import type { Transaction } from "@/hooks/useFinance";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx-1",
    type: "income",
    title: "Serviço X",
    amount: 100,
    category: "Serviços",
    dueDate: "2026-08-01",
    status: "pending",
    paymentMethod: "pix",
    recurrence: "none",
    source: "manual",
    createdAt: "2026-07-01T00:00:00Z",
    isDemo: false,
    ...overrides,
  };
}

describe("resolveFinanceFk — padrão Q4 (mapeado -> uuid; ausente -> null, nunca id cru)", () => {
  it("devolve o uuid quando o id local está mapeado", () => {
    expect(resolveFinanceFk(42, { "42": "uuid-42" })).toBe("uuid-42");
  });
  it("devolve null quando o id local NÃO está mapeado", () => {
    expect(resolveFinanceFk(99, { "42": "uuid-42" })).toBeNull();
  });
  it("devolve null quando o id local é null/undefined/vazio", () => {
    expect(resolveFinanceFk(null, {})).toBeNull();
    expect(resolveFinanceFk(undefined, {})).toBeNull();
    expect(resolveFinanceFk("", {})).toBeNull();
  });
});

describe("mapLocalTransactionToSupabase — fan-out dos 3 import-maps", () => {
  const maps = {
    clients: { "7": "client-uuid-7" },
    quotes: { "qt-1": "quote-uuid-1" },
    opportunities: { "3": "opp-uuid-3" },
  };

  it("resolve client_id/quote_id/opportunity_id para uuid quando mapeados", () => {
    const tx = makeTransaction({ clientId: 7, quoteId: "qt-1", opportunityId: 3 });
    const payload = mapLocalTransactionToSupabase(tx, maps);
    expect(payload.client_id).toBe("client-uuid-7");
    expect(payload.quote_id).toBe("quote-uuid-1");
    expect(payload.opportunity_id).toBe("opp-uuid-3");
  });

  it("resolve para null quando os ids locais NÃO estão mapeados (nunca id cru)", () => {
    const tx = makeTransaction({ clientId: 999, quoteId: "qt-desconhecida", opportunityId: 999 });
    const payload = mapLocalTransactionToSupabase(tx, maps);
    expect(payload.client_id).toBeNull();
    expect(payload.quote_id).toBeNull();
    expect(payload.opportunity_id).toBeNull();
    // nunca o id local cru numa coluna uuid
    expect(payload.client_id).not.toBe(999);
    expect(payload.quote_id).not.toBe("qt-desconhecida");
  });

  it("resolve para null quando os campos de FK local nem existem na transação", () => {
    const tx = makeTransaction();
    const payload = mapLocalTransactionToSupabase(tx, maps);
    expect(payload.client_id).toBeNull();
    expect(payload.quote_id).toBeNull();
    expect(payload.opportunity_id).toBeNull();
  });
});

describe("mapLocalTransactionToSupabase — tradução de type e precisão monetária", () => {
  it("traduz income -> receivable e expense -> payable", () => {
    expect(mapLocalTransactionToSupabase(makeTransaction({ type: "income" })).type).toBe("receivable");
    expect(mapLocalTransactionToSupabase(makeTransaction({ type: "expense" })).type).toBe("payable");
  });

  it("quantiza amount a centavos (artefato de float do JS)", () => {
    const payload = mapLocalTransactionToSupabase(makeTransaction({ amount: 0.1 + 0.2 }));
    expect(payload.amount).toBe(0.3);
  });
});

describe("inspectFinanceMoney — divergência amount vs quotes.total (reporta, não corrige)", () => {
  const localQuotes = [
    { id: "qt-1", total: 100 },
    { id: "qt-2", total: 250.5 },
  ];

  it("sem quoteId: não há quoteTotal, sem mismatch", () => {
    const report = inspectFinanceMoney({ amount: 100, quoteId: undefined }, localQuotes);
    expect(report.quoteTotal).toBeNull();
    expect(report.diff).toBeNull();
    expect(report.amountMismatch).toBe(false);
  });

  it("com quoteId batendo: sem mismatch", () => {
    const report = inspectFinanceMoney({ amount: 100, quoteId: "qt-1" }, localQuotes);
    expect(report.quoteTotal).toBe(100);
    expect(report.diff).toBe(0);
    expect(report.amountMismatch).toBe(false);
  });

  it("com quoteId divergente (> 1 centavo): reporta mismatch, NÃO corrige o amount", () => {
    const report = inspectFinanceMoney({ amount: 90, quoteId: "qt-1" }, localQuotes);
    expect(report.amount).toBe(90); // preservado, não ajustado pro total da quote
    expect(report.quoteTotal).toBe(100);
    expect(report.diff).toBe(10);
    expect(report.amountMismatch).toBe(true);
  });

  it("com divergência de exatamente 1 centavo: NÃO é mismatch (limiar é > 0.01, não >=)", () => {
    const report = inspectFinanceMoney({ amount: 99.99, quoteId: "qt-1" }, localQuotes);
    expect(report.diff).toBe(0.01);
    expect(report.amountMismatch).toBe(false);
  });

  it("quoteId aponta para quote local desconhecida: trata como sem quote vinculada", () => {
    const report = inspectFinanceMoney({ amount: 100, quoteId: "qt-inexistente" }, localQuotes);
    expect(report.quoteTotal).toBeNull();
    expect(report.amountMismatch).toBe(false);
  });
});
