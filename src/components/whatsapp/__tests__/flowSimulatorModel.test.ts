// Etapa 9 · Item 4 — simulador do fluxo, lado UI (U1–U4 de docs/qa/etapa-9-bot-
// simulador-fluxo-cobertura.md §1.2/§4). Lógica pura do painel: pedido, resposta
// e estado legível. O motor é do server; aqui só se prova o contrato de ida e volta.
import { describe, it, expect } from "vitest";
import {
  INITIAL_SIM_STATE,
  SIM_GREETING,
  SIM_SILENT_TEXT,
  SIM_SKIPPED_TEXT,
  applySimulationResponse,
  buildSimulatorRequest,
  describeSimState,
  type SimMessage,
} from "@/components/whatsapp/flowSimulatorModel";
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const TRIGGER: WorkflowNode = { id: "node-trigger", type: "trigger", title: "Gatilho", enabled: true, properties: { respondAll: true } };
const HANDOVER: WorkflowNode = { id: "node-handover", type: "handover", title: "Transbordo", enabled: true, properties: { assignTo: "" } };
const AI: WorkflowNode = {
  id: "node-ai", type: "ai", title: "IA", enabled: true,
  properties: {
    instruction: "Seja breve", model: "gemini-2.5-flash", provider: "gemini_api_key",
    geminiApiKey: "key-123", gcpProjectId: "proj", gcpRegion: "us-east1", gcpServiceAccount: "sa-json", customModelName: "meu-modelo",
  },
};
const MENU: WorkflowNode = {
  id: "menu-1", type: "menu", title: "Menu principal", enabled: true,
  properties: {
    mensagem: "Escolha:", opcoes: [{ numero: 1, rotulo: "Financeiro", nextNodeId: "node-ai" }],
    fallback: { maxTentativas: 3, acao: "reprompt" },
  },
};

const GREETING: SimMessage = { role: "model", text: SIM_GREETING };

describe("buildSimulatorRequest (U1 — nó IA opcional; U3 — estado de ida e volta)", () => {
  it("fluxo SÓ-MENU (sem nó ai): monta o corpo sem campos de provider/credencial, sem lançar nem 'retornar em silêncio'", () => {
    const body = buildSimulatorRequest({
      workspaceId: "ws-1", nodes: [TRIGGER, MENU, HANDOVER], userText: "oi",
      messages: [GREETING, { role: "user", text: "oi" }], simState: INITIAL_SIM_STATE,
    });

    expect(body.isTest).toBe(true);
    expect(body.workspaceId).toBe("ws-1");
    expect(body.messageText).toBe("oi");
    for (const key of ["systemInstruction", "provider", "modelName", "geminiApiKey", "gcpProjectId", "gcpRegion", "gcpServiceAccount"]) {
      expect(body, `não deve mandar ${key} sem nó ai`).not.toHaveProperty(key);
    }
  });

  it("COM nó ai: continua mandando os campos de provider/credencial como antes", () => {
    const body = buildSimulatorRequest({
      workspaceId: "ws-1", nodes: [TRIGGER, AI, HANDOVER], userText: "oi",
      messages: [GREETING, { role: "user", text: "oi" }], simState: INITIAL_SIM_STATE,
    });

    expect(body).toMatchObject({
      systemInstruction: "Seja breve", provider: "gemini_api_key", modelName: "gemini-2.5-flash",
      geminiApiKey: "key-123", gcpProjectId: null, gcpRegion: "us-central1", gcpServiceAccount: null,
    });
  });

  it("modelo 'custom' usa customModelName; vertex_ai manda as credenciais do GCP", () => {
    const vertexCustom: WorkflowNode = {
      ...AI,
      properties: { ...(AI as Extract<WorkflowNode, { type: "ai" }>).properties, model: "custom", provider: "vertex_ai" },
    };
    const body = buildSimulatorRequest({
      workspaceId: "ws-1", nodes: [vertexCustom], userText: "x", messages: [GREETING, { role: "user", text: "x" }], simState: INITIAL_SIM_STATE,
    });
    expect(body).toMatchObject({
      modelName: "meu-modelo", geminiApiKey: null, gcpProjectId: "proj", gcpRegion: "us-east1", gcpServiceAccount: "sa-json",
    });
  });

  it("leva o simState e o flowData (os nós) — é isso que dá ida e volta ao motor do server", () => {
    const simState = { botFlowState: { currentNodeId: "menu-1", attempts: 2 }, handedOver: false };
    const nodes = [TRIGGER, MENU, AI];
    const body = buildSimulatorRequest({ workspaceId: "ws-1", nodes, userText: "x", messages: [GREETING, { role: "user", text: "x" }], simState });

    expect(body.simState).toEqual(simState);
    expect(body.flowData).toBe(nodes);
  });

  it("histórico: tira a saudação (1º item) e os avisos 'system'; mantém user/model", () => {
    const messages: SimMessage[] = [
      GREETING,
      { role: "user", text: "oi" },
      { role: "model", text: "menu" },
      { role: "system", text: "aviso do simulador" },
      { role: "user", text: "1" },
    ];
    const body = buildSimulatorRequest({ workspaceId: "ws-1", nodes: [MENU], userText: "1", messages, simState: INITIAL_SIM_STATE });

    expect(body.history).toEqual([
      { role: "user", text: "oi" },
      { role: "model", text: "menu" },
      { role: "user", text: "1" },
    ]);
  });
});

describe("applySimulationResponse", () => {
  const menuState = { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false };

  it("menu: uma bolha do robô com o texto do menu e o estado novo", () => {
    const { messages, nextState } = applySimulationResponse(
      { ok: true, reply: "Escolha:\n1 - Financeiro", simulation: { engine: "menu", ...menuState } },
      INITIAL_SIM_STATE,
    );
    expect(messages).toEqual([{ role: "model", text: "Escolha:\n1 - Financeiro" }]);
    expect(nextState).toEqual(menuState);
  });

  it("ai: bolha com a resposta da IA; o estado volta do server (ex.: saiu do menu)", () => {
    const { messages, nextState } = applySimulationResponse(
      { ok: true, reply: "Olá, sou a IA", simulation: { engine: "ai", botFlowState: null, handedOver: false } },
      menuState,
    );
    expect(messages).toEqual([{ role: "model", text: "Olá, sou a IA" }]);
    expect(nextState).toEqual(INITIAL_SIM_STATE);
  });

  it("U2 — handover vem do server: a bolha É a cortesia (substitui a IA), com selo do motivo, e o estado fica entregue", () => {
    const { messages, nextState } = applySimulationResponse(
      { ok: true, reply: "Encaminhando o seu contato…", simulation: { engine: "handover", handoverReason: "menu_exhausted", botFlowState: null, handedOver: true } },
      menuState,
    );
    expect(messages).toEqual([{ role: "model", text: "Encaminhando o seu contato…", tag: "Entregue a atendimento humano · tentativas esgotadas" }]);
    expect(nextState).toEqual({ botFlowState: null, handedOver: true });
  });

  it("U2 — rótulos dos 4 motivos de handover", () => {
    const labelFor = (handoverReason: string) =>
      applySimulationResponse(
        { reply: "x", simulation: { engine: "handover", handoverReason, botFlowState: null, handedOver: true } },
        INITIAL_SIM_STATE,
      ).messages[0].tag;
    expect(labelFor("keyword")).toBe("Entregue a atendimento humano · palavra-chave");
    expect(labelFor("menu_option")).toBe("Entregue a atendimento humano · opção do menu");
    expect(labelFor("menu_fallback_node")).toBe("Entregue a atendimento humano · fallback do menu");
    expect(labelFor("menu_exhausted")).toBe("Entregue a atendimento humano · tentativas esgotadas");
  });

  it("U4 — silent (reply null): aviso do simulador, NÃO erro 'Resposta da IA vazia'", () => {
    const { messages, nextState } = applySimulationResponse(
      { ok: true, reply: null, simulation: { engine: "silent", botFlowState: null, handedOver: true } },
      { botFlowState: null, handedOver: true },
    );
    expect(messages).toEqual([{ role: "system", text: SIM_SILENT_TEXT }]);
    expect(nextState.handedOver).toBe(true);
  });

  it("U4 — skipped (reply null, sem IA habilitada): aviso do simulador, não erro", () => {
    const { messages } = applySimulationResponse(
      { ok: true, reply: null, simulation: { engine: "skipped", botFlowState: null, handedOver: false } },
      INITIAL_SIM_STATE,
    );
    expect(messages).toEqual([{ role: "system", text: SIM_SKIPPED_TEXT }]);
  });

  it("compat — server ANTIGO (sem `simulation`): mostra a resposta e MANTÉM o estado", () => {
    const { messages, nextState } = applySimulationResponse({ ok: true, reply: "resposta da IA" }, menuState);
    expect(messages).toEqual([{ role: "model", text: "resposta da IA" }]);
    expect(nextState).toEqual(menuState);
  });

  it("compat — server antigo com reply vazio continua sendo erro 'Resposta da IA vazia' (único caso)", () => {
    expect(() => applySimulationResponse({ ok: true, reply: "" }, INITIAL_SIM_STATE)).toThrow("Resposta da IA vazia");
    expect(() => applySimulationResponse(null, INITIAL_SIM_STATE)).toThrow("Resposta da IA vazia");
  });

  it("`simulation` malformada é tratada como resposta legada (não corrompe o estado)", () => {
    for (const bad of [{ engine: "inventado", handedOver: false }, { engine: "menu" }, "lixo", 42]) {
      const { messages, nextState } = applySimulationResponse({ reply: "oi", simulation: bad }, menuState);
      expect(messages).toEqual([{ role: "model", text: "oi" }]);
      expect(nextState).toEqual(menuState);
    }
  });

  it("engine menu/handover sem reply é erro explícito (server inconsistente), não bolha vazia", () => {
    expect(() =>
      applySimulationResponse({ reply: null, simulation: { engine: "menu", ...menuState } }, INITIAL_SIM_STATE),
    ).toThrow(/vazia/i);
  });
});

describe("describeSimState (estado legível — nó/tentativas)", () => {
  const nodes = [TRIGGER, MENU, AI, HANDOVER];

  it("fora do menu", () => {
    expect(describeSimState(INITIAL_SIM_STATE, nodes)).toEqual({
      tone: "idle", label: "Fora do menu — a próxima mensagem inicia o fluxo",
    });
  });

  it("no menu: mostra o TÍTULO do nó e as respostas inválidas contra o máximo configurado", () => {
    expect(describeSimState({ botFlowState: { currentNodeId: "menu-1", attempts: 2 }, handedOver: false }, nodes)).toEqual({
      tone: "menu", label: "No menu “Menu principal” — respostas inválidas: 2 de 3",
    });
  });

  it("entregue a humano tem prioridade sobre o resto", () => {
    expect(describeSimState({ botFlowState: { currentNodeId: "menu-1", attempts: 1 }, handedOver: true }, nodes)).toEqual({
      tone: "handover", label: "Entregue a atendimento humano — o robô está em silêncio",
    });
  });

  it("estado aponta pra nó que não existe mais (ou não é menu): descreve sem lançar", () => {
    const orphan = describeSimState({ botFlowState: { currentNodeId: "sumiu", attempts: 0 }, handedOver: false }, nodes);
    expect(orphan.tone).toBe("menu");
    expect(orphan.label).toMatch(/não existe mais/);
    expect(describeSimState({ botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false }, nodes).label).toMatch(/não existe mais/);
  });
});
