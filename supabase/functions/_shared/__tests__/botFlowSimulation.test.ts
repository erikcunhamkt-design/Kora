// Etapa 9 · Item 4 — cobertura do simulador (docs/qa/etapa-9-bot-simulador-
// fluxo-cobertura.md). Testes unitários com mocks puros: o simulador passa a
// exercitar o MESMO motor de menu (R3) e handover (R4) de produção, com o
// estado carregado pelo cliente (`simState`).
import { describe, it, expect } from "vitest";
import {
  parseSimState,
  simulateFlowTurn,
  wantsFlowSimulation,
} from "../botFlowSimulation";
import { HANDOVER_COURTESY_TEXT } from "../botHandover";
import { renderMenuPrompt, type MenuNode, type RawFlowNode } from "../botFlowMenu";

const FRESH = { botFlowState: null, handedOver: false };

function menuRaw(id: string, overrides: Record<string, unknown> = {}): RawFlowNode {
  return {
    id,
    type: "menu",
    enabled: true,
    properties: {
      mensagem: "Escolha uma opção:",
      opcoes: [
        { numero: 1, rotulo: "Financeiro", nextNodeId: "menu-fin" },
        { numero: 2, rotulo: "Falar com atendente", nextNodeId: "node-handover" },
        { numero: 3, rotulo: "Virar IA", nextNodeId: "node-ai" },
      ],
      fallback: { maxTentativas: 2, acao: "reprompt" },
      ...overrides,
    },
  } as RawFlowNode;
}

const MENU_FIN: RawFlowNode = {
  id: "menu-fin",
  type: "menu",
  enabled: true,
  properties: {
    mensagem: "Financeiro:",
    opcoes: [{ numero: 1, rotulo: "Boletos", nextNodeId: "node-ai" }],
    fallback: { maxTentativas: 2, acao: "reprompt" },
  },
} as RawFlowNode;

const HANDOVER_ON: RawFlowNode = { id: "node-handover", type: "handover", enabled: true, properties: {} };
const HANDOVER_OFF: RawFlowNode = { id: "node-handover", type: "handover", enabled: false, properties: {} };
const AI_ON: RawFlowNode = { id: "node-ai", type: "ai", enabled: true, properties: {} };
const TRIGGER: RawFlowNode = { id: "node-trigger", type: "trigger", enabled: true, properties: {} };

// Reconstrói o MenuNode esperado só pra comparar o texto renderizado.
function asMenuNode(raw: RawFlowNode): MenuNode {
  const p = raw.properties as { mensagem: string; opcoes: MenuNode["opcoes"]; fallback: MenuNode["fallback"] };
  return { id: raw.id, mensagem: p.mensagem, opcoes: p.opcoes, fallback: p.fallback };
}

describe("wantsFlowSimulation (contrato de opt-in — sem simState o simulador é o de antes)", () => {
  it("undefined (UI antiga, sem o campo) -> NÃO opta: comportamento de antes, byte a byte", () => {
    expect(wantsFlowSimulation(undefined)).toBe(false);
  });

  it("null (primeira mensagem do simulador novo) e objeto -> opta", () => {
    expect(wantsFlowSimulation(null)).toBe(true);
    expect(wantsFlowSimulation(FRESH)).toBe(true);
  });
});

describe("parseSimState (defensivo)", () => {
  it("estado bem formado é lido", () => {
    expect(parseSimState({ botFlowState: { currentNodeId: "menu-1", attempts: 2 }, handedOver: true })).toEqual({
      botFlowState: { currentNodeId: "menu-1", attempts: 2 },
      handedOver: true,
    });
  });

  it("null / lixo / campos malformados -> estado inicial (nunca lança)", () => {
    expect(parseSimState(null)).toEqual(FRESH);
    expect(parseSimState("x")).toEqual(FRESH);
    expect(parseSimState({ botFlowState: "lixo", handedOver: "true" })).toEqual(FRESH);
  });
});

describe("simulateFlowTurn — motor do menu (R3) no simulador", () => {
  const nodes = [TRIGGER, menuRaw("menu-1"), MENU_FIN, HANDOVER_ON, AI_ON];

  it("primeira mensagem (sem estado) -> apresenta o menu, sem IA, e devolve o estado", () => {
    const turn = simulateFlowTurn(nodes, FRESH, "oi");
    expect(turn).toEqual({
      kind: "respond",
      reply: renderMenuPrompt(asMenuNode(menuRaw("menu-1"))),
      simulation: { engine: "menu", botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false },
    });
  });

  it("resposta válida avança pro próximo menu (encadeamento) usando o estado devolvido", () => {
    const first = simulateFlowTurn(nodes, FRESH, "oi");
    if (first.kind !== "respond") throw new Error("esperava respond");
    const second = simulateFlowTurn(nodes, { botFlowState: first.simulation.botFlowState, handedOver: false }, "1");
    expect(second).toMatchObject({
      kind: "respond",
      reply: renderMenuPrompt(asMenuNode(MENU_FIN)),
      simulation: { engine: "menu", botFlowState: { currentNodeId: "menu-fin", attempts: 0 } },
    });
  });

  it("resposta inválida -> reprompt, contador de tentativas sobe e volta no estado", () => {
    const turn = simulateFlowTurn(nodes, { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false }, "abc");
    expect(turn.kind).toBe("respond");
    if (turn.kind !== "respond") return;
    expect(turn.reply).toContain("Resposta inválida");
    expect(turn.simulation).toEqual({ engine: "menu", botFlowState: { currentNodeId: "menu-1", attempts: 1 }, handedOver: false });
  });

  it("opção que leva a nó NÃO-handover (ex.: ai) -> sai do menu e segue pra IA, estado zerado", () => {
    const turn = simulateFlowTurn(nodes, { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false }, "3");
    expect(turn).toEqual({ kind: "continue", simulation: { engine: "ai", botFlowState: null, handedOver: false } });
  });
});

describe("simulateFlowTurn — handover real (R4) no simulador", () => {
  const nodes = [TRIGGER, menuRaw("menu-1"), MENU_FIN, HANDOVER_ON, AI_ON];
  const inMenu = { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false };

  it("gatilho 1 — opção do menu leva ao nó handover -> entrega (texto de cortesia, bot mudo daqui em diante)", () => {
    expect(simulateFlowTurn(nodes, inMenu, "2")).toEqual({
      kind: "respond",
      reply: HANDOVER_COURTESY_TEXT,
      simulation: { engine: "handover", handoverReason: "menu_option", botFlowState: null, handedOver: true },
    });
  });

  it("gatilho 2 — estouro com acao \"node\" apontando pra um handover -> entrega", () => {
    const withNodeFallback = [
      menuRaw("menu-1", { fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "node-handover" } }),
      HANDOVER_ON,
      AI_ON,
    ];
    const turn = simulateFlowTurn(withNodeFallback, { botFlowState: { currentNodeId: "menu-1", attempts: 1 }, handedOver: false }, "xyz");
    expect(turn).toMatchObject({
      kind: "respond",
      reply: HANDOVER_COURTESY_TEXT,
      simulation: { engine: "handover", handoverReason: "menu_fallback_node", handedOver: true },
    });
  });

  it("gatilho 3 — acao \"reprompt\" esgotada -> entrega (decisão do operador)", () => {
    const turn = simulateFlowTurn(nodes, { botFlowState: { currentNodeId: "menu-1", attempts: 1 }, handedOver: false }, "xyz");
    expect(turn).toMatchObject({
      kind: "respond",
      reply: HANDOVER_COURTESY_TEXT,
      simulation: { engine: "handover", handoverReason: "menu_exhausted", handedOver: true },
    });
  });

  it("estouro com acao \"node\" apontando pra nó NÃO-handover -> sai do menu e segue pra IA (não entrega)", () => {
    const toAi = [
      menuRaw("menu-1", { fallback: { maxTentativas: 1, acao: "node", fallbackNodeId: "node-ai" } }),
      HANDOVER_ON,
      AI_ON,
    ];
    const turn = simulateFlowTurn(toAi, inMenu, "xyz");
    expect(turn).toEqual({ kind: "continue", simulation: { engine: "ai", botFlowState: null, handedOver: false } });
  });

  it("nó handover DESABILITADO: opção que aponta pra ele não entrega (mesma regra de produção)", () => {
    const turn = simulateFlowTurn([menuRaw("menu-1"), HANDOVER_OFF, AI_ON], inMenu, "2");
    expect(turn).toEqual({ kind: "continue", simulation: { engine: "ai", botFlowState: null, handedOver: false } });
  });

  it("bot SILENCIOSO enquanto entregue: qualquer mensagem seguinte -> reply null, engine silent, continua entregue", () => {
    for (const msg of ["oi?", "1", "alguém aí?"]) {
      expect(simulateFlowTurn(nodes, { botFlowState: null, handedOver: true }, msg)).toEqual({
        kind: "respond",
        reply: null,
        simulation: { engine: "silent", botFlowState: null, handedOver: true },
      });
    }
  });

  it("DEVOLUÇÃO: o cliente zera o simState (botão limpar/devolver) -> o bot volta do zero, re-apresenta o menu", () => {
    const afterReturn = simulateFlowTurn(nodes, FRESH, "oi");
    expect(afterReturn).toMatchObject({ kind: "respond", simulation: { engine: "menu", handedOver: false } });
  });

  it("palavra-chave (sem menu): entrega quando há nó handover habilitado, com reason keyword", () => {
    const linear = [TRIGGER, AI_ON, HANDOVER_ON];
    expect(simulateFlowTurn(linear, FRESH, "quero falar com um ATENDENTE")).toEqual({
      kind: "respond",
      reply: HANDOVER_COURTESY_TEXT,
      simulation: { engine: "handover", handoverReason: "keyword", botFlowState: null, handedOver: true },
    });
  });

  it("palavra-chave NÃO entrega se o nó handover está desabilitado", () => {
    const linear = [TRIGGER, AI_ON, HANDOVER_OFF];
    expect(simulateFlowTurn(linear, FRESH, "atendente")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: null, handedOver: false },
    });
  });

  it("PARIDADE DE ORDEM com produção: com menu ativo o menu responde ANTES do handover por palavra-chave", () => {
    // Produção: o bloco do menu devolve cedo (present/reprompt) antes de chegar na palavra-chave.
    const turn = simulateFlowTurn([menuRaw("menu-1"), MENU_FIN, HANDOVER_ON, AI_ON], FRESH, "quero um atendente");
    expect(turn).toMatchObject({ kind: "respond", simulation: { engine: "menu" } });
  });
});

describe("simulateFlowTurn — fluxo SÓ com menu (sem nó ai) e os gates de produção", () => {
  it("menu-only: apresenta o menu e entrega a humano sem nunca precisar de IA", () => {
    const menuOnly = [menuRaw("menu-1"), HANDOVER_ON];
    const first = simulateFlowTurn(menuOnly, FRESH, "oi");
    expect(first).toMatchObject({ kind: "respond", simulation: { engine: "menu" } });
    const second = simulateFlowTurn(menuOnly, { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false }, "2");
    expect(second).toMatchObject({ kind: "respond", simulation: { engine: "handover", handoverReason: "menu_option" } });
  });

  it("espelha o gate \"AI node disabled\": fluxo com nós, sem ai habilitado, e fora do menu -> skipped (reply null)", () => {
    // Opção do menu leva a um nó não-menu e não existe nó ai: produção não responderia.
    const noAi = [menuRaw("menu-1", { opcoes: [{ numero: 1, rotulo: "Send", nextNodeId: "node-send" }] }), HANDOVER_ON];
    const turn = simulateFlowTurn(noAi, { botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false }, "1");
    expect(turn).toEqual({ kind: "respond", reply: null, simulation: { engine: "skipped", botFlowState: null, handedOver: false } });
  });

  it("fluxo sem nenhum nó (flowData vazio) -> segue pra IA como sempre", () => {
    expect(simulateFlowTurn([], FRESH, "oi")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: null, handedOver: false },
    });
  });

  it("fluxo SEM nó menu e sem palavra-chave -> segue pra IA, zero regressão pro bot IA", () => {
    expect(simulateFlowTurn([TRIGGER, AI_ON, HANDOVER_ON], FRESH, "qual o preço?")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: null, handedOver: false },
    });
  });
});
