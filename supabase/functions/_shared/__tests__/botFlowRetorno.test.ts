// Etapa 9 · Item 4, R9 — SAÍDA do modo IA. O nó ai pode definir `palavraRetorno`:
// em modo IA (marcador em bot_flow_state apontando pro nó ai), a mensagem INTEIRA
// do cliente igual à palavra (sem acento, sem caixa, trim) zera o marcador e
// reentra pelo nó de entrada na MESMA virada — sem IA. Palavra ausente/vazia =
// sem saída (comportamento da R8). Motor + simulador sobre os mesmos primitivos.
import { describe, it, expect } from "vitest";
import {
  extractMenuNodes,
  extractMessageNodes,
  extractTerminalNodes,
  normalizeReturnWord,
  resolveMenuTurn,
  type RawFlowNode,
} from "../botFlowMenu";
import { simulateFlowTurn } from "../botFlowSimulation";

const TRIGGER = (nextNodeId?: string): RawFlowNode => ({
  id: "node-trigger",
  type: "trigger",
  enabled: true,
  properties: nextNodeId ? { nextNodeId } : {},
});
const AI = (palavraRetorno?: unknown, id = "node-ai", enabled = true): RawFlowNode => ({
  id,
  type: "ai",
  enabled,
  properties: palavraRetorno === undefined ? {} : { palavraRetorno },
});
const MENU: RawFlowNode = {
  id: "menu-1",
  type: "menu",
  enabled: true,
  properties: {
    mensagem: "Como posso ajudar?",
    opcoes: [
      { numero: 1, rotulo: "Falar com a IA", nextNodeId: "node-ai" },
      { numero: 2, rotulo: "Horário", nextNodeId: "msg-horario" },
    ],
    fallback: { maxTentativas: 3, acao: "reprompt" },
  },
} as RawFlowNode;
const MENU_PROMPT = "Como posso ajudar?\n1 - Falar com a IA\n2 - Horário";
const msg = (id: string, mensagem: string, nextNodeId?: string): RawFlowNode => ({
  id,
  type: "message",
  enabled: true,
  properties: nextNodeId ? { mensagem, nextNodeId } : { mensagem },
});

const IN_AI = { currentNodeId: "node-ai", attempts: 0 };

function turn(nodes: RawFlowNode[], state: { currentNodeId: string; attempts: number } | null, text: string, entry?: string) {
  return resolveMenuTurn(
    extractMenuNodes(nodes),
    state,
    text,
    entry,
    extractMessageNodes(nodes),
    extractTerminalNodes(nodes),
  );
}

describe("normalizeReturnWord (R9)", () => {
  it("trim, caixa, acento e espaços internos; não mexe em pontuação", () => {
    expect(normalizeReturnWord("  MENU  ")).toBe("menu");
    expect(normalizeReturnWord("Início")).toBe("inicio");
    expect(normalizeReturnWord("INÍCIO")).toBe("inicio");
    expect(normalizeReturnWord("voltar   ao\tmenu")).toBe("voltar ao menu");
    expect(normalizeReturnWord("menu!")).toBe("menu!");
  });

  it("não-string/vazio/só espaços → '' (sem palavra)", () => {
    for (const v of [undefined, null, 42, {}, "", "   "]) expect(normalizeReturnWord(v)).toBe("");
  });
});

describe("extractTerminalNodes — aiReturnWords (R9)", () => {
  it("só nós ai HABILITADOS com palavra não vazia, já normalizada", () => {
    expect(extractTerminalNodes([AI("  Menu "), AI("   ", "ai-2"), AI(undefined, "ai-3"), AI("Voltar", "ai-4", false)])).toEqual({
      handoverIds: [],
      aiIds: ["node-ai", "ai-2", "ai-3"],
      aiReturnWords: { "node-ai": "menu" },
    });
  });

  it("sem nenhuma palavra: o campo nem existe (forma idêntica à da R8)", () => {
    expect(extractTerminalNodes([AI(), AI("", "ai-2")])).toEqual({ handoverIds: [], aiIds: ["node-ai", "ai-2"] });
  });
});

describe("modo IA com palavra de retorno — motor", () => {
  const nodes = [TRIGGER(), MENU, AI("menu"), msg("msg-horario", "Seg–sex 9h–18h", "menu-1")];

  it("mensagem IGUAL à palavra: sai do modo IA e reentra pelo menu na mesma virada (sem IA)", () => {
    expect(turn(nodes, IN_AI, "menu")).toEqual({
      kind: "present",
      message: MENU_PROMPT,
      state: { currentNodeId: "menu-1", attempts: 0 },
      returnedFromAi: "node-ai",
    });
  });

  it("variações de caixa, acento e espaços em volta disparam", () => {
    for (const text of ["MENU", "Menu", " menu ", "\nmenu\n", "mEnU"]) {
      expect(turn(nodes, IN_AI, text), text).toMatchObject({ kind: "present", returnedFromAi: "node-ai" });
    }
  });

  it("palavra com acento casa sem acento e vice-versa", () => {
    const withAccent = [TRIGGER(), MENU, AI("Início")];
    for (const text of ["inicio", "INÍCIO", "Início", "iNiCiO"]) {
      expect(turn(withAccent, IN_AI, text), text).toMatchObject({ kind: "present", returnedFromAi: "node-ai" });
    }
    const noAccent = [TRIGGER(), MENU, AI("inicio")];
    expect(turn(noAccent, IN_AI, "INÍCIO")).toMatchObject({ kind: "present" });
  });

  it("SUBSTRING NÃO dispara: frase que contém a palavra, plural, prefixo, pontuação extra → segue em modo IA", () => {
    for (const text of ["quero voltar ao menu", "menu por favor", "menus", "me", "menu!", "o menu", "menu menu"]) {
      expect(turn(nodes, IN_AI, text), text).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
    }
  });

  it("palavra de várias palavras: mensagem inteira com espaços normalizados", () => {
    const multi = [TRIGGER(), MENU, AI("voltar ao menu")];
    expect(turn(multi, IN_AI, "Voltar  ao   MENU")).toMatchObject({ kind: "present", returnedFromAi: "node-ai" });
    expect(turn(multi, IN_AI, "voltar")).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
  });

  it("SEM palavra (ausente, vazia ou só espaços): nenhuma saída — qualquer texto continua em modo IA (R8)", () => {
    for (const ai of [AI(), AI(""), AI("   "), AI(42)]) {
      const n = [TRIGGER(), MENU, ai];
      expect(turn(n, IN_AI, "menu")).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
    }
  });

  it("depois da saída o estado é o menu: a conversa segue o fluxo normal (opção 2 → mensagem)", () => {
    const back = turn(nodes, IN_AI, "menu");
    if (back.kind !== "present") throw new Error("esperava present");
    expect(turn(nodes, back.state, "2")).toMatchObject({
      kind: "message",
      message: `Seg–sex 9h–18h\n\n${MENU_PROMPT}`,
    });
  });

  it("a palavra vale só pro nó ai em que a conversa ESTÁ (outro nó ai com outra palavra não interfere)", () => {
    const two = [TRIGGER(), MENU, AI("menu"), AI("sair", "ai-2")];
    expect(turn(two, IN_AI, "sair")).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
    expect(turn(two, { currentNodeId: "ai-2", attempts: 0 }, "sair")).toMatchObject({ kind: "present", returnedFromAi: "ai-2" });
    expect(turn(two, { currentNodeId: "ai-2", attempts: 0 }, "menu")).toEqual({ kind: "ai-mode", nodeId: "ai-2" });
  });

  it("reentra pela aresta de ENTRADA do gatilho (menu escolhido), não só pelo primeiro menu", () => {
    const other: RawFlowNode = { ...MENU, id: "menu-2", properties: { ...(MENU.properties as object), mensagem: "Outro menu" } };
    const n = [TRIGGER("menu-2"), MENU, other, AI("menu")];
    expect(turn(n, IN_AI, "menu", "menu-2")).toMatchObject({
      kind: "present",
      state: { currentNodeId: "menu-2", attempts: 0 },
      returnedFromAi: "node-ai",
    });
  });

  it("entrada = mensagem → menu: apresenta a cadeia inteira na mesma virada (returnedFromAi no resultado)", () => {
    const n = [TRIGGER("msg-boas-vindas"), MENU, AI("menu"), msg("msg-boas-vindas", "Olá de novo!", "menu-1")];
    expect(turn(n, IN_AI, "menu", "msg-boas-vindas")).toMatchObject({
      kind: "message",
      message: `Olá de novo!\n\n${MENU_PROMPT}`,
      state: { currentNodeId: "menu-1", attempts: 0 },
      returnedFromAi: "node-ai",
    });
  });

  it("entrada = mensagem SEM destino: texto sai e o marcador é ZERADO (state null) — saiu do modo IA mesmo assim", () => {
    const n = [TRIGGER("msg-fim"), AI("menu"), msg("msg-fim", "Até logo!")];
    expect(turn(n, IN_AI, "menu", "msg-fim")).toMatchObject({
      kind: "message",
      message: "Até logo!",
      state: null,
      returnedFromAi: "node-ai",
    });
  });

  it("SEM nó de entrada utilizável (nenhum menu nem mensagem de entrada): a palavra não tem pra onde voltar → segue em modo IA", () => {
    expect(turn([TRIGGER(), AI("menu")], IN_AI, "menu")).toEqual({ kind: "ai-mode", nodeId: "node-ai" });
  });

  it("nó ai DESABILITADO depois: o marcador é órfão e reentra pelo menu pelo caminho de sempre (sem returnedFromAi)", () => {
    const n = [TRIGGER(), MENU, AI("menu", "node-ai", false)];
    const t = turn(n, IN_AI, "menu");
    expect(t).toMatchObject({ kind: "present", message: MENU_PROMPT });
    expect((t as { returnedFromAi?: string }).returnedFromAi).toBeUndefined();
  });

  it("fora do modo IA a palavra não tem efeito especial (estado de menu: 'menu' é só uma resposta inválida)", () => {
    expect(turn(nodes, { currentNodeId: "menu-1", attempts: 0 }, "menu")).toMatchObject({ kind: "reprompt" });
  });
});

describe("simulador — paridade com produção (R9)", () => {
  const FLOW = [TRIGGER(), MENU, AI("menu"), msg("msg-horario", "x", "menu-1")];
  const inAi = { botFlowState: IN_AI, handedOver: false };

  it("palavra de retorno: responde o menu (engine 'menu'), estado = menu, selo leftAi, sem IA", () => {
    expect(simulateFlowTurn(FLOW, inAi, "Menu")).toEqual({
      kind: "respond",
      reply: MENU_PROMPT,
      simulation: {
        engine: "menu",
        botFlowState: { currentNodeId: "menu-1", attempts: 0 },
        handedOver: false,
        leftAi: true,
      },
    });
  });

  it("outro texto: segue pra IA com o marcador mantido (sem leftAi)", () => {
    expect(simulateFlowTurn(FLOW, inAi, "quero voltar ao menu")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: IN_AI, handedOver: false },
    });
  });

  it("sem palavra definida: 'menu' vai pra IA (R8)", () => {
    expect(simulateFlowTurn([TRIGGER(), MENU, AI()], inAi, "menu")).toEqual({
      kind: "continue",
      simulation: { engine: "ai", botFlowState: IN_AI, handedOver: false },
    });
  });

  it("depois de voltar, a conversa pode escolher a IA de novo e o ciclo se repete", () => {
    const back = simulateFlowTurn(FLOW, inAi, "menu");
    if (back.kind !== "respond") throw new Error("esperava respond");
    const again = simulateFlowTurn(FLOW, { botFlowState: back.simulation.botFlowState, handedOver: false }, "1");
    expect(again).toMatchObject({ kind: "continue", simulation: { engine: "ai", botFlowState: IN_AI, enteredAi: true } });
  });

  it("PARIDADE: o texto/estado do simulador é o mesmo da decisão de produção", () => {
    const prod = turn(FLOW, IN_AI, "MENU");
    const sim = simulateFlowTurn(FLOW, inAi, "MENU");
    if (prod.kind !== "present") throw new Error("esperava present");
    expect(sim).toMatchObject({
      kind: "respond",
      reply: prod.message,
      simulation: { botFlowState: prod.state, leftAi: true },
    });
  });

  it("palavra de retorno coincidindo com palavra-chave de handover: a saída vence (o motor do menu roda antes do gate de handover)", () => {
    const flow = [TRIGGER(), MENU, AI("atendente"), { id: "node-handover", type: "handover", enabled: true, properties: {} } as RawFlowNode];
    expect(simulateFlowTurn(flow, inAi, "atendente")).toMatchObject({
      kind: "respond",
      reply: MENU_PROMPT,
      simulation: { engine: "menu", leftAi: true, handedOver: false },
    });
  });
});
