// G80 — o conector visual do canvas ligava node[index] → node[index+1] por
// POSIÇÃO NO ARRAY; com o nó "menu" montável (opcoes[].nextNodeId) a seta
// mentia. Estes testes provam (a) a função pura computeCanvasEdges e (b) o
// render: arestas reais do menu (1 por opção + fallback "node"), nó menu sem
// opções, e nós fixos inalterados. Só render — zero mudança de runtime.
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { computeCanvasEdges } from "@/components/whatsapp/flowCanvasEdges";
import type { WorkflowNode, MenuWorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return { maybeSingle, eq, select, from };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: () => ({ role: "owner", isAdmin: true, loading: false }),
}));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

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
    expect(edges.map((e) => [e.kind, e.toNodeId, e.optionNumero])).toEqual([
      ["option", "node-handover", 1],
      ["option", "node-ai", 2],
      ["fallback", "node-send", undefined],
    ]);
  });

  it("fallback 'reprompt' não gera aresta; opção sem destino gera aresta com toNodeId null", () => {
    const m = menu({ properties: { opcoes: [{ numero: 1, rotulo: "", nextNodeId: "" }] } });
    const edges = computeCanvasEdges([...FIXED, m]).filter((e) => e.fromNodeId === "node-menu-a");
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ kind: "option", toNodeId: null });
  });
});

describe("WhatsAppBotConfig · canvas (G80) — render das arestas reais", () => {
  it("menu com 2 opções + fallback 'node': lista as 3 arestas com o título do destino", async () => {
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

    const list = screen.getByRole("list", { name: "Arestas de Menu A" });
    const items = within(list).getAllByRole("listitem");
    expect(items.map((li) => [li.getAttribute("data-edge-kind"), li.getAttribute("data-edge-to")])).toEqual([
      ["option", "node-handover"],
      ["option", "node-ai"],
      ["fallback", "node-send"],
    ]);
    expect(items[0]).toHaveTextContent("1 → Transbordo Humano");
    expect(items[1]).toHaveTextContent("2 → Agente IA (Gemini)");
    expect(items[2]).toHaveTextContent("inválida → Enviar Mensagem");
  });

  it("menu sem opções (fallback reprompt): nenhuma aresta renderizada, e nenhuma seta sequencial leva a ele", async () => {
    const container = await renderWithFlow([...FIXED, menu()]);

    expect(screen.queryByRole("list", { name: "Arestas de Menu A" })).not.toBeInTheDocument();
    const sequenceTargets = Array.from(container.querySelectorAll('[data-edge-kind="sequence"]'))
      .map((el) => el.getAttribute("data-edge-to"));
    // Não-vazio de propósito (senão o teste passaria no código antigo, que
    // nem tinha o atributo): as 3 setas dos fixos existem, nenhuma vai pro menu.
    expect(sequenceTargets).toEqual(["node-ai", "node-send", "node-handover"]);
  });

  it("destino vazio e destino removido da árvore são sinalizados, nunca escondidos", async () => {
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

    const items = within(screen.getByRole("list", { name: "Arestas de Menu A" })).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("1 → (sem destino)");
    expect(items[1]).toHaveTextContent("2 → (nó removido)");
    expect(items[2]).toHaveTextContent("(sem destino)"); // fallback "node" sem fallbackNodeId
  });

  it("nós fixos inalterados: 3 setas sequenciais trigger→ai→send→handover, mesmo com menus no fim do array", async () => {
    const container = await renderWithFlow([...FIXED, menu(), menu({ id: "node-menu-b", title: "Menu B" })]);

    const seq = Array.from(container.querySelectorAll('[data-edge-kind="sequence"]'))
      .map((el) => [el.getAttribute("data-edge-from"), el.getAttribute("data-edge-to")]);
    expect(seq).toEqual([
      ["node-trigger", "node-ai"],
      ["node-ai", "node-send"],
      ["node-send", "node-handover"],
    ]);
  });
});
