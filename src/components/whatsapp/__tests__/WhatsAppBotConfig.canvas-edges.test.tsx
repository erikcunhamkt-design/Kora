// G80 + R6 — o conector visual do canvas ligava node[index] → node[index+1] por
// POSIÇÃO NO ARRAY; com o nó "menu" montável (opcoes[].nextNodeId) a seta
// mentia. G80: função pura computeCanvasEdges (arestas reais). R6: o canvas
// virou React Flow (nós soltos); no render os testes asserem a lista textual
// "Conexões do fluxo" do FlowCanvas (mesmas arestas desenhadas — o jsdom não
// mede nós, então o React Flow não desenha <path> de aresta; ver nota em
// src/test/setup.ts) e os avisos do inspector. Só render — zero mudança de runtime.
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { computeCanvasEdges } from "@/components/whatsapp/flowCanvasEdges";
import type { WorkflowNode, MenuWorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((_payload: unknown) => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select, update }));
  return { maybeSingle, eq, select, update, updateEq, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: () => ({ role: "owner", isAdmin: true, loading: false }),
}));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

// Radix Select (abrir o listbox) chama scrollIntoView/hasPointerCapture.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);

const FIXED: WorkflowNode[] = [
  { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
  {
    id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
    properties: {
      instruction: "x", model: "gemini-3.6-flash", provider: "gemini_api_key", geminiApiKey: "",
      gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
    },
  },
  { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
  { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: false, properties: { assignTo: "" } },
];

function menu(
  overrides: { id?: string; title?: string; enabled?: boolean; properties?: Partial<MenuWorkflowNode["properties"]> } = {},
): MenuWorkflowNode {
  const { properties, ...rest } = overrides;
  return {
    id: "node-menu-a", type: "menu", title: "Menu A", enabled: true,
    ...rest,
    properties: {
      mensagem: "Escolha", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" },
      ...properties,
    },
  };
}

async function renderWithFlow(flow: WorkflowNode[]) {
  mocks.update.mockClear();
  mocks.maybeSingle.mockResolvedValue({
    data: { id: "bs-1", is_active: false, flow_data: flow, gemini_api_key: "", gcp_service_account: "" },
    error: null,
  });
  const { container } = render(<WhatsAppBotConfig workspaceId="ws-1" />);
  await screen.findByText("Gatilho de Entrada");
  return container;
}

describe("computeCanvasEdges (G80) — função pura", () => {
  it("só nós fixos: 3 arestas 'sequence' entre vizinhos (trigger→ai→send→handover), como antes", () => {
    const edges = computeCanvasEdges(FIXED);
    expect(edges.map((e) => [e.kind, e.fromNodeId, e.toNodeId])).toEqual([
      ["sequence", "node-trigger", "node-ai"],
      ["sequence", "node-ai", "node-send"],
      ["sequence", "node-send", "node-handover"],
    ]);
  });

  it("nó menu NUNCA recebe nem emite aresta 'sequence' por posição (o bug do G80: handover→menu)", () => {
    const edges = computeCanvasEdges([...FIXED, menu()]);
    expect(edges.filter((e) => e.kind === "sequence")).toHaveLength(3);
    expect(edges.some((e) => e.toNodeId === "node-menu-a")).toBe(false);
  });

  it("menu com 2 opções + fallback 'node': 1 aresta por opção + a de fallback, com os destinos reais", () => {
    const m = menu({
      properties: {
        opcoes: [
          { numero: 1, rotulo: "Suporte", nextNodeId: "node-handover" },
          { numero: 2, rotulo: "Vendas", nextNodeId: "node-ai" },
        ],
        fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "node-send" },
      },
    });
    const edges = computeCanvasEdges([...FIXED, m]).filter((e) => e.fromNodeId === "node-menu-a");
    expect(edges.map((e) => [e.kind, e.toNodeId, e.optionNumero, e.optionIndex])).toEqual([
      ["option", "node-handover", 1, 0],
      ["option", "node-ai", 2, 1],
      ["fallback", "node-send", undefined, undefined],
    ]);
  });

  it("fallback 'reprompt' não gera aresta; opção sem destino gera aresta com toNodeId null", () => {
    const m = menu({ properties: { opcoes: [{ numero: 1, rotulo: "", nextNodeId: "" }] } });
    const edges = computeCanvasEdges([...FIXED, m]).filter((e) => e.fromNodeId === "node-menu-a");
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ kind: "option", toNodeId: null });
  });

  it("aresta 'entry' (R6): trigger.properties.nextNodeId preenchido emite trigger → menu; ausente não emite nada", () => {
    const withEntry = FIXED.map((n) => (n.type === "trigger"
      ? { ...n, properties: { ...n.properties, nextNodeId: "node-menu-a" } }
      : n)) as WorkflowNode[];
    const edges = computeCanvasEdges([...withEntry, menu()]).filter((e) => e.kind === "entry");
    expect(edges).toEqual([{ id: "node-trigger:entry", kind: "entry", fromNodeId: "node-trigger", toNodeId: "node-menu-a" }]);

    expect(computeCanvasEdges([...FIXED, menu()]).some((e) => e.kind === "entry")).toBe(false);
  });

  it("aresta 'entry' é emitida mesmo com destino inexistente (o renderer decide: não desenha + avisa)", () => {
    const withEntry = FIXED.map((n) => (n.type === "trigger"
      ? { ...n, properties: { ...n.properties, nextNodeId: "node-que-sumiu" } }
      : n)) as WorkflowNode[];
    expect(computeCanvasEdges(withEntry).find((e) => e.kind === "entry")?.toNodeId).toBe("node-que-sumiu");
  });
});

describe("WhatsAppBotConfig · canvas React Flow (R6 + G80) — render", () => {
  function connections(): HTMLElement[] {
    return within(screen.getByRole("list", { name: "Conexões do fluxo" })).queryAllByRole("listitem");
  }
  const triple = (li: HTMLElement) => [li.getAttribute("data-edge-kind"), li.getAttribute("data-edge-from"), li.getAttribute("data-edge-to")];

  it("cada nó do fluxo vira um card do canvas (título, resumo, badge de desabilitado)", async () => {
    const container = await renderWithFlow([...FIXED, menu()]);

    const cards = Array.from(container.querySelectorAll("[data-flow-node-id]"));
    expect(cards.map((c) => c.getAttribute("data-flow-node-id"))).toEqual([
      "node-trigger", "node-ai", "node-send", "node-handover", "node-menu-a",
    ]);
    expect(screen.getAllByText("Desabilitado")).toHaveLength(1); // o handover nasce enabled:false
    expect(screen.getByText("Sem opções")).toBeInTheDocument();
  });

  it("menu com 2 opções + fallback 'node': 1 aresta por opção + a de fallback, com os destinos reais", async () => {
    const m = menu({
      properties: {
        opcoes: [
          { numero: 1, rotulo: "Suporte", nextNodeId: "node-handover" },
          { numero: 2, rotulo: "Vendas", nextNodeId: "node-ai" },
        ],
        fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "node-send" },
      },
    });
    await renderWithFlow([...FIXED, m]);

    const editable = connections().filter((li) => li.getAttribute("data-edge-editable") === "true");
    expect(editable.map(triple)).toEqual([
      ["option", "node-menu-a", "node-handover"],
      ["option", "node-menu-a", "node-ai"],
      ["fallback", "node-menu-a", "node-send"],
    ]);
    expect(editable[0]).toHaveTextContent("Opção 1: Menu A → Transbordo Humano");
  });

  it("nós fixos: a sequência trigger→ai→send→handover continua, TRACEJADA e NÃO editável; nenhuma seta por posição leva ao menu", async () => {
    await renderWithFlow([...FIXED, menu(), menu({ id: "node-menu-b", title: "Menu B" })]);

    const seq = connections().filter((li) => li.getAttribute("data-edge-kind") === "sequence");
    expect(seq.map(triple)).toEqual([
      ["sequence", "node-trigger", "node-ai"],
      ["sequence", "node-ai", "node-send"],
      ["sequence", "node-send", "node-handover"],
    ]);
    expect(seq.every((li) => li.getAttribute("data-edge-editable") === "false")).toBe(true);
  });

  it("menu sem opções (fallback reprompt): nenhuma aresta de saída do menu", async () => {
    await renderWithFlow([...FIXED, menu()]);
    expect(connections().filter((li) => li.getAttribute("data-edge-from") === "node-menu-a")).toHaveLength(0);
  });

  it("destino vazio/removido: a aresta NÃO é desenhada e o inspector do nó de origem mostra o aviso", async () => {
    const m = menu({
      properties: {
        opcoes: [
          { numero: 1, rotulo: "A", nextNodeId: "" },
          { numero: 2, rotulo: "B", nextNodeId: "node-que-nao-existe-mais" },
        ],
        fallback: { maxTentativas: 3, acao: "node" },
      },
    });
    await renderWithFlow([...FIXED, m]);

    expect(connections().filter((li) => li.getAttribute("data-edge-from") === "node-menu-a")).toHaveLength(0);

    fireEvent.click(screen.getByText("Menu A")); // seleciona o nó → inspector dele
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent ?? "");
    expect(alerts.some((t) => /Opção 1.*sem destino/.test(t))).toBe(true);
    expect(alerts.some((t) => /Opção 2.*não existe mais/.test(t))).toBe(true);
    expect(alerts.some((t) => /Resposta inválida.*sem destino/.test(t))).toBe(true); // fallback "node" sem destino
  });

  it("aresta de ENTRADA: 'Começar por' escolhe o menu → aparece trigger→menu (editável); 'Automático' remove a chave e a aresta", async () => {
    await renderWithFlow([...FIXED, menu()]);

    fireEvent.click(screen.getByText("Gatilho de Entrada"));
    expect(connections().some((li) => li.getAttribute("data-edge-kind") === "entry")).toBe(false);

    const trigger = screen.getByText("Automático (primeiro menu habilitado)").closest('button[role="combobox"]') as HTMLElement;
    fireEvent.click(trigger);
    fireEvent.click(within(await screen.findByRole("listbox")).getByText("Menu A"));

    const entry = connections().filter((li) => li.getAttribute("data-edge-kind") === "entry");
    expect(entry.map(triple)).toEqual([["entry", "node-trigger", "node-menu-a"]]);
    expect(entry[0].getAttribute("data-edge-editable")).toBe("true");
  });

  it("'Automático' de volta: a aresta de entrada some", async () => {
    const trig = { ...FIXED[0], properties: { respondAll: true, nextNodeId: "node-menu-a" } } as WorkflowNode;
    await renderWithFlow([trig, ...FIXED.slice(1), menu()]);
    expect(connections().some((li) => li.getAttribute("data-edge-kind") === "entry")).toBe(true);

    fireEvent.click(screen.getByText("Gatilho de Entrada"));
    // O select "Começar por" mostra "Menu A" (o item escolhido).
    const selectTrigger = screen.getAllByRole("combobox").find((el) => el.textContent?.includes("Menu A")) as HTMLElement;
    fireEvent.click(selectTrigger);
    fireEvent.click(within(await screen.findByRole("listbox")).getByText("Automático (primeiro menu habilitado)"));

    expect(connections().some((li) => li.getAttribute("data-edge-kind") === "entry")).toBe(false);
  });

  it("aresta de entrada apontando pra menu DESABILITADO: desenhada, mas o inspector avisa que o motor a ignora", async () => {
    const trig = { ...FIXED[0], properties: { respondAll: true, nextNodeId: "node-menu-a" } } as WorkflowNode;
    await renderWithFlow([trig, ...FIXED.slice(1), menu({ enabled: false })]);

    fireEvent.click(screen.getByText("Gatilho de Entrada"));
    expect(screen.getByRole("alert")).toHaveTextContent(/não é um menu habilitado/);
  });

  it("position salva é preservada no load e gravada de volta (só nós SEM position recebem auto-layout)", async () => {
    const withPos = FIXED.map((n) => (n.id === "node-ai" ? { ...n, position: { x: 777, y: 55 } } : n)) as WorkflowNode[];
    await renderWithFlow(withPos);

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string; position?: { x: number; y: number } }> };
    expect(payload.flow_data.find((n) => n.id === "node-ai")?.position).toEqual({ x: 777, y: 55 });
    expect(payload.flow_data.find((n) => n.id === "node-trigger")?.position).toBeDefined();
  });

  it("'+ Adicionar nó de menu' cria o nó (com position) e salvar grava a posição de TODOS os nós no flow_data", async () => {
    await renderWithFlow(FIXED);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de menu/i }));
    expect(screen.getByText("Menu 1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));

    const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string; position?: { x: number; y: number } }> };
    expect(payload.flow_data).toHaveLength(5);
    // flow_data salvo SEM position (compat) ganhou auto-layout no load; o nó novo veio do canvas.
    expect(payload.flow_data.every((n) => typeof n.position?.x === "number" && typeof n.position?.y === "number")).toBe(true);
  });
});
