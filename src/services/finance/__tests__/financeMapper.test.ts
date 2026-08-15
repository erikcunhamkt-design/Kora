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

  // Fase B (§2.2 do desenho, G37 por desenho) — mesma exceção já aplicada em
  // projectsMapper.ts/tasksMapper.ts: um localId que já é uuid real (ex.:
  // quoteId vindo de uma quote lida da nuvem) passa direto, nunca procura no
  // import-map (que só mapeia id LOCAL -> uuid e nunca teria essa entrada).
  it("já sendo um uuid válido, passa direto — nunca procura no import-map", () => {
    const uuid = "a1b2c3d4-e5f6-4789-a012-b3c4d5e6f789";
    expect(resolveFinanceFk(uuid, {})).toBe(uuid);
    expect(resolveFinanceFk(uuid, { [uuid]: "outro-uuid-que-nunca-deveria-ganhar" })).toBe(uuid);
  });

  it("uma string que não é uuid continua tratada como id local (comportamento inalterado, regressão do import geral)", () => {
    expect(resolveFinanceFk("tx-local-1", { "tx-local-1": "uuid-real-1" })).toBe("uuid-real-1");
    expect(resolveFinanceFk("tx-local-nao-mapeada", {})).toBeNull();
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

// Fase B (§1.1/§2.3 do desenho) — category/payment_method ganharam coluna
// cloud (migration 20260815000100); payload completo desde o dia 1 (G37).
describe("mapLocalTransactionToSupabase — category/payment_method no payload (Fase B, §1.1/§2.3)", () => {
  it("inclui category e payment_method no payload", () => {
    const payload = mapLocalTransactionToSupabase(makeTransaction({ category: "Marketing", paymentMethod: "boleto" }));
    expect(payload.category).toBe("Marketing");
    expect(payload.payment_method).toBe("boleto");
  });

  it("category ausente vira null, nunca undefined (coluna aceita NULL)", () => {
    const payload = mapLocalTransactionToSupabase(makeTransaction({ category: undefined as unknown as string }));
    expect(payload.category).toBeNull();
  });

  // Revisão Lane E (AJUSTE-a) — objectContaining sozinho não prova ausência
  // (um objeto com a chave presente e valor undefined ainda passa nele).
  // recurrence/supplierId/cashAccountId/notes (§1.2 do desenho, pós-flip)
  // precisam estar de fato AUSENTES do payload, não só "não verificados" —
  // notes em especial porque o comentário do mapper reverso (corrigido
  // nesta revisão) chegou a afirmar, por engano, que ele era fundido em
  // description na escrita.
  it("recurrence/supplierId/cashAccountId/notes NUNCA entram no payload (pós-flip, §1.2 — ausência real, não só null)", () => {
    const payload = mapLocalTransactionToSupabase(makeTransaction({
      recurrence: "monthly", supplierId: "sup-1", cashAccountId: "cash-1", notes: "observação qualquer",
    }));
    expect(payload).not.toHaveProperty("recurrence");
    expect(payload).not.toHaveProperty("supplierId");
    expect(payload).not.toHaveProperty("supplier_id");
    expect(payload).not.toHaveProperty("cashAccountId");
    expect(payload).not.toHaveProperty("cash_account_id");
    expect(payload).not.toHaveProperty("notes");
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

  // Fase B (§1.1) — category/payment_method GANHARAM coluna cloud
  // (migration 20260815000100). Lidos de verdade quando presentes; só caem
  // no placeholder/fallback quando a coluna vier null (linha pré-migration,
  // ou nunca preenchida) — "reportar, não inventar" continua valendo só
  // pro que ainda não tem dado real.
  describe("category/payment_method — Fase B, agora COM coluna cloud (§1.1)", () => {
    it("lê category/payment_method reais quando a coluna vem preenchida", () => {
      const tx = mapSupabaseTransactionToLocal(makeSupabaseTransaction({ category: "Marketing", payment_method: "boleto" }));
      expect(tx.category).toBe("Marketing");
      expect(tx.paymentMethod).toBe("boleto");
    });

    it("category null (linha pré-migration/nunca preenchida) cai no placeholder rotulado, nunca um nome inventado", () => {
      expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction({ category: null })).category).toBe("Sem categoria (nuvem)");
    });

    it("payment_method null ou fora do enum fechado cai em \"other\" (nunca mascara nem quebra)", () => {
      expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction({ payment_method: null })).paymentMethod).toBe("other");
      expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction({ payment_method: "criptomoeda" })).paymentMethod).toBe("other");
    });
  });

  // "Reportar, não inventar" — os 3 gaps de schema que continuam SEM coluna
  // cloud (pós-flip, §1.2 do desenho — domínio relacional novo, fora de
  // escopo desta fase): nunca um valor plausível inventado, sempre um
  // placeholder honesto ou undefined.
  describe("campos ainda sem coluna cloud (§1.2 do desenho) — reportar, não inventar", () => {
    it("recurrence cai no membro neutro do enum fechado, não um valor inventado", () => {
      expect(mapSupabaseTransactionToLocal(makeSupabaseTransaction()).recurrence).toBe("none");
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
