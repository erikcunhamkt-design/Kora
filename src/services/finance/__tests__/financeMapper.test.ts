// Etapa 5 · Fatia 6 (finance) — testes do mapper: fan-out (3 maps), tradução de type,
// precisão monetária quantizada e o relatório de divergência amount vs quotes.total.
import { describe, it, expect } from "vitest";
import {
  mapLocalTransactionToSupabase,
  mapSupabaseTransactionToLocal,
  translateCloudTransactionVocabulary,
  resolveFinanceFk,
  inspectFinanceMoney,
} from "@/services/finance/financeMapper";
import type { Transaction } from "@/hooks/useFinance";
import type { SupabaseFinancialTransaction } from "@/repositories/financeRepository";

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

// Etapa 5 · Financeiro Fatia N (item 2) — direção nuvem -> local, primeira
// leitura de financial_transactions pra tela principal.
function makeSupabaseTransaction(overrides: Partial<SupabaseFinancialTransaction> = {}): SupabaseFinancialTransaction {
  return {
    id: "sft-1",
    workspace_id: "ws1",
    type: "receivable",
    status: "pending",
    title: "Recebível X",
    amount: 100,
    source: "manual",
    is_demo: false,
    archived: false,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("translateCloudTransactionVocabulary — status/type sem CHECK constraint, nunca mascara desconhecido", () => {
  it("os 2 valores conhecidos de type traduzem certo, sem cloudTypeRaw", () => {
    expect(translateCloudTransactionVocabulary("receivable", "pending")).toMatchObject({ type: "income" });
    expect(translateCloudTransactionVocabulary("payable", "pending")).toMatchObject({ type: "expense" });
    expect(translateCloudTransactionVocabulary("receivable", "pending").cloudTypeRaw).toBeUndefined();
  });

  it("os 4 valores conhecidos de status passam direto, sem cloudStatusRaw", () => {
    for (const status of ["pending", "paid", "overdue", "canceled"]) {
      const result = translateCloudTransactionVocabulary("receivable", status);
      expect(result.status).toBe(status);
      expect(result.cloudStatusRaw).toBeUndefined();
    }
  });

  it("type desconhecido cai no fallback \"expense\" + cloudTypeRaw preserva o valor bruto (nunca mascara)", () => {
    const result = translateCloudTransactionVocabulary("tipo-bizarro", "pending");
    expect(result.type).toBe("expense");
    expect(result.cloudTypeRaw).toBe("tipo-bizarro");
  });

  it("status desconhecido cai no fallback \"pending\" + cloudStatusRaw preserva o valor bruto (nunca mascara)", () => {
    const result = translateCloudTransactionVocabulary("receivable", "status-bizarro");
    expect(result.status).toBe("pending");
    expect(result.cloudStatusRaw).toBe("status-bizarro");
  });
});

describe("mapSupabaseTransactionToLocal — payload completo desde o dia 1 (lição G37)", () => {
  it("mapeia campos básicos, traduz type/status, resolve clientName via clientNameById", () => {
    const st = makeSupabaseTransaction({
      type: "payable", status: "paid", client_id: "client-uuid-1", amount: 250.5,
    });
    const tx = mapSupabaseTransactionToLocal(st, { "client-uuid-1": "Acme Corp" });

    expect(tx.id).toBe("sft-1");
    expect(tx.type).toBe("expense");
    expect(tx.status).toBe("paid");
    expect(tx.amount).toBe(250.5);
    expect(tx.clientName).toBe("Acme Corp");
  });

  it("client_id sem entrada no mapa -> clientName undefined (nunca quebra)", () => {
    const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction({ client_id: "client-desconhecido" }), {});
    expect(tx.clientName).toBeUndefined();
  });

  it("sem client_id -> clientName undefined", () => {
    const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction());
    expect(tx.clientName).toBeUndefined();
  });

  it("clientId/opportunityId: uuid da nuvem smuggled como number (mesmo precedente de projectsMapper), quoteId passagem direta", () => {
    const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction({
      client_id: "client-uuid-1", quote_id: "quote-uuid-1", opportunity_id: "opp-uuid-1",
    }));
    expect(tx.clientId).toBe("client-uuid-1" as unknown as number);
    expect(tx.quoteId).toBe("quote-uuid-1");
    expect(tx.opportunityId).toBe("opp-uuid-1" as unknown as number);
  });

  it("dueDate ausente cai no created_at (nunca string vazia — Transaction.dueDate é obrigatório)", () => {
    const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction({ due_date: null, created_at: "2026-08-05T10:00:00Z" }));
    expect(tx.dueDate).toBe("2026-08-05");
  });

  it("source desconhecido/ausente cai em \"manual\" (fallback seguro, vocabulário fechado)", () => {
    expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction({ source: "origem-bizarra" })).source).toBe("manual");
    expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction({ source: null })).source).toBe("manual");
    expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction({ source: "quote" })).source).toBe("quote");
  });

  // "Reportar, não inventar" — os 5 gaps de schema catalogados
  // (etapa-5-flip-financeiro-fase-a.md §3): nunca um valor plausível
  // inventado, sempre um placeholder honesto ou undefined.
  describe("campos sem coluna cloud (§3/§5 do doc da fatia) — reportar, não inventar", () => {
    it("category vira placeholder claramente rotulado, nunca um nome de categoria real", () => {
      expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction()).category).toBe("Sem categoria (nuvem)");
    });
    it("paymentMethod/recurrence caem no membro neutro do enum fechado, não um valor inventado", () => {
      const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction());
      expect(tx.paymentMethod).toBe("other");
      expect(tx.recurrence).toBe("none");
    });
    it("supplierId/cashAccountId/notes/quoteTitle ficam undefined — nunca um valor inventado", () => {
      const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction());
      expect(tx.supplierId).toBeUndefined();
      expect(tx.cashAccountId).toBeUndefined();
      expect(tx.notes).toBeUndefined();
      expect(tx.quoteTitle).toBeUndefined();
    });
  });

  it("isDemo ausente vira false, nunca undefined", () => {
    const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction({ is_demo: undefined as unknown as boolean }));
    expect(tx.isDemo).toBe(false);
  });
});
