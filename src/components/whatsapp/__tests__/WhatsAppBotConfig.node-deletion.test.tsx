// Acabamento do canvas — exclusão de nó "menu" (botão do inspector + tecla
// Delete/Backspace com o nó selecionado). A lógica de limpar referências é
// pura (applyNodeDeletion, flowCanvasModel.test.ts); aqui: o render/UI.
// Nós fixos NÃO podem ser excluídos (só desabilitados). O jsdom não desenha
// as linhas do React Flow, então as conexões são lidas da lista textual
// "Conexões do fluxo" (ver nota em src/test/setup.ts).
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

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
// Pré-carrega o chunk lazy do canvas na COLETA do arquivo: o import() do componente vira cache hit e o
// 1º findBy* não depende do tempo de transformação a frio sob carga (suíte inteira em paralelo).
import "@/components/whatsapp/FlowCanvas";

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

function menu(id: string, title: string, properties: Partial<MenuWorkflowNode["properties"]> = {}): MenuWorkflowNode {
  return {
    id, type: "menu", title, enabled: true,
    properties: { mensagem: "Escolha", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" }, ...properties },
  };
}

// trigger.nextNodeId → menu-a; menu-b tem 1 opção e o fallback apontando pra menu-a.
function flowWithRefs(): WorkflowNode[] {
  const trigger = { ...FIXED[0], properties: { respondAll: true, nextNodeId: "menu-a" } } as WorkflowNode;
  return [
    trigger, ...FIXED.slice(1),
    menu("menu-a", "Menu A", { opcoes: [{ numero: 1, rotulo: "p/ envio", nextNodeId: "node-send" }] }),
    menu("menu-b", "Menu B", {
      opcoes: [{ numero: 1, rotulo: "volta pro A", nextNodeId: "menu-a" }, { numero: 2, rotulo: "humano", nextNodeId: "node-handover" }],
      fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "menu-a" },
    }),
  ];
}

async function renderWithFlow(flow: WorkflowNode[]) {
  mocks.update.mockClear();
  mocks.maybeSingle.mockResolvedValue({
    data: { id: "bs-1", is_active: false, flow_data: flow, gemini_api_key: "", gcp_service_account: "" },
    error: null,
  });
  const { container } = render(<WhatsAppBotConfig workspaceId="ws-1" />);
  // card do canvas (chunk lazy resolvido) — timeout maior: o 1º import dinâmico a frio demora.
  await screen.findByText("Gatilho de Entrada", undefined, { timeout: 5000 });
  return container;
}

// O título também aparece no valor do select "Começar por" do gatilho — clica o CARD pelo id.
const clickNode = (c: HTMLElement, id: string) => fireEvent.click(c.querySelector(`[data-flow-node-id="${id}"]`) as HTMLElement);
const cardIds = (c: HTMLElement) => Array.from(c.querySelectorAll("[data-flow-node-id]")).map((e) => e.getAttribute("data-flow-node-id"));
const connections = () => within(screen.getByRole("list", { name: "Conexões do fluxo" })).queryAllByRole("listitem");

describe("exclusão de nó de menu — botão do inspector", () => {
  it("'Excluir nó' pede confirmação (com a contagem de conexões); 'Cancelar' mantém o nó", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-a");

    fireEvent.click(screen.getByRole("button", { name: /Excluir nó/ }));
    // menu-a: chega 1 do trigger (entrada) + 1 opção e 1 fallback do menu-b; sai 1 opção → 4
    expect(screen.getByRole("alert")).toHaveTextContent("4 conexão(ões)");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(cardIds(container)).toContain("menu-a");
    expect(screen.queryByRole("button", { name: "Confirmar exclusão" })).not.toBeInTheDocument();
  });

  it("'Confirmar exclusão' remove o card e limpa TODAS as arestas que apontavam pra ele; o inspector volta pro gatilho", async () => {
    const container = await renderWithFlow(flowWithRefs());
    expect(connections().filter((li) => li.getAttribute("data-edge-to") === "menu-a")).toHaveLength(3);

    clickNode(container, "menu-a");
    fireEvent.click(screen.getByRole("button", { name: /Excluir nó/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    expect(cardIds(container)).toEqual(["node-trigger", "node-ai", "node-send", "node-handover", "menu-b"]);
    // nenhuma conexão (desenhada) toca o nó excluído
    expect(connections().some((li) => li.getAttribute("data-edge-to") === "menu-a" || li.getAttribute("data-edge-from") === "menu-a")).toBe(false);
    // inspector caiu no gatilho (o nó ativo foi excluído)
    expect(screen.getByText("Configuração do Nó: Gatilho de Entrada")).toBeInTheDocument();

    // as referências foram LIMPAS (não deixaram id fantasma): o menu-b mostra "sem destino", não "removido"
    clickNode(container, "menu-b");
    const alerts = screen.getAllByRole("alert").map((a) => a.textContent ?? "");
    expect(alerts.some((t) => /Opção 1.*sem destino/.test(t))).toBe(true);
    expect(alerts.some((t) => /Resposta inválida.*sem destino/.test(t))).toBe(true);
    expect(alerts.some((t) => /não existe mais/.test(t))).toBe(false);
  });

  it("salvar depois de excluir grava um flow_data SEM o nó e SEM nenhuma referência a ele", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-a");
    fireEvent.click(screen.getByRole("button", { name: /Excluir nó/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string; properties: Record<string, unknown> }> };
    expect(payload.flow_data.map((n) => n.id)).not.toContain("menu-a");
    expect(JSON.stringify(payload.flow_data)).not.toContain("menu-a");
    // o trigger perdeu a chave nextNodeId (volta ao automático)
    expect(payload.flow_data.find((n) => n.id === "node-trigger")?.properties).not.toHaveProperty("nextNodeId");
  });
});

describe("nós fixos NÃO podem ser excluídos (só desabilitados)", () => {
  it("nenhum dos 4 fixos tem o botão 'Excluir nó' e todos mostram o aviso de nó fixo", async () => {
    const container = await renderWithFlow(flowWithRefs());
    for (const id of ["node-trigger", "node-ai", "node-send", "node-handover"]) {
      clickNode(container, id);
      expect(screen.queryByRole("button", { name: /Excluir nó/ })).not.toBeInTheDocument();
      expect(screen.getByText(/Nó fixo do fluxo — não pode ser excluído, só desabilitado/)).toBeInTheDocument();
    }
  });

  it("Delete/Backspace com um nó fixo selecionado não exclui nada", async () => {
    const container = await renderWithFlow(flowWithRefs());
    const before = cardIds(container);
    for (const id of ["node-trigger", "node-ai"]) {
      clickNode(container, id);
      const card = container.querySelector(`[data-flow-node-id="${id}"]`) as HTMLElement;
      fireEvent.keyDown(card, { key: "Delete" });
      fireEvent.keyDown(card, { key: "Backspace" });
    }
    expect(cardIds(container)).toEqual(before);
  });
});

describe("exclusão de nó de menu — tecla Delete/Backspace no canvas", () => {
  it("Delete com o nó de menu selecionado exclui o nó e limpa as referências", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-b"); // seleciona
    const card = container.querySelector('[data-flow-node-id="menu-b"]') as HTMLElement;
    fireEvent.keyDown(card, { key: "Delete" });

    expect(cardIds(container)).not.toContain("menu-b");
    expect(connections().some((li) => li.getAttribute("data-edge-from") === "menu-b")).toBe(false);
    expect(screen.getByText("Configuração do Nó: Gatilho de Entrada")).toBeInTheDocument();
  });

  it("Backspace também exclui", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-b");
    fireEvent.keyDown(container.querySelector('[data-flow-node-id="menu-b"]') as HTMLElement, { key: "Backspace" });
    expect(cardIds(container)).not.toContain("menu-b");
  });

  it("a tecla é IGNORADA com o foco num campo de texto do inspector (digitar/apagar não exclui o nó)", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-a");
    const titleInput = screen.getByPlaceholderText("Ex: Menu principal");
    // o evento sobe do input pro wrapper? O inspector fica FORA do wrapper do canvas;
    // simulamos o caso perigoso: keydown com alvo input DENTRO do canvas.
    const canvas = screen.getByTestId("flow-canvas");
    const stray = document.createElement("input");
    canvas.appendChild(stray);
    fireEvent.keyDown(stray, { key: "Backspace" });
    fireEvent.keyDown(titleInput, { key: "Backspace" });
    expect(cardIds(container)).toContain("menu-a");
    canvas.removeChild(stray);
  });

  it("a tecla é IGNORADA com o foco num botão (switch do card, '+ Adicionar nó de menu')", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-a");
    fireEvent.keyDown(screen.getByRole("button", { name: /Adicionar nó de menu/i }), { key: "Delete" });
    fireEvent.keyDown(screen.getByRole("switch", { name: "Habilitar Menu A" }), { key: "Delete" });
    expect(cardIds(container)).toContain("menu-a");
  });

  it("outras teclas não fazem nada", async () => {
    const container = await renderWithFlow(flowWithRefs());
    clickNode(container, "menu-a");
    fireEvent.keyDown(container.querySelector('[data-flow-node-id="menu-a"]') as HTMLElement, { key: "Enter" });
    expect(cardIds(container)).toContain("menu-a");
  });
});
