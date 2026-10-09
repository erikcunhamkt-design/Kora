// Etapa 9 · Item 4, R7 — paridade do SIMULADOR com o nó "message": a mesma
// decisão de produção (extractMessageNodes + resolveMenuTurn), sobre os mesmos
// primitivos, com o estado carregado pelo cliente (`simState`). O simulador não
// reimplementa a cadeia — só embrulha o resultado (engine "menu", sem IA).
import { describe, it, expect } from "vitest";
import { simulateFlowTurn } from "../botFlowSimulation";
import {
  extractMenuNodes,
  extractMessageNodes,
  resolveMenuTurn,
  type RawFlowNode,
} from "../botFlowMenu";

const FRESH = { botFlowState: null, handedOver: false };

const TRIGGER = (nextNodeId?: string): RawFlowNode => ({
  id: "node-trigger",
  type: "trigger",
  enabled: true,
  properties: nextNodeId ? { nextNodeId } : {},
});
const AI_ON: RawFlowNode = { id: "node-ai", type: "ai", enabled: true, properties: {} };
const HANDOVER_ON: RawFlowNode = { id: "node-handover", type: "handover", enabled: true, properties: {} };

const MENU: RawFlowNode = {
  id: "menu-1",
  type: "menu",
  enabled: true,
  properties: {
    mensagem: "Como posso ajudar?",
    opcoes: [
      { numero: 1, rotulo: "Horário", nextNodeId: "msg-horario" },
      { numero: 2, rotulo: "Encerrar", nextNodeId: "msg-tchau" },
      { numero: 3, rotulo: "Humano", nextNodeId: "node-handover" },
    ],
    fallback: { maxTentativas: 2, acao: "reprompt" },
  },
} as RawFlowNode;
const MENU_PROMPT = "Como posso ajudar?\n1 - Horário\n2 - Encerrar\n3 - Humano";

const msg = (id: string, mensagem: string, nextNodeId?: string, enabled = true): RawFlowNode => ({
  id,
  type: "message",
  enabled,
  properties: nextNodeId ? { mensagem, nextNodeId } : { mensagem },
});

const IN_MENU = { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false };

describe("simulateFlowTurn — nó 'message' (R7)", () => {
  const nodes = [
    TRIGGER(),
    AI_ON,
    HANDOVER_ON,
    MENU,
    msg("msg-horario", "Horário: seg–sex 9h–18h", "menu-1"),
    msg("msg-tchau", "Obrigado pelo contato!"),
  ];

  it("opção → mensagem → menu: responde texto + menu juntos, engine 'menu', estado = o menu, sem IA", () => {
    const turn = simulateFlowTurn(nodes, IN_MENU, "1");
    expect(turn).toEqual({
      kind: "respond",
      reply: `Horário: seg–sex 9h–18h\n\n${MENU_PROMPT}`,
      simulation: { engine: "menu", botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false },
    });
  });

  it("mensagem SEM destino: responde só o texto e ZERA o estado (encerra) — ainda sem IA nesta virada", () => {
    const turn = simulateFlowTurn(nodes, IN_MENU, "2");
    expect(turn).toEqual({
      kind: "respond",
      reply: "Obrigado pelo contato!",
      simulation: { engine: "menu", botFlowState: null, handedOver: false },
    });
  });

  it("depois do encerramento a próxima mensagem do simulador reentra pelo menu de entrada", () => {
    const first = simulateFlowTurn(nodes, IN_MENU, "2");
    if (first.kind !== "respond") throw new Error("esperava respond");
    const second = simulateFlowTurn(
      nodes,
      { botFlowState: first.simulation.botFlowState, handedOver: false },
      "oi",
    );
    expect(second).toMatchObject({ kind: "respond", reply: MENU_PROMPT });
  });

  it("entrada: trigger.nextNodeId → mensagem de boas-vindas → menu (conversa nova)", () => {
    const withEntry = [
      TRIGGER("msg-boas-vindas"),
      AI_ON,
      MENU,
      msg("msg-boas-vindas", "Olá! Aqui é o robô.", "menu-1"),
      msg("msg-horario", "x"),
    ];
    expect(simulateFlowTurn(withEntry, FRESH, "oi")).toEqual({
      kind: "respond",
      reply: `Olá! Aqui é o robô.\n\n${MENU_PROMPT}`,
      simulation: { engine: "menu", botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false },
    });
  });

  it("trigger DESABILITADO: a aresta de entrada não vale (mesma regra de produção) → primeiro menu", () => {
    const disabledTrigger: RawFlowNode = { ...TRIGGER("msg-boas-vindas"), enabled: false };
    const withEntry = [disabledTrigger, AI_ON, MENU, msg("msg-boas-vindas", "Olá!", "menu-1")];
    expect(simulateFlowTurn(withEntry, FRESH, "oi")).toMatchObject({ reply: MENU_PROMPT });
  });

  it("ciclo message→message: responde o que foi acumulado e termina (não trava, estado null)", () => {
    const cyc = [
      TRIGGER(),
      AI_ON,
      MENU,
      msg("msg-horario", "A", "msg-b"),
      msg("msg-b", "B", "msg-horario"),
    ];
    expect(simulateFlowTurn(cyc, IN_MENU, "1")).toEqual({
      kind: "respond",
      reply: "A\n\nB",
      simulation: { engine: "menu", botFlowState: null, handedOver: false },
    });
  });

  it("mensagem desabilitada: a opção cai no fluxo normal (advanced-away → segue pra IA), como qualquer nó desconhecido", () => {
    const off = [TRIGGER(), AI_ON, MENU, msg("msg-horario", "x", "menu-1", false), msg("msg-tchau", "y")];
    const turn = simulateFlowTurn(off, IN_MENU, "1");
    expect(turn).toEqual({ kind: "continue", simulation: { engine: "ai", botFlowState: null, handedOver: false } });
  });

  it("fluxo SEM nós 'message' continua idêntico (R6): opção → nó desconhecido = advanced-away → IA", () => {
    const old = [TRIGGER(), AI_ON, MENU];
    expect(simulateFlowTurn(old, IN_MENU, "1")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: null, handedOver: false },
    });
  });

  it("PARIDADE: a resposta do simulador é a decisão de produção (extract* + resolveMenuTurn) — mesmo texto, mesmo estado", () => {
    for (const text of ["1", "2", "abc"]) {
      const prod = resolveMenuTurn(
        extractMenuNodes(nodes),
        IN_MENU.botFlowState,
        text,
        undefined,
        extractMessageNodes(nodes),
      );
      const sim = simulateFlowTurn(nodes, IN_MENU, text);
      if (prod.kind !== "message" && prod.kind !== "reprompt") throw new Error("esperava message/reprompt");
      expect(sim).toMatchObject({
        kind: "respond",
        reply: prod.message,
        simulation: { engine: "menu", botFlowState: prod.state },
      });
    }
  });
});
