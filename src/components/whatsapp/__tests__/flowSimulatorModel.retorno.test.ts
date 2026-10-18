// R9 — selo do simulador na virada que SAIU do modo IA pela palavra de retorno.
// (flowSimulatorModel é da lane D; edição mínima só pro selo.) O motor é do servidor.
import { describe, it, expect } from "vitest";
import {
  SIM_ENTERED_AI_TAG,
  SIM_LEFT_AI_TAG,
  applySimulationResponse,
  describeSimState,
} from "@/components/whatsapp/flowSimulatorModel";
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const MARKER = { currentNodeId: "node-ai", attempts: 0 };
const MENU_STATE = { currentNodeId: "menu-1", attempts: 0 };

describe("applySimulationResponse — selo 'voltou ao menu' (R9)", () => {
  it("virada com leftAi: a bolha é o menu, com o selo (tagKind 'ai') e o estado volta pro menu", () => {
    const { messages, nextState } = applySimulationResponse(
      {
        reply: "Como posso ajudar?\n1 - Falar com a IA",
        simulation: { engine: "menu", botFlowState: MENU_STATE, handedOver: false, leftAi: true },
      },
      { botFlowState: MARKER, handedOver: false },
    );
    expect(messages).toEqual([
      { role: "model", text: "Como posso ajudar?\n1 - Falar com a IA", tag: SIM_LEFT_AI_TAG, tagKind: "ai" },
    ]);
    expect(nextState).toEqual({ botFlowState: MENU_STATE, handedOver: false });
    expect(SIM_LEFT_AI_TAG).toBe("Voltou ao menu — conversa com a IA encerrada");
  });

  it("sem leftAi (ou valor não booleano): nenhum selo", () => {
    for (const leftAi of [undefined, "true", 1, false]) {
      const { messages } = applySimulationResponse(
        { reply: "menu", simulation: { engine: "menu", botFlowState: MENU_STATE, handedOver: false, leftAi } },
        INITIAL(),
      );
      expect(messages[0].tag).toBeUndefined();
    }
  });

  it("saiu e já passou à IA de novo na MESMA virada (raro): vale o selo de 'passou para a IA'", () => {
    const { messages } = applySimulationResponse(
      { reply: "oi", simulation: { engine: "menu", botFlowState: MARKER, handedOver: false, leftAi: true, enteredAi: true } },
      INITIAL(),
    );
    expect(messages[0].tag).toBe(SIM_ENTERED_AI_TAG);
  });
});

describe("describeSimState — depois de sair do modo IA o estado volta a ser o do menu", () => {
  const MENU: WorkflowNode = {
    id: "menu-1", type: "menu", title: "Menu principal", enabled: true,
    properties: { mensagem: "x", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" } },
  };
  it("estado = menu → 'No menu …' (não mais 'Conversa com a IA')", () => {
    expect(describeSimState({ botFlowState: MENU_STATE, handedOver: false }, [MENU]).label).toMatch(/^No menu “Menu principal”/);
  });
});

function INITIAL() {
  return { botFlowState: null, handedOver: false };
}
