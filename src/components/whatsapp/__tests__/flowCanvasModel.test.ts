// R6 — funções PURAS do canvas (sem DOM): auto-layout/compat sem `position`,
// modelo → arestas do React Flow, e as INVERSAS (conexão/exclusão de aresta →
// mutação do modelo). Fonte única das arestas: computeCanvasEdges (G80).
import { describe, it, expect } from "vitest";
import {
  FLOW_HANDLE, LAYOUT, applyConnection, applyEdgeDeletion, applyNodeDeletion, canConnect, countNodeConnections,
  findDanglingEdges, isNodeDeletable, resolveDeleteKey,
  gridPosition, setNodePosition, toRenderableEdges, withAutoLayout,
} from "@/components/whatsapp/flowCanvasModel";
import type { MenuWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

function fixed(): WorkflowNode[] {
  return [
    { id: "t", type: "trigger", title: "Gatilho", enabled: true, properties: { respondAll: true } },
    {
      id: "ai", type: "ai", title: "IA", enabled: true,
      properties: {
        instruction: "", model: "m", provider: "p", geminiApiKey: "", gcpProjectId: "",
        gcpRegion: "", gcpServiceAccount: "", customModelName: "",
      },
    },
    { id: "send", type: "send", title: "Enviar", enabled: true, properties: { template: "{{reply}}" } },
    { id: "h", type: "handover", title: "Humano", enabled: false, properties: { assignTo: "" } },
  ];
}

function menu(over: Partial<MenuWorkflowNode["properties"]> = {}, id = "m1"): MenuWorkflowNode {
  return {
    id, type: "menu", title: `Menu ${id}`, enabled: true,
    properties: { mensagem: "x", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" }, ...over },
  };
}

const get = (nodes: WorkflowNode[], id: string) => nodes.find((n) => n.id === id)!;

describe("auto-layout (compat com flow_data salvo antes do R6, sem `position`)", () => {
  it("nós sem position ganham posição de grade pelo índice; colunas/linhas simples", () => {
    const laid = withAutoLayout(fixed());
    expect(laid.map((n) => n.position)).toEqual([0, 1, 2, 3].map(gridPosition));
    expect(gridPosition(0)).toEqual({ x: LAYOUT.originX, y: LAYOUT.originY });
    // 5º nó quebra pra 2ª linha, volta à 1ª coluna
    expect(gridPosition(LAYOUT.columns)).toEqual({ x: LAYOUT.originX, y: LAYOUT.originY + LAYOUT.yStep });
  });

  it("NUNCA move um nó que já tem position; preenche só os que faltam", () => {
    const nodes = fixed();
    nodes[1] = { ...nodes[1], position: { x: 999, y: 111 } };
    const laid = withAutoLayout(nodes);
    expect(laid[1].position).toEqual({ x: 999, y: 111 });
    expect(laid[0].position).toEqual(gridPosition(0));
    expect(laid[2].position).toEqual(gridPosition(2));
  });

  it("tudo já posicionado → devolve o MESMO array (sem re-render à toa)", () => {
    const laid = withAutoLayout(fixed());
    expect(withAutoLayout(laid)).toBe(laid);
  });

  it("position inválida (NaN, string, ausente) é tratada como ausente", () => {
    const nodes = fixed();
    nodes[0] = { ...nodes[0], position: { x: Number.NaN, y: 0 } };
    nodes[1] = { ...nodes[1], position: { x: "1", y: 2 } as unknown as { x: number; y: number } };
    const laid = withAutoLayout(nodes);
    expect(laid[0].position).toEqual(gridPosition(0));
    expect(laid[1].position).toEqual(gridPosition(1));
  });

  it("setNodePosition atualiza só o nó pedido (arrastar nó grava position)", () => {
    const laid = withAutoLayout(fixed());
    const moved = setNodePosition(laid, "send", { x: 12, y: 34 });
    expect(get(moved, "send").position).toEqual({ x: 12, y: 34 });
    expect(get(moved, "ai").position).toBe(get(laid, "ai").position);
  });
});

describe("toRenderableEdges — modelo → arestas do React Flow", () => {
  it("fixos: sequência trigger→ai→send→handover TRACEJADA (editable:false), handles seq-out → in", () => {
    const edges = toRenderableEdges(fixed());
    expect(edges.map((e) => [e.kind, e.source, e.target, e.editable, e.sourceHandle, e.targetHandle])).toEqual([
      ["sequence", "t", "ai", false, FLOW_HANDLE.sequenceOut, FLOW_HANDLE.in],
      ["sequence", "ai", "send", false, FLOW_HANDLE.sequenceOut, FLOW_HANDLE.in],
      ["sequence", "send", "h", false, FLOW_HANDLE.sequenceOut, FLOW_HANDLE.in],
    ]);
  });

  it("menu: 1 aresta editável por opção (handle option-i, label = número) + fallback quando acao='node'", () => {
    const m = menu({
      opcoes: [
        { numero: 1, rotulo: "A", nextNodeId: "h" },
        { numero: 5, rotulo: "B", nextNodeId: "ai" },
      ],
      fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "send" },
    });
    const edges = toRenderableEdges([...fixed(), m]).filter((e) => e.source === "m1");
    expect(edges.map((e) => [e.kind, e.sourceHandle, e.target, e.label, e.editable])).toEqual([
      ["option", "option-0", "h", "1", true],
      ["option", "option-1", "ai", "5", true],
      ["fallback", FLOW_HANDLE.fallback, "send", undefined, true],
    ]);
  });

  it("entrada: trigger.nextNodeId → aresta 'entry' editável com o handle entry", () => {
    const nodes = fixed();
    nodes[0] = { ...nodes[0], properties: { respondAll: true, nextNodeId: "m1" } } as WorkflowNode;
    const entry = toRenderableEdges([...nodes, menu()]).find((e) => e.kind === "entry");
    expect(entry).toMatchObject({ source: "t", target: "m1", sourceHandle: FLOW_HANDLE.entry, editable: true });
  });

  it("destino vazio/removido: a aresta NÃO é renderizada (e nenhuma é inventada)", () => {
    const m = menu({
      opcoes: [
        { numero: 1, rotulo: "A", nextNodeId: "" },
        { numero: 2, rotulo: "B", nextNodeId: "sumiu" },
      ],
      fallback: { maxTentativas: 3, acao: "node" },
    });
    expect(toRenderableEdges([...fixed(), m]).filter((e) => e.source === "m1")).toEqual([]);
  });

  it("findDanglingEdges lista exatamente o que não foi renderizado (editáveis), com o motivo", () => {
    const nodes = fixed();
    nodes[0] = { ...nodes[0], properties: { respondAll: true, nextNodeId: "fantasma" } } as WorkflowNode;
    const m = menu({
      opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "" }, { numero: 2, rotulo: "B", nextNodeId: "sumiu" }],
      fallback: { maxTentativas: 3, acao: "node" },
    });
    const dangling = findDanglingEdges([...nodes, m]).map((e) => [e.kind, e.fromNodeId, e.problem]);
    expect(dangling).toEqual([
      ["entry", "t", "removido"],
      ["option", "m1", "sem-destino"],
      ["option", "m1", "removido"],
      ["fallback", "m1", "sem-destino"],
    ]);
    // sequência implícita nunca entra aqui
    expect(dangling.some(([k]) => k === "sequence")).toBe(false);
  });
});

describe("canConnect — validação da conexão arrastada", () => {
  const nodes = [...fixed(), menu({ opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "" }], fallback: { maxTentativas: 3, acao: "node" } }), menu({}, "m2")];
  const conn = (source: string, sourceHandle: string, target: string) => ({ source, sourceHandle, target, targetHandle: FLOW_HANDLE.in });

  it("entrada do trigger só aponta pra um nó de menu", () => {
    expect(canConnect(nodes, conn("t", FLOW_HANDLE.entry, "m1")).ok).toBe(true);
    expect(canConnect(nodes, conn("t", FLOW_HANDLE.entry, "ai")).ok).toBe(false);
  });

  it("opção pode apontar pra qualquer nó (inclusive ele mesmo: 'voltar ao menu'), mas nunca pro trigger", () => {
    expect(canConnect(nodes, conn("m1", "option-0", "h")).ok).toBe(true);
    expect(canConnect(nodes, conn("m1", "option-0", "m1")).ok).toBe(true);
    expect(canConnect(nodes, conn("m1", "option-0", "t")).ok).toBe(false);
  });

  it("opção inexistente / handle desconhecido / nó sem saída editável → recusa", () => {
    expect(canConnect(nodes, conn("m1", "option-7", "h")).ok).toBe(false);
    expect(canConnect(nodes, conn("m1", "lixo", "h")).ok).toBe(false);
    expect(canConnect(nodes, conn("ai", FLOW_HANDLE.sequenceOut, "send")).ok).toBe(false);
    expect(canConnect(nodes, conn("t", FLOW_HANDLE.sequenceOut, "ai")).ok).toBe(false);
  });

  it("fallback: só com acao='node' e nunca pro próprio menu", () => {
    expect(canConnect(nodes, conn("m1", FLOW_HANDLE.fallback, "h")).ok).toBe(true);
    expect(canConnect(nodes, conn("m1", FLOW_HANDLE.fallback, "m1")).ok).toBe(false);
    expect(canConnect(nodes, conn("m2", FLOW_HANDLE.fallback, "h")).ok).toBe(false); // m2 é reprompt
  });

  it("nó inexistente / targetHandle errado → recusa", () => {
    expect(canConnect(nodes, conn("m1", "option-0", "nao-existe")).ok).toBe(false);
    expect(canConnect(nodes, { source: "m1", sourceHandle: "option-0", target: "h", targetHandle: "x" }).ok).toBe(false);
  });
});

describe("applyConnection — arrastar handle → nó alvo grava o campo do modelo", () => {
  const base = () => [...fixed(), menu({
    opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "" }, { numero: 2, rotulo: "B", nextNodeId: "h" }],
    fallback: { maxTentativas: 3, acao: "node" },
  })];
  const conn = (source: string, sourceHandle: string, target: string) => ({ source, sourceHandle, target, targetHandle: FLOW_HANDLE.in });

  it("opção: grava opcoes[i].nextNodeId (só aquela)", () => {
    const next = applyConnection(base(), conn("m1", "option-0", "send"));
    const m = get(next, "m1") as MenuWorkflowNode;
    expect(m.properties.opcoes.map((o) => o.nextNodeId)).toEqual(["send", "h"]);
  });

  it("religar uma opção que já tinha destino SUBSTITUI o destino (1 aresta por handle)", () => {
    const next = applyConnection(base(), conn("m1", "option-1", "ai"));
    expect((get(next, "m1") as MenuWorkflowNode).properties.opcoes[1].nextNodeId).toBe("ai");
  });

  it("fallback: grava fallback.fallbackNodeId", () => {
    const next = applyConnection(base(), conn("m1", FLOW_HANDLE.fallback, "h"));
    expect((get(next, "m1") as MenuWorkflowNode).properties.fallback.fallbackNodeId).toBe("h");
  });

  it("entrada: grava trigger.properties.nextNodeId (preserva respondAll)", () => {
    const next = applyConnection(base(), conn("t", FLOW_HANDLE.entry, "m1"));
    expect(get(next, "t").properties).toEqual({ respondAll: true, nextNodeId: "m1" });
  });

  it("conexão inválida → no-op (devolve o MESMO array)", () => {
    const nodes = base();
    expect(applyConnection(nodes, conn("t", FLOW_HANDLE.entry, "ai"))).toBe(nodes);
    expect(applyConnection(nodes, conn("ai", FLOW_HANDLE.sequenceOut, "send"))).toBe(nodes);
  });

  it("não muta o array de entrada (imutável)", () => {
    const nodes = base();
    const snapshot = JSON.stringify(nodes);
    applyConnection(nodes, conn("m1", "option-0", "send"));
    expect(JSON.stringify(nodes)).toBe(snapshot);
  });
});

describe("applyEdgeDeletion — apagar aresta limpa o campo", () => {
  const base = () => {
    const nodes = fixed();
    nodes[0] = { ...nodes[0], properties: { respondAll: true, nextNodeId: "m1" } } as WorkflowNode;
    return [...nodes, menu({
      opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "send" }, { numero: 2, rotulo: "B", nextNodeId: "h" }],
      fallback: { maxTentativas: 3, acao: "node", fallbackNodeId: "ai" },
    })];
  };

  it("opção: nextNodeId → '' só naquela opção", () => {
    const next = applyEdgeDeletion(base(), "m1:option:0");
    expect((get(next, "m1") as MenuWorkflowNode).properties.opcoes.map((o) => o.nextNodeId)).toEqual(["", "h"]);
  });

  it("fallback: fallbackNodeId removido (chave some, acao preservada)", () => {
    const next = applyEdgeDeletion(base(), "m1:fallback");
    const fb = (get(next, "m1") as MenuWorkflowNode).properties.fallback;
    expect(fb).toEqual({ maxTentativas: 3, acao: "node" });
    expect("fallbackNodeId" in fb).toBe(false);
  });

  it("entrada: nextNodeId removido do trigger (volta ao automático; respondAll preservado)", () => {
    const next = applyEdgeDeletion(base(), "t:entry");
    expect(get(next, "t").properties).toEqual({ respondAll: true });
  });

  it("aresta 'sequence' (implícita) e id desconhecido → no-op, não editável", () => {
    const nodes = base();
    expect(applyEdgeDeletion(nodes, "t:sequence")).toBe(nodes);
    expect(applyEdgeDeletion(nodes, "nada:option:9")).toBe(nodes);
  });

  it("round-trip: conectar e apagar a mesma aresta devolve o modelo original (JSON)", () => {
    const original = [...fixed(), menu({ opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "" }] })];
    const connected = applyConnection(original, { source: "m1", sourceHandle: "option-0", target: "send", targetHandle: FLOW_HANDLE.in });
    expect(JSON.stringify(connected)).not.toBe(JSON.stringify(original));
    expect(JSON.stringify(applyEdgeDeletion(connected, "m1:option:0"))).toBe(JSON.stringify(original));
  });
});

// ── Acabamento do canvas: exclusão de nó + tecla Delete ───────────────────

describe("applyNodeDeletion — exclui nó de menu e limpa TODA referência a ele", () => {
  // m1 é apontado por: opção de m2, fallback de m2 e entrada do trigger.
  const base = () => {
    const nodes = fixed();
    nodes[0] = { ...nodes[0], properties: { respondAll: true, nextNodeId: "m1" } } as WorkflowNode;
    return [
      ...nodes,
      menu({ opcoes: [{ numero: 1, rotulo: "x", nextNodeId: "send" }] }, "m1"),
      menu({
        opcoes: [
          { numero: 1, rotulo: "vai pro m1", nextNodeId: "m1" },
          { numero: 2, rotulo: "vai pro h", nextNodeId: "h" },
        ],
        fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "m1" },
      }, "m2"),
    ];
  };

  it("remove o nó e zera opcoes[].nextNodeId, fallbackNodeId e trigger.nextNodeId que apontavam pra ele", () => {
    const next = applyNodeDeletion(base(), "m1");
    expect(next.some((n) => n.id === "m1")).toBe(false);
    const m2 = get(next, "m2") as MenuWorkflowNode;
    expect(m2.properties.opcoes.map((o) => o.nextNodeId)).toEqual(["", "h"]); // só a que apontava
    expect(m2.properties.fallback).toEqual({ maxTentativas: 2, acao: "node" }); // chave removida, acao preservada
    expect("fallbackNodeId" in m2.properties.fallback).toBe(false);
    expect(get(next, "t").properties).toEqual({ respondAll: true }); // volta ao automático
  });

  it("depois da exclusão NÃO sobra aresta nem aviso apontando pro id excluído (nenhuma referência órfã)", () => {
    const next = applyNodeDeletion(base(), "m1");
    expect(JSON.stringify(next)).not.toContain('"m1"'); // nem como id, nem como destino
    expect(toRenderableEdges(next).some((e) => e.target === "m1" || e.source === "m1")).toBe(false);
    // "sem destino" é o estado esperado das opções limpas — não "removido" (id fantasma)
    expect(findDanglingEdges(next).some((e) => e.problem === "removido")).toBe(false);
  });

  it("não toca nas outras referências nem nos outros nós (imutável: o array original não muda)", () => {
    const nodes = base();
    const snapshot = JSON.stringify(nodes);
    const next = applyNodeDeletion(nodes, "m1");
    expect(JSON.stringify(nodes)).toBe(snapshot);
    expect(get(next, "m2")).not.toBe(get(nodes, "m2")); // m2 mudou
    expect(get(next, "ai")).toBe(get(nodes, "ai")); // fixo intocado (mesma referência)
  });

  it("nó que ninguém referencia: só some (os outros nós mantêm a MESMA referência)", () => {
    const nodes = [...fixed(), menu({}, "solto"), menu({ opcoes: [{ numero: 1, rotulo: "", nextNodeId: "h" }] }, "m2")];
    const next = applyNodeDeletion(nodes, "solto");
    expect(next.map((n) => n.id)).toEqual(["t", "ai", "send", "h", "m2"]);
    expect(get(next, "m2")).toBe(get(nodes, "m2"));
  });

  it("NÓS FIXOS são protegidos: trigger/ai/send/handover → no-op (mesmo array); inexistente também", () => {
    const nodes = base();
    for (const id of ["t", "ai", "send", "h", "nao-existe"]) {
      expect(applyNodeDeletion(nodes, id)).toBe(nodes);
    }
    expect(isNodeDeletable(get(nodes, "t"))).toBe(false);
    expect(isNodeDeletable(get(nodes, "m1"))).toBe(true);
    expect(isNodeDeletable(undefined)).toBe(false);
  });

  it("excluir um menu que aponta pra si mesmo (auto-referência) não deixa lixo", () => {
    const nodes = [...fixed(), menu({ opcoes: [{ numero: 9, rotulo: "voltar", nextNodeId: "m1" }] }, "m1")];
    const next = applyNodeDeletion(nodes, "m1");
    expect(next.map((n) => n.id)).toEqual(["t", "ai", "send", "h"]);
  });

  it("countNodeConnections conta o que chega + o que sai (editáveis), sem a sequência implícita", () => {
    const nodes = base();
    // chegam em m1: opção de m2, fallback de m2, entrada do trigger = 3; saem: 1 opção (→send) = 1
    expect(countNodeConnections(nodes, "m1")).toBe(4);
    expect(countNodeConnections(nodes, "m2")).toBe(3); // sai: 2 opções + 1 fallback; chegam: 0
    expect(countNodeConnections(fixed(), "ai")).toBe(0); // só sequência implícita
  });
});

describe("resolveDeleteKey — o que Delete/Backspace faz no canvas", () => {
  const nodes = [...fixed(), menu({ opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "send" }] }, "m1")];

  it("aresta EDITÁVEL selecionada → apaga a(s) aresta(s) (prioridade sobre o nó ativo)", () => {
    expect(resolveDeleteKey({ nodes, selectedNodeId: "m1", selectedEdgeIds: ["m1:option:0"] }))
      .toEqual({ type: "edges", edgeIds: ["m1:option:0"] });
  });

  it("aplicando a ação 'edges' com applyEdgeDeletion o campo é limpo (aresta apagada pela tecla)", () => {
    const action = resolveDeleteKey({ nodes, selectedNodeId: "m1", selectedEdgeIds: ["m1:option:0"] });
    if (action.type !== "edges") throw new Error("esperava edges");
    const next = action.edgeIds.reduce((acc, id) => applyEdgeDeletion(acc, id), nodes);
    expect((get(next, "m1") as MenuWorkflowNode).properties.opcoes[0].nextNodeId).toBe("");
  });

  it("só aresta de sequência implícita selecionada → none (não editável; e NÃO cai pro nó)", () => {
    expect(resolveDeleteKey({ nodes, selectedNodeId: "m1", selectedEdgeIds: ["t:sequence"] })).toEqual({ type: "none" });
  });

  it("sem aresta selecionada: nó de menu selecionado → exclui o nó; nó fixo selecionado → none", () => {
    expect(resolveDeleteKey({ nodes, selectedNodeId: "m1", selectedEdgeIds: [] })).toEqual({ type: "node", nodeId: "m1" });
    for (const id of ["t", "ai", "send", "h"]) {
      expect(resolveDeleteKey({ nodes, selectedNodeId: id, selectedEdgeIds: [] })).toEqual({ type: "none" });
    }
  });

  it("id de aresta que não existe mais é ignorado", () => {
    expect(resolveDeleteKey({ nodes, selectedNodeId: "t", selectedEdgeIds: ["m1:option:9"] })).toEqual({ type: "none" });
  });
});
