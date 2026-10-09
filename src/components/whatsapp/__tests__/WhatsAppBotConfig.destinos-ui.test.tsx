// Etapa 9 · item 4, R8 — Selects de destino listam handover e ai com o rótulo do
// que ACONTECE; destino desabilitado avisa (nunca entrega/passa à IA por nó
// desligado); a aresta aparece na lista "Conexões do fluxo"; "Começar por" NÃO
// aceita terminais. Render/estado apenas (o motor tem testes próprios).
import { render, screen, within, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

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
import "@/components/whatsapp/FlowCanvas";

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
});

function fixed(handoverEnabled: boolean, aiEnabled = true): WorkflowNode[] {
  return [
    { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
    {
      id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: aiEnabled,
      properties: {
        instruction: "x", model: "gemini-3.6-flash", provider: "gemini_api_key", geminiApiKey: "",
        gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
      },
    },
    { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
    { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: handoverEnabled, properties: { assignTo: "" } },
  ];
}

const menu = (properties: Partial<MenuWorkflowNode["properties"]> = {}): MenuWorkflowNode => ({
  id: "menu-a", type: "menu", title: "Menu A", enabled: true,
  properties: { mensagem: "Escolha", opcoes: [], fallback: { maxTentativas: 3, acao: "reprompt" }, ...properties },
});
const message = (properties: MessageWorkflowNode["properties"] = { mensagem: "Já te passo." }): MessageWorkflowNode => ({
  id: "msg-aviso", type: "message", title: "Aviso", enabled: true, properties,
});

async function renderWithFlow(flow: WorkflowNode[]) {
  mocks.maybeSingle.mockResolvedValue({
    data: { id: "bs-1", is_active: false, flow_data: flow, gemini_api_key: "", gcp_service_account: "" },
    error: null,
  });
  const { container } = render(<WhatsAppBotConfig workspaceId="ws-1" />);
  await screen.findByText("Gatilho de Entrada");
  return container;
}

const clickNode = (c: HTMLElement, id: string) =>
  fireEvent.click(c.querySelector(`[data-flow-node-id="${id}"]`) as HTMLElement);

const connections = () =>
  within(screen.getByRole("list", { name: "Conexões do fluxo" })).queryAllByRole("listitem");
const triple = (li: HTMLElement) => [li.getAttribute("data-edge-kind"), li.getAttribute("data-edge-from"), li.getAttribute("data-edge-to")];

async function openSelect(match: RegExp | string) {
  const trigger = screen
    .getAllByRole("combobox")
    .find((el) => (typeof match === "string" ? el.textContent?.includes(match) : match.test(el.textContent ?? ""))) as HTMLElement;
  fireEvent.click(trigger);
  return within(await screen.findByRole("listbox"));
}

describe("R8 · destinos handover/ai — Selects com rótulo do que acontece", () => {
  it("nó de mensagem: handover e ai aparecem com o efeito; escolher o handover cria a aresta 'next'", async () => {
    const container = await renderWithFlow([...fixed(true), menu(), message()]);
    clickNode(container, "msg-aviso");

    const list = await openSelect("Encerrar o fluxo");
    const options = list.getAllByRole("option").map((o) => o.textContent ?? "");
    expect(options.find((t) => t.startsWith("Transbordo Humano"))).toContain("entrega a um atendente humano");
    expect(options.find((t) => t.startsWith("Agente IA"))).toContain("a IA responde daqui em diante");
    expect(options.find((t) => t.startsWith("Menu A"))).toContain("apresenta o menu");

    fireEvent.click(list.getByText("Transbordo Humano"));
    const next = connections().filter((li) => li.getAttribute("data-edge-from") === "msg-aviso");
    expect(next.map(triple)).toEqual([["next", "msg-aviso", "node-handover"]]);
    // habilitado e utilizável: nenhum aviso de destino inválido
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("opção do menu: lista terminais com o efeito (hint) sem mudar o título", async () => {
    await renderWithFlow([...fixed(true), menu({ opcoes: [{ numero: 1, rotulo: "Humano", nextNodeId: "" }] })]);
    fireEvent.click(screen.getByText("Menu A"));

    const row = screen.getByPlaceholderText("Rótulo (ex: Suporte)").closest("div") as HTMLElement;
    fireEvent.click(within(row).getByRole("combobox"));
    const list = within(await screen.findByRole("listbox"));
    expect(list.getByText("Transbordo Humano")).toBeInTheDocument(); // título intacto (span próprio)
    expect(list.getAllByText(/entrega a um atendente humano/)).toHaveLength(1);
    expect(list.getAllByText(/a IA responde daqui em diante/)).toHaveLength(1);
  });

  it("'Começar por' NÃO lista handover nem ai (entrada só em menu/mensagem)", async () => {
    await renderWithFlow([...fixed(true), menu(), message()]);
    fireEvent.click(screen.getByText("Gatilho de Entrada"));

    const list = await openSelect("Automático (primeiro menu habilitado)");
    const titles = list.getAllByRole("option").map((o) => o.textContent);
    expect(titles).toEqual(["Automático (primeiro menu habilitado)", "Menu A", "Aviso"]);
  });
});

describe("R8 · destino DESABILITADO é destino inválido (aviso, nunca entrega)", () => {
  it("mensagem → handover desabilitado: aresta desenhada, mas o inspector avisa que é inválido", async () => {
    const container = await renderWithFlow([...fixed(false), menu(), message({ mensagem: "x", nextNodeId: "node-handover" })]);
    clickNode(container, "msg-aviso");
    expect(screen.getByRole("alert")).toHaveTextContent(/“Transbordo Humano” está desabilitado.*destino inválido/);
  });

  it("opção do menu → handover desabilitado (o caso do fluxo padrão, em que ele nasce desligado): aviso na opção", async () => {
    await renderWithFlow([...fixed(false), menu({ opcoes: [{ numero: 1, rotulo: "Humano", nextNodeId: "node-handover" }] })]);
    fireEvent.click(screen.getByText("Menu A"));
    expect(screen.getByRole("alert")).toHaveTextContent(/Opção 1 → “Transbordo Humano” está desabilitado — destino inválido/);
  });

  it("opção → ai desabilitado: idem; e o item do Select mostra 'desabilitado — destino inválido'", async () => {
    await renderWithFlow([
      ...fixed(true, false),
      menu({ opcoes: [{ numero: 1, rotulo: "IA", nextNodeId: "node-ai" }] }),
    ]);
    fireEvent.click(screen.getByText("Menu A"));
    expect(screen.getByRole("alert")).toHaveTextContent(/Opção 1 → “Agente IA \(Gemini\)” está desabilitado/);
  });

  it("fallback 'node' → ai desabilitado: aviso no bloco de resposta inválida", async () => {
    await renderWithFlow([
      ...fixed(true, false),
      menu({ fallback: { maxTentativas: 2, acao: "node", fallbackNodeId: "node-ai" } }),
    ]);
    fireEvent.click(screen.getByText("Menu A"));
    expect(screen.getByRole("alert")).toHaveTextContent(/depois das tentativas a conversa sai do menu sem executar o nó/);
  });

  it("destino HABILITADO não gera aviso (handover e ai ligados)", async () => {
    await renderWithFlow([
      ...fixed(true),
      menu({
        opcoes: [
          { numero: 1, rotulo: "Humano", nextNodeId: "node-handover" },
          { numero: 2, rotulo: "IA", nextNodeId: "node-ai" },
        ],
      }),
    ]);
    fireEvent.click(screen.getByText("Menu A"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
