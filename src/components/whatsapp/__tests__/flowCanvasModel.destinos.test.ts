// R8 — destinos "handover"/"ai" no canvas: funções PURAS (arestas, validação de
// conexão, gravação/limpeza). Origem × destino: opção/fallback de menu e nó de
// mensagem podem apontar pros terminais; a ENTRADA do gatilho não.
import { describe, it, expect } from "vitest";
import {
  FLOW_HANDLE, applyConnection, applyEdgeDeletion, applyNodeDeletion, canConnect, toRenderableEdges,
} from "@/components/whatsapp/flowCanvasModel";
import type { MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const nodes: WorkflowNode[] = [
  { id: "t", type: "trigger", title: "Gatilho", enabled: true, properties: { respondAll: true } },
  {
    id: "ai", type: "ai", title: "IA", enabled: true,
    properties: {
      instruction: "", model: "m", provider: "p", geminiApiKey: "", gcpProjectId: "",
      gcpRegion: "", gcpServiceAccount: "", customModelName: "",
    },
  },
  { id: "send", type: "send", title: "Enviar", enabled: true, properties: { template: "{{reply}}" } },
  { id: "h", type: "handover", title: "Humano", enabled: true, properties: { assignTo: "" } },
  {
    id: "m1", type: "menu", title: "Menu", enabled: true,
    properties: {
      mensagem: "x",
      opcoes: [
        { numero: 1, rotulo: "Humano", nextNodeId: "h" },
        { numero: 2, rotulo: "IA", nextNodeId: "ai" },
      ],
      fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "h" },
    },
  } as MenuWorkflowNode,
  { id: "msg", type: "message", title: "Aviso", enabled: true, properties: { mensagem: "Já te passo." } } as MessageWorkflowNode,
];

const conn = (source: string, sourceHandle: string, target: string) => ({
  source, sourceHandle, target, targetHandle: FLOW_HANDLE.in,
});
const get = (ns: WorkflowNode[], id: string) => ns.find((n) => n.id === id)!;

describe("R8 · terminais como destino — canConnect", () => {
  it("opção e fallback do menu → handover/ai: permitido (já era; segue valendo)", () => {
    expect(canConnect(nodes, conn("m1", "option-0", "h")).ok).toBe(true);
    expect(canConnect(nodes, conn("m1", "option-1", "ai")).ok).toBe(true);
    expect(canConnect(nodes, conn("m1", FLOW_HANDLE.fallback, "ai")).ok).toBe(true);
  });

  it("mensagem → handover/ai: permitido; → send/trigger/si mesma: recusado", () => {
    expect(canConnect(nodes, conn("msg", FLOW_HANDLE.next, "h")).ok).toBe(true);
    expect(canConnect(nodes, conn("msg", FLOW_HANDLE.next, "ai")).ok).toBe(true);
    expect(canConnect(nodes, conn("msg", FLOW_HANDLE.next, "send")).ok).toBe(false);
    expect(canConnect(nodes, conn("msg", FLOW_HANDLE.next, "t")).ok).toBe(false);
    expect(canConnect(nodes, conn("msg", FLOW_HANDLE.next, "msg")).ok).toBe(false);
  });

  it("ENTRADA do gatilho → handover/ai: recusado (entregaria/passaria à IA toda conversa nova)", () => {
    const hres = canConnect(nodes, conn("t", FLOW_HANDLE.entry, "h"));
    expect(hres.ok).toBe(false);
    expect(canConnect(nodes, conn("t", FLOW_HANDLE.entry, "ai")).ok).toBe(false);
    // menu e mensagem continuam válidos
    expect(canConnect(nodes, conn("t", FLOW_HANDLE.entry, "m1")).ok).toBe(true);
    expect(canConnect(nodes, conn("t", FLOW_HANDLE.entry, "msg")).ok).toBe(true);
  });
});

describe("R8 · terminais como destino — arestas, gravação e limpeza", () => {
  it("o canvas emite as arestas: opção → handover, opção → ai, fallback → handover, e mensagem → handover/ai depois de ligada", () => {
    const linked = applyConnection(applyConnection(nodes, conn("msg", FLOW_HANDLE.next, "h")), conn("m1", "option-1", "ai"));
    const edges = toRenderableEdges(linked).filter((e) => e.editable);
    expect(edges.map((e) => [e.kind, e.source, e.target])).toEqual([
      ["option", "m1", "h"],
      ["option", "m1", "ai"],
      ["fallback", "m1", "h"],
      ["next", "msg", "h"],
    ]);
  });

  it("ligar a mensagem ao handover grava nextNodeId; religar pra IA SUBSTITUI (1 saída); apagar a aresta remove a chave", () => {
    const toH = applyConnection(nodes, conn("msg", FLOW_HANDLE.next, "h"));
    expect(get(toH, "msg").properties).toEqual({ mensagem: "Já te passo.", nextNodeId: "h" });
    const toAi = applyConnection(toH, conn("msg", FLOW_HANDLE.next, "ai"));
    expect(get(toAi, "msg").properties).toEqual({ mensagem: "Já te passo.", nextNodeId: "ai" });
    const cleared = applyEdgeDeletion(toAi, "msg:next");
    expect("nextNodeId" in get(cleared, "msg").properties).toBe(false);
  });

  it("conexão inválida (entrada → handover) é no-op: devolve o MESMO array", () => {
    expect(applyConnection(nodes, conn("t", FLOW_HANDLE.entry, "h"))).toBe(nodes);
  });

  it("nós fixos (handover/ai) continuam NÃO excluíveis: apontar pra eles não os torna removíveis", () => {
    expect(applyNodeDeletion(nodes, "h")).toBe(nodes);
    expect(applyNodeDeletion(nodes, "ai")).toBe(nodes);
  });
});
