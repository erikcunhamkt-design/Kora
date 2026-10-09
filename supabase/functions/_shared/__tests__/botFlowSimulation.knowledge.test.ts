// Etapa 9 · item 3 — PARIDADE do simulador com a base de conhecimento: o selo
// vem do MESMO primitivo de produção (`loadKnowledgeForPrompt`); o simulador só
// o carrega pra resposta (docs/qa/etapa-9-item3-r1-base-conhecimento-liga.md).
import { describe, expect, it } from "vitest";
import { simulateFlowTurn, withKnowledgeInfo } from "../botFlowSimulation";
import { loadKnowledgeForPrompt, EMPTY_KNOWLEDGE, type KnowledgeDataAccess } from "../knowledgeLoader";
import type { RawFlowNode } from "../botFlowMenu";

const AI: RawFlowNode = { id: "node-ai", type: "ai", enabled: true, properties: {} };
const FRESH = { botFlowState: null, handedOver: false };
const ok = (data: unknown) => Promise.resolve({ data, error: null });

const quote = (id: string) => ({
  id, status: "sent", archived: false, deleted_at: null, client_name: null, company: null,
  quote_items: [{ name: "Landing Page", unit_price: 4000 }],
});

function access(consents: unknown[]): KnowledgeDataAccess {
  return {
    fetchConsents: () => ok(consents),
    fetchQuotesWithItems: () => ok([quote("1"), quote("2")]),
    fetchClients: () => ok([]),
    fetchCurrency: () => ok({ currency: "BRL" }),
  };
}

describe("withKnowledgeInfo", () => {
  const base = { engine: "ai" as const, botFlowState: null, handedOver: false };

  it("categoria que entrou: anexa o selo (categorias, incluídos, omitidos)", () => {
    expect(withKnowledgeInfo(base, { categories: ["catalog"], included: 12, omitted: 3 })).toEqual({
      ...base,
      knowledge: { categories: ["catalog"], included: 12, omitted: 3 },
    });
  });

  it("nenhuma categoria entrou: simulação volta INALTERADA (sem campo novo — simulador igual a antes)", () => {
    const result = withKnowledgeInfo(base, { categories: [], included: 0, omitted: 0 });
    expect(result).toBe(base);
    expect(result).not.toHaveProperty("knowledge");
  });

  it("não muta o objeto de entrada", () => {
    const input = { ...base };
    withKnowledgeInfo(input, { categories: ["catalog"], included: 1, omitted: 0 });
    expect(input).not.toHaveProperty("knowledge");
  });
});

describe("paridade: simulador + primitivo de produção (mesma função, mesmo resultado)", () => {
  it("categoria A ativa e turno que cai na IA: o selo reflete o que o primitivo de produção montou", async () => {
    const knowledge = await loadKnowledgeForPrompt(access([{ category: "catalog", enabled: true, legal_basis_ack: false, revoked_at: null }]));
    const turn = simulateFlowTurn([AI], FRESH, "oi");
    expect(turn.kind).toBe("continue");

    const simulation = withKnowledgeInfo(turn.simulation, knowledge);
    expect(simulation.knowledge).toEqual({ categories: ["catalog"], included: 1, omitted: 0 });
    // o selo carrega exatamente o que entrou no bloco de produção
    expect(knowledge.block.split("\n").length - 1).toBe(simulation.knowledge!.included);
  });

  it("categoria desligada: o primitivo devolve vazio e o simulador NÃO ganha selo", async () => {
    const knowledge = await loadKnowledgeForPrompt(access([{ category: "catalog", enabled: false, legal_basis_ack: false, revoked_at: null }]));
    expect(knowledge).toEqual(EMPTY_KNOWLEDGE);
    const turn = simulateFlowTurn([AI], FRESH, "oi");
    expect(withKnowledgeInfo(turn.simulation, knowledge)).not.toHaveProperty("knowledge");
  });

  it("revogada ou C/D/E sem atesto: mesma regra de produção — sem selo", async () => {
    for (const row of [
      { category: "catalog", enabled: true, legal_basis_ack: false, revoked_at: "2026-10-01T00:00:00Z" },
      { category: "crm", enabled: true, legal_basis_ack: false, revoked_at: null },
    ]) {
      const knowledge = await loadKnowledgeForPrompt(access([row]));
      const turn = simulateFlowTurn([AI], FRESH, "oi");
      expect(withKnowledgeInfo(turn.simulation, knowledge)).not.toHaveProperty("knowledge");
    }
  });
});
