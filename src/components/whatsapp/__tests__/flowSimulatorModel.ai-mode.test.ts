// R8 (ajuste) — rótulos do simulador para o MODO IA e o handover por nó de mensagem.
// Edição cruzada autorizada em flowSimulatorModel.ts (lane D): motivo `message_next`,
// reconhecimento do marcador de modo IA em describeSimState e selo na virada que
// passa a conversa à IA. O motor é do servidor; aqui só a interpretação da resposta.
import { describe, it, expect } from "vitest";
import {
  INITIAL_SIM_STATE,
  SIM_ENTERED_AI_TAG,
  applySimulationResponse,
  describeSimState,
} from "@/components/whatsapp/flowSimulatorModel";
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const AI: WorkflowNode = {
  id: "node-ai", type: "ai", title: "Agente IA", enabled: true,
  properties: {
    instruction: "x", model: "m", provider: "gemini_api_key", geminiApiKey: "", gcpProjectId: "",
    gcpRegion: "", gcpServiceAccount: "", customModelName: "",
  },
};
const MENU: WorkflowNode = {
  id: "menu-1", type: "menu", title: "Menu principal", enabled: true,
  properties: { mensagem: "Escolha:", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" } },
};
const MARKER = { currentNodeId: "node-ai", attempts: 0 };

describe("describeSimState — marcador de modo IA", () => {
  it("estado apontando pro nó ai HABILITADO → tom 'ai' e rótulo de conversa com a IA", () => {
    expect(describeSimState({ botFlowState: MARKER, handedOver: false }, [MENU, AI])).toEqual({
      tone: "ai",
      label: "Conversa com a IA — robô scriptado encerrado",
    });
  });

  it("nó ai desabilitado/removido = estado órfão (mesmo aviso de antes; o motor reentra pelo menu)", () => {
    const off = describeSimState({ botFlowState: MARKER, handedOver: false }, [MENU, { ...AI, enabled: false }]);
    expect(off.tone).toBe("menu");
    expect(off.label).toMatch(/não existe mais/);
    expect(describeSimState({ botFlowState: MARKER, handedOver: false }, [MENU]).label).toMatch(/não existe mais/);
  });

  it("entregue a humano continua com prioridade; menu e 'fora do menu' inalterados", () => {
    expect(describeSimState({ botFlowState: MARKER, handedOver: true }, [MENU, AI]).tone).toBe("handover");
    expect(describeSimState(INITIAL_SIM_STATE, [MENU, AI]).tone).toBe("idle");
    expect(describeSimState({ botFlowState: { currentNodeId: "menu-1", attempts: 1 }, handedOver: false }, [MENU, AI]).tone).toBe("menu");
  });
});

describe("applySimulationResponse — selos do R8", () => {
  it("handover por nó de mensagem: a bolha é o texto da mensagem, com selo e motivo 'mensagem do fluxo'", () => {
    const { messages, nextState } = applySimulationResponse(
      {
        reply: "Vou te passar adiante.",
        simulation: { engine: "handover", handoverReason: "message_next", botFlowState: null, handedOver: true },
      },
      INITIAL_SIM_STATE,
    );
    expect(messages).toEqual([
      { role: "model", text: "Vou te passar adiante.", tag: "Entregue a atendimento humano · mensagem do fluxo", tagKind: "handover" },
    ]);
    expect(nextState).toEqual({ botFlowState: null, handedOver: true });
  });

  it("virada que PASSOU à IA (engine 'ai' com enteredAi, vindo de opção/fallback): resposta da IA com selo e marcador no estado", () => {
    const { messages, nextState } = applySimulationResponse(
      {
        reply: "RESPOSTA DA IA",
        simulation: { engine: "ai", botFlowState: MARKER, handedOver: false, enteredAi: true },
      },
      { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false },
    );
    expect(messages).toEqual([{ role: "model", text: "RESPOSTA DA IA", tag: SIM_ENTERED_AI_TAG, tagKind: "ai" }]);
    expect(nextState).toEqual({ botFlowState: MARKER, handedOver: false });
  });

  it("virada que passou à IA por nó de mensagem (engine 'menu' + enteredAi): a saudação leva o selo", () => {
    const { messages } = applySimulationResponse(
      { reply: "Pode me contar!", simulation: { engine: "menu", botFlowState: MARKER, handedOver: false, enteredAi: true } },
      { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false },
    );
    expect(messages).toEqual([{ role: "model", text: "Pode me contar!", tag: SIM_ENTERED_AI_TAG, tagKind: "ai" }]);
  });

  it("passou à IA E a resposta usou a base de conhecimento: UM selo só, juntando os dois (tagKind 'ai')", () => {
    const { messages } = applySimulationResponse(
      {
        reply: "RESPOSTA DA IA",
        simulation: {
          engine: "ai", botFlowState: MARKER, handedOver: false, enteredAi: true,
          knowledge: { categories: ["catalog"], included: 2, omitted: 0 },
        },
      },
      INITIAL_SIM_STATE,
    );
    expect(messages).toHaveLength(1);
    expect(messages[0].tagKind).toBe("ai");
    expect(messages[0].tag).toBe(`${SIM_ENTERED_AI_TAG} · Base de conhecimento · 2 itens já orçados no contexto`);
  });

  it("modo IA já ativo + base de conhecimento: só o selo de conhecimento (comportamento da lane D preservado)", () => {
    const { messages } = applySimulationResponse(
      {
        reply: "outra",
        simulation: {
          engine: "ai", botFlowState: MARKER, handedOver: false,
          knowledge: { categories: ["catalog"], included: 1, omitted: 0 },
        },
      },
      { botFlowState: MARKER, handedOver: false },
    );
    expect(messages[0]).toMatchObject({ tagKind: "knowledge", tag: "Base de conhecimento · 1 item já orçado no contexto" });
  });

  it("mensagens seguintes em modo IA (sem enteredAi) saem SEM selo", () => {
    const { messages } = applySimulationResponse(
      { reply: "outra resposta", simulation: { engine: "ai", botFlowState: MARKER, handedOver: false } },
      { botFlowState: MARKER, handedOver: false },
    );
    expect(messages).toEqual([{ role: "model", text: "outra resposta" }]);
  });

  it("enteredAi não booleano/ausente é ignorado (servidor antigo/lixo não gera selo)", () => {
    const { messages } = applySimulationResponse(
      { reply: "oi", simulation: { engine: "ai", botFlowState: null, handedOver: false, enteredAi: "sim" } },
      INITIAL_SIM_STATE,
    );
    expect(messages).toEqual([{ role: "model", text: "oi" }]);
  });
});
