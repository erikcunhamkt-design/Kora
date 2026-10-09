// Etapa 9 · Item 4, R8 — destinos "handover" e "ai" a partir de menu/mensagem.
// Motor (botFlowMenu.ts + botHandover.ts) e simulador (botFlowSimulation.ts)
// sobre os MESMOS primitivos. Matriz origem × destino:
//
//   origem            → handover habilitado          → ai habilitado
//   opção de menu     → R4 (advanced-away→entrega)   → R3 mantido: sai do menu, estado zerado, IA responde já
//   fallback "node"   → R4 (handover-fallback)       → R3 mantido (idem)
//   nó "message"      → R8: texto = cortesia         → R8: texto + modo IA persistido (IA na PRÓXIMA)
//   entrada (trigger) → inválida (só menu/mensagem)  → inválida
//
// Nó desabilitado (handover/ai) é SEMPRE destino inválido: nunca entrega nem
// passa à IA; a cadeia/menu encerra e o chamador loga.
import { describe, it, expect } from "vitest";
import {
  describeDestination,
  extractMenuNodes,
  extractMessageNodes,
  extractTerminalNodes,
  resolveEntryNode,
  resolveMenuTurn,
  type RawFlowNode,
} from "../botFlowMenu";
import { decideHandoverFromMenuTurn, HANDOVER_COURTESY_TEXT } from "../botHandover";
import { simulateFlowTurn } from "../botFlowSimulation";

const TRIGGER = (nextNodeId?: string): RawFlowNode => ({
  id: "node-trigger",
  type: "trigger",
  enabled: true,
  properties: nextNodeId ? { nextNodeId } : {},
});
const AI = (enabled = true): RawFlowNode => ({ id: "node-ai", type: "ai", enabled, properties: {} });
const HANDOVER = (enabled = true): RawFlowNode => ({ id: "node-handover", type: "handover", enabled, properties: {} });

const menu = (over: Record<string, unknown> = {}): RawFlowNode =>
  ({
    id: "menu-1",
    type: "menu",
    enabled: true,
    properties: {
      mensagem: "Como posso ajudar?",
      opcoes: [
        { numero: 1, rotulo: "Humano", nextNodeId: "node-handover" },
        { numero: 2, rotulo: "IA", nextNodeId: "node-ai" },
        { numero: 3, rotulo: "Aviso", nextNodeId: "msg-1" },
      ],
      fallback: { maxTentativas: 1, acao: "reprompt" },
      ...over,
    },
  }) as RawFlowNode;

const msg = (nextNodeId?: string, mensagem = "Vou te passar adiante.", id = "msg-1"): RawFlowNode => ({
  id,
  type: "message",
  enabled: true,
  properties: nextNodeId ? { mensagem, nextNodeId } : { mensagem },
});

const IN_MENU = { currentNodeId: "menu-1", attempts: 0 };

// Roda UMA virada no motor com os mesmos extractors que produção/simulador usam.
function turn(nodes: RawFlowNode[], state: typeof IN_MENU | null, text: string, entryNodeId?: string) {
  return resolveMenuTurn(
    extractMenuNodes(nodes),
    state,
    text,
    entryNodeId,
    extractMessageNodes(nodes),
    extractTerminalNodes(nodes),
  );
}

describe("extractTerminalNodes / describeDestination (R8)", () => {
  it("só handover/ai HABILITADOS entram; desabilitado fica de fora", () => {
    expect(extractTerminalNodes([TRIGGER(), AI(), HANDOVER(false)])).toEqual({
      handoverIds: [],
      aiIds: ["node-ai"],
    });
    expect(extractTerminalNodes([AI(false), HANDOVER()])).toEqual({ handoverIds: ["node-handover"], aiIds: [] });
    expect(extractTerminalNodes([])).toEqual({ handoverIds: [], aiIds: [] });
  });

  it("describeDestination diz por que o destino não vale (só pra log)", () => {
    const nodes = [AI(false), HANDOVER(), TRIGGER()];
    expect(describeDestination(nodes, "node-ai")).toMatch(/DESABILITADO/);
    expect(describeDestination(nodes, "fantasma")).toBe("nó inexistente");
    expect(describeDestination(nodes, "node-trigger")).toMatch(/tipo não suportado/);
  });
});

describe("origem = opção de menu (R4/R3 mantidos — o R8 não muda o que já existia)", () => {
  it("→ handover HABILITADO: entrega a humano (menu_option) com a cortesia padrão", () => {
    const t = turn([menu(), HANDOVER(), AI()], IN_MENU, "1");
    expect(t).toEqual({ kind: "advanced-away", nextNodeId: "node-handover" });
    expect(decideHandoverFromMenuTurn(t, [menu(), HANDOVER(), AI()])).toEqual({ handover: true, reason: "menu_option" });
  });

  it("→ handover DESABILITADO: destino inválido — NÃO entrega (sai do menu, fluxo normal)", () => {
    const nodes = [menu(), HANDOVER(false), AI()];
    const t = turn(nodes, IN_MENU, "1");
    expect(t).toEqual({ kind: "advanced-away", nextNodeId: "node-handover" });
    expect(decideHandoverFromMenuTurn(t, nodes)).toEqual({ handover: false });
  });

  it("→ ai HABILITADO: sai do menu com estado zerado (advanced-away) e a IA responde já (semântica R3 mantida)", () => {
    const nodes = [menu(), HANDOVER(), AI()];
    const t = turn(nodes, IN_MENU, "2");
    expect(t).toEqual({ kind: "advanced-away", nextNodeId: "node-ai" });
    expect(decideHandoverFromMenuTurn(t, nodes)).toEqual({ handover: false });
  });
});

describe("origem = fallback acao 'node'", () => {
  const fb = (target: string) => menu({ fallback: { maxTentativas: 1, acao: "node", fallbackNodeId: target } });

  it("→ handover habilitado entrega (menu_fallback_node); desabilitado não entrega", () => {
    const on = [fb("node-handover"), HANDOVER(), AI()];
    const t = turn(on, IN_MENU, "banana");
    expect(t).toEqual({ kind: "handover-fallback", fallbackNodeId: "node-handover" });
    expect(decideHandoverFromMenuTurn(t, on)).toEqual({ handover: true, reason: "menu_fallback_node" });

    const off = [fb("node-handover"), HANDOVER(false), AI()];
    expect(decideHandoverFromMenuTurn(turn(off, IN_MENU, "banana"), off)).toEqual({ handover: false });
  });

  it("→ ai habilitado: sai do menu (handover-fallback, sem entrega) e a IA responde", () => {
    const nodes = [fb("node-ai"), HANDOVER(), AI()];
    const t = turn(nodes, IN_MENU, "banana");
    expect(t).toEqual({ kind: "handover-fallback", fallbackNodeId: "node-ai" });
    expect(decideHandoverFromMenuTurn(t, nodes)).toEqual({ handover: false });
  });
});

describe("origem = nó 'message' → handover (texto da mensagem é a cortesia)", () => {
  it("opção → mensagem → handover habilitado: resposta = texto da mensagem; destino handover; sem estado", () => {
    const t = turn([menu(), msg("node-handover"), HANDOVER(), AI()], IN_MENU, "3");
    expect(t).toEqual({
      kind: "message",
      message: "Vou te passar adiante.",
      state: null,
      messageNodeIds: ["msg-1"],
      destination: { kind: "handover", nodeId: "node-handover" },
    });
  });

  it("cadeia de 2 mensagens → handover: a cortesia é a cadeia inteira, numa resposta só", () => {
    const nodes = [menu(), msg("msg-2", "Um momento."), msg("node-handover", "Já te passo.", "msg-2"), HANDOVER()];
    const t = turn(nodes, IN_MENU, "3");
    expect(t).toMatchObject({
      kind: "message",
      message: "Um momento.\n\nJá te passo.",
      destination: { kind: "handover", nodeId: "node-handover" },
    });
  });

  it("handover DESABILITADO: o texto ainda sai, mas NÃO entrega — destino inválido (unresolvedNextNodeId pro log)", () => {
    const t = turn([menu(), msg("node-handover"), HANDOVER(false)], IN_MENU, "3");
    expect(t).toEqual({
      kind: "message",
      message: "Vou te passar adiante.",
      state: null,
      messageNodeIds: ["msg-1"],
      unresolvedNextNodeId: "node-handover",
    });
    expect((t as { destination?: unknown }).destination).toBeUndefined();
  });

  it("a cortesia da R4 NÃO é somada: a decisão do botHandover não duplica (message não é advanced-away)", () => {
    const nodes = [menu(), msg("node-handover"), HANDOVER()];
    expect(decideHandoverFromMenuTurn(turn(nodes, IN_MENU, "3"), nodes)).toEqual({ handover: false });
  });
});

describe("origem = nó 'message' → ai (texto como saudação + modo IA persistido)", () => {
  it("opção → mensagem → ai habilitado: envia o texto, estado = marcador de modo IA, SEM IA nesta virada", () => {
    const t = turn([menu(), msg("node-ai", "Pode me contar o que precisa!"), AI(), HANDOVER()], IN_MENU, "3");
    expect(t).toEqual({
      kind: "message",
      message: "Pode me contar o que precisa!",
      state: { currentNodeId: "node-ai", attempts: 0 },
      messageNodeIds: ["msg-1"],
      destination: { kind: "ai", nodeId: "node-ai" },
    });
  });

  it("DALI EM DIANTE: com o marcador, as próximas mensagens não reapresentam o menu (ai-mode, qualquer texto)", () => {
    const nodes = [menu(), msg("node-ai"), AI(), HANDOVER()];
    const marker = { currentNodeId: "node-ai", attempts: 0 };
    for (const text of ["oi", "1", "qual o horário?"]) {
      expect(turn(nodes, marker, text)).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
    }
  });

  it("ai DESABILITADO: o texto sai, nenhum marcador é gravado e o destino é inválido (log)", () => {
    const t = turn([menu(), msg("node-ai"), AI(false)], IN_MENU, "3");
    expect(t).toEqual({
      kind: "message",
      message: "Vou te passar adiante.",
      state: null,
      messageNodeIds: ["msg-1"],
      unresolvedNextNodeId: "node-ai",
    });
  });

  it("marcador órfão (nó ai foi desabilitado/removido depois): estado obsoleto → reentra pelo menu de entrada", () => {
    const nodes = [menu(), msg("node-ai"), AI(false)];
    expect(turn(nodes, { currentNodeId: "node-ai", attempts: 0 }, "oi")).toMatchObject({
      kind: "present",
      state: { currentNodeId: "menu-1", attempts: 0 },
    });
  });

  it("entrada → mensagem → ai: a conversa nova recebe a saudação e entra em modo IA (sem menu)", () => {
    const nodes = [TRIGGER("msg-1"), menu(), msg("node-ai", "Olá! Sou a assistente."), AI()];
    const t = turn(nodes, null, "oi", "msg-1");
    expect(t).toMatchObject({
      kind: "message",
      message: "Olá! Sou a assistente.",
      state: { currentNodeId: "node-ai", attempts: 0 },
      destination: { kind: "ai", nodeId: "node-ai" },
    });
  });
});

describe("origem = entrada (trigger.nextNodeId) NÃO aceita handover/ai", () => {
  it("resolveEntryNode trata como aresta inválida e cai no primeiro menu (invalid-edge, pro log)", () => {
    const menus = extractMenuNodes([menu()]);
    for (const target of ["node-handover", "node-ai"]) {
      expect(resolveEntryNode(menus, [], target)).toMatchObject({ kind: "menu", reason: "invalid-edge" });
    }
  });

  it("na virada: conversa nova com entrada apontando pra handover/ai apresenta o primeiro menu (nada é entregue)", () => {
    const nodes = [TRIGGER("node-handover"), menu(), HANDOVER(), AI()];
    expect(turn(nodes, null, "oi", "node-handover")).toMatchObject({ kind: "present", state: { currentNodeId: "menu-1" } });
  });
});

describe("simulador — paridade com produção (R8)", () => {
  const FRESH = { botFlowState: null, handedOver: false };
  const inMenu = { botFlowState: IN_MENU, handedOver: false };

  it("mensagem → handover: bolha = texto da mensagem (cortesia), engine 'handover' (motivo message_next), entregue", () => {
    const nodes = [TRIGGER(), menu(), msg("node-handover"), HANDOVER(), AI()];
    expect(simulateFlowTurn(nodes, inMenu, "3")).toEqual({
      kind: "respond",
      reply: "Vou te passar adiante.",
      simulation: { engine: "handover", handoverReason: "message_next", botFlowState: null, handedOver: true },
    });
  });

  it("depois da entrega o simulador fica em silêncio (mesmo gate de produção)", () => {
    const nodes = [TRIGGER(), menu(), msg("node-handover"), HANDOVER(), AI()];
    const first = simulateFlowTurn(nodes, inMenu, "3");
    if (first.kind !== "respond") throw new Error("esperava respond");
    expect(simulateFlowTurn(nodes, { botFlowState: null, handedOver: first.simulation.handedOver }, "alô")).toEqual({
      kind: "respond",
      reply: null,
      simulation: { engine: "silent", botFlowState: null, handedOver: true },
    });
  });

  it("mensagem → handover DESABILITADO: só o texto (engine 'menu'), sem entrega e sem estado", () => {
    const nodes = [TRIGGER(), menu(), msg("node-handover"), HANDOVER(false), AI()];
    expect(simulateFlowTurn(nodes, inMenu, "3")).toEqual({
      kind: "respond",
      reply: "Vou te passar adiante.",
      simulation: { engine: "menu", botFlowState: null, handedOver: false },
    });
  });

  it("mensagem → ai: responde a saudação (sem IA), grava o modo IA; na PRÓXIMA a IA responde e o modo é mantido", () => {
    const nodes = [TRIGGER(), menu(), msg("node-ai", "Pode me contar!"), HANDOVER(false), AI()];
    const first = simulateFlowTurn(nodes, inMenu, "3");
    expect(first).toEqual({
      kind: "respond",
      reply: "Pode me contar!",
      simulation: { engine: "menu", botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false },
    });
    if (first.kind !== "respond") throw new Error("esperava respond");

    const second = simulateFlowTurn(nodes, { botFlowState: first.simulation.botFlowState, handedOver: false }, "qual o horário?");
    expect(second).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false },
    });
  });

  it("modo IA + palavra-chave de handover (nó handover habilitado): a entrega por palavra-chave continua valendo", () => {
    const nodes = [TRIGGER(), menu(), msg("node-ai"), HANDOVER(), AI()];
    const turn2 = simulateFlowTurn(nodes, { botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false }, "quero falar com um atendente");
    expect(turn2).toMatchObject({
      kind: "respond",
      reply: HANDOVER_COURTESY_TEXT,
      simulation: { engine: "handover", handoverReason: "keyword", handedOver: true },
    });
  });

  it("mensagem → ai DESABILITADO: texto sem marcador; a próxima mensagem reentra pelo menu", () => {
    const nodes = [TRIGGER(), menu(), msg("node-ai"), AI(false)];
    const first = simulateFlowTurn(nodes, inMenu, "3");
    expect(first).toMatchObject({ kind: "respond", simulation: { engine: "menu", botFlowState: null } });
  });

  it("opção → ai direto continua como na R3/lane D: estado zerado e a IA responde já", () => {
    const nodes = [TRIGGER(), menu(), msg("node-ai"), HANDOVER(), AI()];
    expect(simulateFlowTurn(nodes, inMenu, "2")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: null, handedOver: false },
    });
  });

  it("sem nós message/terminais novos o simulador é idêntico (menu presente na primeira virada)", () => {
    expect(simulateFlowTurn([TRIGGER(), menu(), AI()], FRESH, "oi")).toMatchObject({
      kind: "respond",
      simulation: { engine: "menu", botFlowState: { currentNodeId: "menu-1", attempts: 0 } },
    });
  });
});
