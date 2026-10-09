// Etapa 9 · item 3 — selo da BASE DE CONHECIMENTO no simulador (lado UI).
// O server só repassa o resultado do primitivo de produção; aqui se prova a
// leitura defensiva e o rótulo honesto ("itens já orçados", nunca "catálogo").
import { describe, it, expect } from "vitest";
import { applySimulationResponse, INITIAL_SIM_STATE } from "@/components/whatsapp/flowSimulatorModel";

const ai = (knowledge: unknown) => ({
  ok: true,
  reply: "Posso ajudar com isso.",
  simulation: { engine: "ai", botFlowState: null, handedOver: false, knowledge },
});

describe("applySimulationResponse — selo da base de conhecimento", () => {
  it("categoria que entrou: a bolha da IA ganha o selo, com rótulo honesto (itens já orçados)", () => {
    const { messages } = applySimulationResponse(ai({ categories: ["catalog"], included: 12, omitted: 0 }), INITIAL_SIM_STATE);
    expect(messages).toEqual([
      { role: "model", text: "Posso ajudar com isso.", tag: "Base de conhecimento · 12 itens já orçados no contexto", tagKind: "knowledge" },
    ]);
    expect(messages[0].tag).not.toMatch(/catálogo/i);
  });

  it("singular e itens que ficaram de fora pelo limite", () => {
    expect(applySimulationResponse(ai({ categories: ["catalog"], included: 1, omitted: 0 }), INITIAL_SIM_STATE).messages[0].tag).toBe(
      "Base de conhecimento · 1 item já orçado no contexto",
    );
    expect(applySimulationResponse(ai({ categories: ["catalog"], included: 40, omitted: 7 }), INITIAL_SIM_STATE).messages[0].tag).toBe(
      "Base de conhecimento · 40 itens já orçados no contexto (+7 de fora pelo limite)",
    );
  });

  it("sem `knowledge` (categoria desligada/nada entrou): bolha SEM selo — simulador idêntico a antes", () => {
    const { messages } = applySimulationResponse(ai(undefined), INITIAL_SIM_STATE);
    expect(messages).toEqual([{ role: "model", text: "Posso ajudar com isso." }]);
    expect(messages[0]).not.toHaveProperty("tag");
  });

  it("`knowledge` malformado/vazio é ignorado (nunca inventa selo)", () => {
    for (const bad of [null, "x", { categories: [], included: 3 }, { categories: ["catalog"], included: 0 }, { categories: [1], included: 2 }]) {
      expect(applySimulationResponse(ai(bad), INITIAL_SIM_STATE).messages[0]).not.toHaveProperty("tag");
    }
  });

  it("o selo só aparece na resposta de IA — menu e handover não carregam conhecimento", () => {
    const menu = applySimulationResponse(
      { reply: "Escolha:", simulation: { engine: "menu", botFlowState: { currentNodeId: "m", attempts: 0 }, handedOver: false, knowledge: { categories: ["catalog"], included: 3, omitted: 0 } } },
      INITIAL_SIM_STATE,
    );
    expect(menu.messages[0]).not.toHaveProperty("tag");
  });

  it("categoria desconhecida cai num rótulo genérico, sem lançar", () => {
    expect(applySimulationResponse(ai({ categories: ["outra"], included: 2, omitted: 0 }), INITIAL_SIM_STATE).messages[0].tag).toBe(
      "Base de conhecimento · 2 itens no contexto",
    );
  });
});
