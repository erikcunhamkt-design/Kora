// Etapa 9 · Item 4, R3 — motor de runtime do nó "menu"
// (docs/qa/etapa-9-bot-fluxo-scriptado-r3-motor-runtime-menu.md). Testes
// unitários com mocks puros (sem Deno.serve, sem banco) — matching de
// opção, reprompt, estouro de tentativas (2 variantes de `acao`) e
// degradação de `bot_flow_state` sem a coluna existir.
import { describe, it, expect } from "vitest";
import {
  extractMenuNodes,
  parseBotFlowState,
  renderMenuPrompt,
  matchMenuOption,
  resolveMenuTurn,
  type MenuNode,
  type RawFlowNode,
} from "../botFlowMenu";

function makeMenuNode(overrides: Partial<MenuNode> = {}): MenuNode {
  return {
    id: "menu-1",
    mensagem: "Escolha uma opção:",
    opcoes: [
      { numero: 1, rotulo: "Financeiro", nextNodeId: "menu-financeiro" },
      { numero: 2, rotulo: "Suporte", nextNodeId: "node-handover" },
    ],
    fallback: { maxTentativas: 2, acao: "reprompt" },
    ...overrides,
  };
}

function makeRawMenuNode(overrides: Record<string, unknown> = {}): RawFlowNode {
  return {
    id: "menu-1",
    type: "menu",
    enabled: true,
    properties: {
      mensagem: "Escolha uma opção:",
      opcoes: [
        { numero: 1, rotulo: "Financeiro", nextNodeId: "menu-financeiro" },
        { numero: 2, rotulo: "Suporte", nextNodeId: "node-handover" },
      ],
      fallback: { maxTentativas: 2, acao: "reprompt" },
    },
    ...overrides,
  } as RawFlowNode;
}

describe("extractMenuNodes", () => {
  it("array vazio -> array vazio (nó menu ausente do flow_data)", () => {
    expect(extractMenuNodes([])).toEqual([]);
  });

  it("filtra nós que não são \"menu\"", () => {
    const nodes: RawFlowNode[] = [
      { id: "t1", type: "trigger", enabled: true, properties: {} },
      { id: "a1", type: "ai", enabled: true, properties: {} },
    ];
    expect(extractMenuNodes(nodes)).toEqual([]);
  });

  it("filtra nós \"menu\" desabilitados", () => {
    const raw = makeRawMenuNode({ enabled: false });
    expect(extractMenuNodes([raw])).toEqual([]);
  });

  it("degrada em silêncio um nó \"menu\" com properties malformado (sem lançar)", () => {
    const semOpcoes: RawFlowNode = {
      id: "menu-bad",
      type: "menu",
      enabled: true,
      properties: { mensagem: "oi", fallback: { maxTentativas: 1, acao: "reprompt" } },
    };
    const semFallback: RawFlowNode = {
      id: "menu-bad-2",
      type: "menu",
      enabled: true,
      properties: { mensagem: "oi", opcoes: [] },
    };
    const semMensagem: RawFlowNode = {
      id: "menu-bad-3",
      type: "menu",
      enabled: true,
      properties: { opcoes: [], fallback: { maxTentativas: 1, acao: "reprompt" } },
    };
    expect(extractMenuNodes([semOpcoes, semFallback, semMensagem])).toEqual([]);
  });

  it("extrai um nó \"menu\" válido com a forma correta", () => {
    const result = extractMenuNodes([makeRawMenuNode()]);
    expect(result).toEqual([makeMenuNode()]);
  });
});

describe("parseBotFlowState (degradação sem coluna)", () => {
  it("undefined (coluna bot_flow_state ainda não existe no schema real) -> null", () => {
    expect(parseBotFlowState(undefined)).toBeNull();
  });

  it("null (conversa nunca entrou num fluxo scriptado) -> null", () => {
    expect(parseBotFlowState(null)).toBeNull();
  });

  it("valor que não é objeto (string/number/garbage) -> null", () => {
    expect(parseBotFlowState("lixo")).toBeNull();
    expect(parseBotFlowState(42)).toBeNull();
  });

  it("objeto sem currentNodeId ou com tipo errado -> null", () => {
    expect(parseBotFlowState({ attempts: 0 })).toBeNull();
    expect(parseBotFlowState({ currentNodeId: 123, attempts: 0 })).toBeNull();
  });

  it("objeto sem attempts ou com tipo errado -> null", () => {
    expect(parseBotFlowState({ currentNodeId: "menu-1" })).toBeNull();
    expect(parseBotFlowState({ currentNodeId: "menu-1", attempts: "0" })).toBeNull();
  });

  it("objeto válido é parseado corretamente", () => {
    expect(parseBotFlowState({ currentNodeId: "menu-1", attempts: 2 })).toEqual({
      currentNodeId: "menu-1",
      attempts: 2,
    });
  });
});

describe("matchMenuOption", () => {
  const opcoes = makeMenuNode().opcoes;

  it("número exato casa com a opção", () => {
    expect(matchMenuOption("1", opcoes)?.rotulo).toBe("Financeiro");
    expect(matchMenuOption("2", opcoes)?.rotulo).toBe("Suporte");
  });

  it("tolera espaços em volta", () => {
    expect(matchMenuOption("  1  ", opcoes)?.rotulo).toBe("Financeiro");
    expect(matchMenuOption("\t2\n", opcoes)?.rotulo).toBe("Suporte");
  });

  it("texto não-numérico não casa", () => {
    expect(matchMenuOption("opção 1", opcoes)).toBeUndefined();
    expect(matchMenuOption("financeiro", opcoes)).toBeUndefined();
  });

  it("número fora do vocabulário de opções não casa", () => {
    expect(matchMenuOption("99", opcoes)).toBeUndefined();
  });

  it("espaço interno (não é número exato) não casa", () => {
    expect(matchMenuOption("1 2", opcoes)).toBeUndefined();
  });

  it("mensagem vazia/ausente não casa", () => {
    expect(matchMenuOption("", opcoes)).toBeUndefined();
  });
});

describe("renderMenuPrompt", () => {
  it("monta a mensagem + opções numeradas", () => {
    expect(renderMenuPrompt(makeMenuNode())).toBe(
      "Escolha uma opção:\n1 - Financeiro\n2 - Suporte",
    );
  });
});

describe("resolveMenuTurn", () => {
  it("sem nenhum nó \"menu\" -> \"none\" (comportamento atual intocado)", () => {
    expect(resolveMenuTurn([], null, "1")).toEqual({ kind: "none" });
  });

  it("sem estado (primeira mensagem) -> apresenta o primeiro menu, attempts=0", () => {
    const node = makeMenuNode();
    const result = resolveMenuTurn([node], null, "qualquer coisa");
    expect(result).toEqual({
      kind: "present",
      message: renderMenuPrompt(node),
      state: { currentNodeId: "menu-1", attempts: 0 },
    });
  });

  it("estado aponta pra um nó que não existe mais entre os menus habilitados -> reapresenta o primeiro", () => {
    const node = makeMenuNode();
    const result = resolveMenuTurn([node], { currentNodeId: "menu-removido", attempts: 3 }, "1");
    expect(result.kind).toBe("present");
    expect((result as { state: { attempts: number } }).state.attempts).toBe(0);
  });

  it("resposta válida avança pro nextNodeId quando ele é outro menu (encadeamento)", () => {
    const menuFinanceiro = makeMenuNode({
      id: "menu-financeiro",
      mensagem: "Financeiro:",
      opcoes: [{ numero: 1, rotulo: "Boletos", nextNodeId: "node-send" }],
      fallback: { maxTentativas: 2, acao: "reprompt" },
    });
    const menuRaiz = makeMenuNode();
    const result = resolveMenuTurn(
      [menuRaiz, menuFinanceiro],
      { currentNodeId: "menu-1", attempts: 0 },
      "1",
    );
    expect(result).toEqual({
      kind: "present",
      message: renderMenuPrompt(menuFinanceiro),
      state: { currentNodeId: "menu-financeiro", attempts: 0 },
    });
  });

  it("resposta válida com nextNodeId que NÃO é um menu conhecido -> \"advanced-away\", state não é mais rastreado", () => {
    const node = makeMenuNode();
    const result = resolveMenuTurn([node], { currentNodeId: "menu-1", attempts: 1 }, "2");
    expect(result).toEqual({ kind: "advanced-away", nextNodeId: "node-handover" });
  });

  it("resposta inválida, tentativas abaixo do limite -> reprompt, contador incrementa", () => {
    const node = makeMenuNode({ fallback: { maxTentativas: 3, acao: "reprompt" } });
    const result = resolveMenuTurn([node], { currentNodeId: "menu-1", attempts: 0 }, "abc");
    expect(result.kind).toBe("reprompt");
    expect((result as { state: { attempts: number } }).state).toEqual({ currentNodeId: "menu-1", attempts: 1 });
    expect((result as { message: string }).message).toContain("Resposta inválida");
    expect((result as { message: string }).message).toContain(renderMenuPrompt(node));
  });

  it("estoura maxTentativas com acao \"node\" -> \"handover-fallback\" (R3 só marca, não executa handover real — R4 da Lane E)", () => {
    const node = makeMenuNode({
      fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "node-handover-humano" },
    });
    const result = resolveMenuTurn([node], { currentNodeId: "menu-1", attempts: 1 }, "abc");
    expect(result).toEqual({ kind: "handover-fallback", fallbackNodeId: "node-handover-humano" });
  });

  it("estoura maxTentativas com acao \"reprompt\" -> continua reprompt (indefinido, nunca sai)", () => {
    const node = makeMenuNode({ fallback: { maxTentativas: 1, acao: "reprompt" } });
    const result = resolveMenuTurn([node], { currentNodeId: "menu-1", attempts: 5 }, "abc");
    expect(result.kind).toBe("reprompt");
    expect((result as { state: { attempts: number } }).state.attempts).toBe(6);
  });

  it("acao \"node\" sem fallbackNodeId configurado (não validado em tipo) degrada pra reprompt em vez de quebrar", () => {
    const node = makeMenuNode({ fallback: { maxTentativas: 1, acao: "node" } });
    const result = resolveMenuTurn([node], { currentNodeId: "menu-1", attempts: 3 }, "abc");
    expect(result.kind).toBe("reprompt");
  });
});
