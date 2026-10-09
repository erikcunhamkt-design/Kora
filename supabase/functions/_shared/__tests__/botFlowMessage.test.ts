// Etapa 9 · Item 4, R7 — nó "message" (texto informativo montável entre menus)
// no motor de runtime (botFlowMenu.ts). Ao ser alcançado o motor envia o texto
// e segue `nextNodeId` NA MESMA virada: menu → apresenta o menu junto; outra
// mensagem → encadeia; ausente → encerra o acompanhamento scriptado. Testes
// puros (sem Deno.serve, sem banco), mesmo molde de botFlowMenu.test.ts.
import { describe, it, expect } from "vitest";
import {
  MAX_MESSAGE_HOPS,
  extractMessageNodes,
  resolveEntryNode,
  resolveMenuTurn,
  type MenuNode,
  type MessageNode,
  type RawFlowNode,
} from "../botFlowMenu";

function makeMenuNode(overrides: Partial<MenuNode> = {}): MenuNode {
  return {
    id: "menu-principal",
    mensagem: "Como posso ajudar?",
    opcoes: [
      { numero: 1, rotulo: "Horário", nextNodeId: "msg-horario" },
      { numero: 2, rotulo: "Endereço", nextNodeId: "msg-endereco" },
      { numero: 3, rotulo: "Humano", nextNodeId: "node-handover" },
    ],
    fallback: { maxTentativas: 2, acao: "reprompt" },
    ...overrides,
  };
}

function makeMessageNode(overrides: Partial<MessageNode> = {}): MessageNode {
  return { id: "msg-horario", mensagem: "Horário: seg–sex 9h–18h", ...overrides };
}

const MENU_PROMPT = "Como posso ajudar?\n1 - Horário\n2 - Endereço\n3 - Humano";
const STATE = { currentNodeId: "menu-principal", attempts: 0 };

describe("extractMessageNodes (R7)", () => {
  const raw = (over: Record<string, unknown> = {}, props: Record<string, unknown> = {}): RawFlowNode =>
    ({
      id: "msg-1",
      type: "message",
      enabled: true,
      properties: { mensagem: "Olá!", ...props },
      ...over,
    }) as RawFlowNode;

  it("só nós 'message' habilitados com mensagem não vazia; ignora os outros tipos", () => {
    const nodes: RawFlowNode[] = [
      raw(),
      raw({ id: "msg-off", enabled: false }),
      raw({ id: "msg-vazia" }, { mensagem: "   " }),
      raw({ id: "msg-sem-texto" }, { mensagem: undefined }),
      raw({ id: "msg-texto-num" }, { mensagem: 42 }),
      { id: "m1", type: "menu", enabled: true, properties: {} },
      { id: "t", type: "trigger", enabled: true, properties: {} },
    ];
    expect(extractMessageNodes(nodes)).toEqual([{ id: "msg-1", mensagem: "Olá!", nextNodeId: undefined }]);
  });

  it("nextNodeId: string não vazia é mantida; ausente/vazia/não-string vira undefined (encerra)", () => {
    const nodes: RawFlowNode[] = [
      raw({ id: "a" }, { nextNodeId: "menu-1" }),
      raw({ id: "b" }, { nextNodeId: "" }),
      raw({ id: "c" }, { nextNodeId: 7 }),
      raw({ id: "d" }),
    ];
    expect(extractMessageNodes(nodes).map((n) => [n.id, n.nextNodeId])).toEqual([
      ["a", "menu-1"],
      ["b", undefined],
      ["c", undefined],
      ["d", undefined],
    ]);
  });

  it("flow_data antigo (sem nenhum nó 'message') → [] (nada muda)", () => {
    expect(extractMessageNodes([])).toEqual([]);
    expect(extractMessageNodes([{ id: "m", type: "menu", enabled: true, properties: {} }])).toEqual([]);
  });
});

describe("resolveEntryNode (R7 — a entrada pode ser menu OU mensagem)", () => {
  const menus = [makeMenuNode({ id: "menu-a" }), makeMenuNode({ id: "menu-b" })];
  const msgs = [makeMessageNode({ id: "msg-1" })];

  it("aresta explícita pra mensagem habilitada → entra por ela (kind message, trigger-edge)", () => {
    const r = resolveEntryNode(menus, msgs, "msg-1");
    expect(r).toMatchObject({ kind: "message", reason: "trigger-edge" });
    expect(r?.node.id).toBe("msg-1");
  });

  it("aresta pra menu → igual ao resolveEntryMenu; ausente → automático (primeiro MENU, nunca mensagem)", () => {
    expect(resolveEntryNode(menus, msgs, "menu-b")).toMatchObject({ kind: "menu", reason: "trigger-edge" });
    expect(resolveEntryNode(menus, msgs, undefined)).toMatchObject({ kind: "menu", reason: "automatic" });
    expect(resolveEntryNode(menus, msgs, undefined)?.node.id).toBe("menu-a");
  });

  it("aresta inválida → fallback automático com reason invalid-edge; sem menu e sem mensagem escolhida → null", () => {
    expect(resolveEntryNode(menus, msgs, "fantasma")).toMatchObject({ kind: "menu", reason: "invalid-edge" });
    expect(resolveEntryNode([], msgs, "fantasma")).toBeNull();
    expect(resolveEntryNode([], msgs, undefined)).toBeNull();
  });
});

describe("resolveMenuTurn com nó 'message' (R7)", () => {
  it("opção → mensagem → menu: envia o texto E apresenta o menu na MESMA resposta; estado = o menu", () => {
    const turn = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, [
      makeMessageNode({ nextNodeId: "menu-principal" }),
    ]);
    expect(turn).toEqual({
      kind: "message",
      message: `Horário: seg–sex 9h–18h\n\n${MENU_PROMPT}`,
      state: { currentNodeId: "menu-principal", attempts: 0 },
      messageNodeIds: ["msg-horario"],
    });
  });

  it("mensagem SEM destino: envia o texto e ENCERRA (state null) — sem menu na resposta", () => {
    const turn = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, [makeMessageNode()]);
    expect(turn).toEqual({
      kind: "message",
      message: "Horário: seg–sex 9h–18h",
      state: null,
      messageNodeIds: ["msg-horario"],
    });
  });

  it("mensagem → mensagem → menu: encadeia na mesma resposta, na ordem", () => {
    const msgs = [
      makeMessageNode({ nextNodeId: "msg-endereco" }),
      makeMessageNode({ id: "msg-endereco", mensagem: "Rua das Flores, 100", nextNodeId: "menu-principal" }),
    ];
    const turn = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, msgs);
    if (turn.kind !== "message") throw new Error("esperava message");
    expect(turn.message).toBe(`Horário: seg–sex 9h–18h\n\nRua das Flores, 100\n\n${MENU_PROMPT}`);
    expect(turn.messageNodeIds).toEqual(["msg-horario", "msg-endereco"]);
    expect(turn.state).toEqual({ currentNodeId: "menu-principal", attempts: 0 });
    expect(turn.truncated).toBeUndefined();
  });

  it("o estado persistido NUNCA aponta pra um nó 'message' (a cadeia é atômica); a virada seguinte responde ao MENU", () => {
    const msgs = [makeMessageNode({ nextNodeId: "menu-principal" })];
    const turn = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, msgs);
    if (turn.kind !== "message") throw new Error("esperava message");
    expect(turn.state?.currentNodeId).toBe("menu-principal");
    expect(resolveMenuTurn([makeMenuNode()], turn.state, "3", undefined, msgs)).toEqual({
      kind: "advanced-away",
      nextNodeId: "node-handover",
    });
  });

  it("depois de uma mensagem que ENCERROU (state null), a próxima mensagem do cliente reentra pelo menu de entrada", () => {
    const msgs = [makeMessageNode()];
    const first = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, msgs);
    if (first.kind !== "message") throw new Error("esperava message");
    expect(first.state).toBeNull();
    expect(resolveMenuTurn([makeMenuNode()], first.state, "oi", undefined, msgs)).toMatchObject({
      kind: "present",
      message: MENU_PROMPT,
    });
  });

  it("entrada: trigger.nextNodeId → mensagem → menu (conversa nova)", () => {
    const msgs = [makeMessageNode({ id: "msg-boas-vindas", mensagem: "Olá, bem-vindo!", nextNodeId: "menu-principal" })];
    expect(resolveMenuTurn([makeMenuNode()], null, "oi", "msg-boas-vindas", msgs)).toMatchObject({
      kind: "message",
      message: `Olá, bem-vindo!\n\n${MENU_PROMPT}`,
      state: { currentNodeId: "menu-principal", attempts: 0 },
    });
  });

  it("entrada na mensagem SEM nenhum menu habilitado: ainda responde (e encerra) — não vira 'none'", () => {
    expect(resolveMenuTurn([], null, "oi", "msg-horario", [makeMessageNode()])).toMatchObject({
      kind: "message",
      message: "Horário: seg–sex 9h–18h",
      state: null,
    });
  });

  it("mensagens existem mas NÃO há aresta de entrada e nenhum menu → 'none' (nada muda)", () => {
    expect(resolveMenuTurn([], null, "oi", undefined, [makeMessageNode()])).toEqual({ kind: "none" });
  });

  it("fallback 'node' apontando pra mensagem: ao estourar, envia o texto (em vez de handover-fallback)", () => {
    const menu = makeMenuNode({ fallback: { maxTentativas: 1, acao: "node", fallbackNodeId: "msg-horario" } });
    const turn = resolveMenuTurn([menu], STATE, "banana", undefined, [makeMessageNode({ nextNodeId: "menu-principal" })]);
    expect(turn).toMatchObject({
      kind: "message",
      message: `Horário: seg–sex 9h–18h\n\n${MENU_PROMPT}`,
      state: { currentNodeId: "menu-principal", attempts: 0 },
    });
  });

  it("destino que o motor não conhece (outro tipo de nó) → encerra ali e devolve unresolvedNextNodeId pro log", () => {
    const turn = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, [makeMessageNode({ nextNodeId: "node-handover" })]);
    expect(turn).toEqual({
      kind: "message",
      message: "Horário: seg–sex 9h–18h",
      state: null,
      messageNodeIds: ["msg-horario"],
      unresolvedNextNodeId: "node-handover",
    });
  });

  it("mensagem DESABILITADA fica fora de messageNodes → a opção cai em advanced-away (como qualquer nó desconhecido)", () => {
    const messageNodes = extractMessageNodes([
      { id: "msg-horario", type: "message", enabled: false, properties: { mensagem: "x", nextNodeId: "menu-principal" } },
    ]);
    expect(messageNodes).toEqual([]);
    expect(resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, messageNodes)).toEqual({
      kind: "advanced-away",
      nextNodeId: "msg-horario",
    });
  });

  it("sem o 5º argumento o comportamento é IDÊNTICO ao da R6 (opção pra id de mensagem = advanced-away)", () => {
    expect(resolveMenuTurn([makeMenuNode()], STATE, "1")).toEqual({ kind: "advanced-away", nextNodeId: "msg-horario" });
  });

  it("resposta inválida num menu que tem mensagens no fluxo continua sendo reprompt (R3 intocada)", () => {
    const turn = resolveMenuTurn([makeMenuNode()], STATE, "banana", undefined, [makeMessageNode()]);
    expect(turn).toMatchObject({ kind: "reprompt", state: { currentNodeId: "menu-principal", attempts: 1 } });
  });

  describe("proteção contra ciclos message→message", () => {
    it("auto-laço (A→A): envia A UMA vez, corta com truncated 'cycle', state null — nunca trava", () => {
      const turn = resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, [
        makeMessageNode({ nextNodeId: "msg-horario" }),
      ]);
      expect(turn).toEqual({
        kind: "message",
        message: "Horário: seg–sex 9h–18h",
        state: null,
        messageNodeIds: ["msg-horario"],
        truncated: "cycle",
      });
    });

    it("ciclo A→B→A: envia A e B uma vez cada e corta ('cycle')", () => {
      const msgs = [
        makeMessageNode({ id: "msg-horario", mensagem: "A", nextNodeId: "msg-endereco" }),
        makeMessageNode({ id: "msg-endereco", mensagem: "B", nextNodeId: "msg-horario" }),
      ];
      expect(resolveMenuTurn([makeMenuNode()], STATE, "1", undefined, msgs)).toMatchObject({
        kind: "message",
        message: "A\n\nB",
        state: null,
        messageNodeIds: ["msg-horario", "msg-endereco"],
        truncated: "cycle",
      });
    });

    it("cadeia LONGA sem ciclo passa do teto: envia MAX_MESSAGE_HOPS e corta com 'hop-limit' (sem menu)", () => {
      const total = MAX_MESSAGE_HOPS + 3;
      const msgs = Array.from({ length: total }, (_, i) =>
        makeMessageNode({
          id: `msg-${i}`,
          mensagem: `texto ${i}`,
          nextNodeId: i === total - 1 ? "menu-principal" : `msg-${i + 1}`,
        }),
      );
      const menu = makeMenuNode({ opcoes: [{ numero: 1, rotulo: "x", nextNodeId: "msg-0" }] });
      const turn = resolveMenuTurn([menu], STATE, "1", undefined, msgs);
      if (turn.kind !== "message") throw new Error("esperava message");
      expect(turn.truncated).toBe("hop-limit");
      expect(turn.messageNodeIds).toHaveLength(MAX_MESSAGE_HOPS);
      expect(turn.state).toBeNull();
      expect(turn.message.split("\n\n")).toHaveLength(MAX_MESSAGE_HOPS);
    });

    it("cadeia com exatamente MAX_MESSAGE_HOPS mensagens + menu NÃO é cortada", () => {
      const msgs = Array.from({ length: MAX_MESSAGE_HOPS }, (_, i) =>
        makeMessageNode({
          id: `msg-${i}`,
          mensagem: `texto ${i}`,
          nextNodeId: i === MAX_MESSAGE_HOPS - 1 ? "menu-principal" : `msg-${i + 1}`,
        }),
      );
      const menu = makeMenuNode({ opcoes: [{ numero: 1, rotulo: "x", nextNodeId: "msg-0" }] });
      const turn = resolveMenuTurn([menu], STATE, "1", undefined, msgs);
      if (turn.kind !== "message") throw new Error("esperava message");
      expect(turn.truncated).toBeUndefined();
      expect(turn.state).toEqual(STATE);
    });
  });
});
