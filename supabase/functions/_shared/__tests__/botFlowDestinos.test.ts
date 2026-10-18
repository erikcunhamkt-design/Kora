// Etapa 9 · Item 4, R8 — destinos "handover" e "ai" a partir de menu/mensagem.
// Motor (botFlowMenu.ts + botHandover.ts) e simulador (botFlowSimulation.ts)
// sobre os MESMOS primitivos. Matriz origem × destino:
//
//   origem            → handover habilitado          → ai habilitado
//   opção de menu     → R4 (advanced-away→entrega)   → R8: modo IA (marcador) + IA responde já
//   fallback "node"   → R4 (handover-fallback)       → R8: modo IA (marcador) + IA responde já
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

describe("origem = opção de menu (handover = R4 inalterado; ai = modo IA, R8-ajuste)", () => {
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

  it("→ ai HABILITADO: sai do menu em MODO IA (marcador) e a IA responde já; sem entrega", () => {
    const nodes = [menu(), HANDOVER(), AI()];
    const t = turn(nodes, IN_MENU, "2");
    expect(t).toEqual({ kind: "to-ai", nodeId: "node-ai", state: { currentNodeId: "node-ai", attempts: 0 } });
    expect(decideHandoverFromMenuTurn(t, nodes)).toEqual({ handover: false });
  });

  it("→ ai DESABILITADO: destino inválido — sem marcador (advanced-away, estado zerado); nunca passa à IA por nó desligado", () => {
    const nodes = [menu(), HANDOVER(), AI(false)];
    expect(turn(nodes, IN_MENU, "2")).toEqual({ kind: "advanced-away", nextNodeId: "node-ai" });
  });

  it("consistência entre as 3 origens: opção, fallback e mensagem → ai gravam o MESMO marcador", () => {
    const viaOption = turn([menu(), HANDOVER(), AI()], IN_MENU, "2");
    const viaFallback = turn(
      [menu({ fallback: { maxTentativas: 1, acao: "node", fallbackNodeId: "node-ai" } }), HANDOVER(), AI()],
      IN_MENU,
      "banana",
    );
    const viaMessage = turn([menu(), msg("node-ai"), HANDOVER(), AI()], IN_MENU, "3");
    const states = [viaOption, viaFallback, viaMessage].map((t) => (t as { state: unknown }).state);
    expect(states).toEqual([{ currentNodeId: "node-ai", attempts: 0 }, { currentNodeId: "node-ai", attempts: 0 }, { currentNodeId: "node-ai", attempts: 0 }]);
  });

  it("DALI EM DIANTE também pela opção direta: as mensagens seguintes ficam em ai-mode (menu não volta)", () => {
    const nodes = [menu(), HANDOVER(), AI()];
    const first = turn(nodes, IN_MENU, "2");
    if (first.kind !== "to-ai") throw new Error("esperava to-ai");
    for (const text of ["oi", "2", "banana"]) {
      expect(turn(nodes, first.state, text)).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
    }
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

  it("→ ai habilitado: modo IA (marcador), sem entrega, a IA responde já", () => {
    const nodes = [fb("node-ai"), HANDOVER(), AI()];
    const t = turn(nodes, IN_MENU, "banana");
    expect(t).toEqual({ kind: "to-ai", nodeId: "node-ai", state: { currentNodeId: "node-ai", attempts: 0 } });
    expect(decideHandoverFromMenuTurn(t, nodes)).toEqual({ handover: false });
  });

  it("→ ai desabilitado: handover-fallback comum (destino inválido, sem marcador)", () => {
    expect(turn([fb("node-ai"), HANDOVER(), AI(false)], IN_MENU, "banana")).toEqual({
      kind: "handover-fallback",
      fallbackNodeId: "node-ai",
    });
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
      simulation: { engine: "menu", botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false, enteredAi: true },
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

  it("opção → ai direto: modo IA (marcador) e a IA responde já; a mensagem seguinte segue em IA, sem selo de novo", () => {
    const nodes = [TRIGGER(), menu(), msg("node-ai"), HANDOVER(false), AI()];
    const first = simulateFlowTurn(nodes, inMenu, "2");
    expect(first).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false, enteredAi: true },
    });
    if (first.kind !== "continue") throw new Error("esperava continue");
    expect(simulateFlowTurn(nodes, { botFlowState: first.simulation.botFlowState, handedOver: false }, "e o horário?")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: { currentNodeId: "node-ai", attempts: 0 }, handedOver: false },
    });
  });

  it("PARIDADE produção↔simulador nas 3 origens → ai: mesmo estado gravado", () => {
    const origins: Array<[RawFlowNode[], typeof inMenu, string]> = [
      [[TRIGGER(), menu(), HANDOVER(false), AI()], inMenu, "2"],
      [[TRIGGER(), menu({ fallback: { maxTentativas: 1, acao: "node", fallbackNodeId: "node-ai" } }), HANDOVER(false), AI()], inMenu, "banana"],
      [[TRIGGER(), menu(), msg("node-ai"), HANDOVER(false), AI()], inMenu, "3"],
    ];
    for (const [nodes, st, text] of origins) {
      const prod = turn(nodes, st.botFlowState, text);
      const sim = simulateFlowTurn(nodes, st, text);
      const prodState = (prod as { state: unknown }).state;
      expect(sim).toMatchObject({ simulation: { botFlowState: prodState, enteredAi: true } });
    }
  });

  it("sem nós message/terminais novos o simulador é idêntico (menu presente na primeira virada)", () => {
    expect(simulateFlowTurn([TRIGGER(), menu(), AI()], FRESH, "oi")).toMatchObject({
      kind: "respond",
      simulation: { engine: "menu", botFlowState: { currentNodeId: "menu-1", attempts: 0 } },
    });
  });
});
