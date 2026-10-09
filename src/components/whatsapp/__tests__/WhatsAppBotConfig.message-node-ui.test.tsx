// Etapa 9 · item 4, R7 — nó "mensagem" montável pelo usuário (texto informativo
// entre menus). Testes de render/estado: criação, inspector (título/texto/
// destino), arestas (lista textual "Conexões do fluxo" — mesmas arestas que o
// canvas desenha; o jsdom não mede nós, ver src/test/setup.ts), "Começar por"
// aceitando mensagem, exclusão com limpeza de referências e persistência no
// flow_data. Zero mudança de runtime aqui — o motor tem testes próprios
// (botFlowMessage.test.ts / botFlowSimulationMessage.test.ts).
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

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
// Pré-carrega o chunk lazy do canvas na COLETA do arquivo (ver canvas-edges.test).
import "@/components/whatsapp/FlowCanvas";

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
});

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

function menu(over: Partial<MenuWorkflowNode> & { opcoes?: MenuWorkflowNode["properties"]["opcoes"] } = {}): MenuWorkflowNode {
  const { opcoes, ...rest } = over;
  return {
    id: "menu-a", type: "menu", title: "Menu A", enabled: true,
    properties: { mensagem: "Escolha", opcoes: opcoes ?? [], fallback: { maxTentativas: 3, acao: "reprompt" } },
    ...rest,
  };
}

function message(over: Partial<MessageWorkflowNode> = {}): MessageWorkflowNode {
  return {
    id: "msg-horario", type: "message", title: "Horário", enabled: true,
    properties: { mensagem: "Seg–sex 9h–18h" },
    ...over,
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

const clickNode = (c: HTMLElement, id: string) =>
  fireEvent.click(c.querySelector(`[data-flow-node-id="${id}"]`) as HTMLElement);

function connections(): HTMLElement[] {
  return within(screen.getByRole("list", { name: "Conexões do fluxo" })).queryAllByRole("listitem");
}
const triple = (li: HTMLElement) => [li.getAttribute("data-edge-kind"), li.getAttribute("data-edge-from"), li.getAttribute("data-edge-to")];

async function openSelect(current: RegExp | string) {
  const trigger = screen
    .getAllByRole("combobox")
    .find((el) => (typeof current === "string" ? el.textContent?.includes(current) : current.test(el.textContent ?? ""))) as HTMLElement;
  fireEvent.click(trigger);
  return within(await screen.findByRole("listbox"));
}

describe("R7 · nó 'mensagem' — criação e inspector", () => {
  it("'+ Adicionar nó de mensagem' cria e seleciona o nó (card + inspector do tipo), numerando o título", async () => {
    const container = await renderWithFlow(FIXED);
    expect(container.querySelector('[data-flow-node-type="message"]')).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de mensagem/i }));
    expect(screen.getByText("Configuração do Nó: Mensagem 1")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-flow-node-type="message"]')).toHaveLength(1);
    expect(screen.getByText("Texto da mensagem")).toBeInTheDocument();
    expect(screen.getByText("Depois de enviar, ir para")).toBeInTheDocument();
    // nasce vazia: o inspector avisa que o robô a ignora até haver texto
    expect(screen.getByRole("alert")).toHaveTextContent(/Texto vazio/);

    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de mensagem/i }));
    expect(screen.getByText("Configuração do Nó: Mensagem 2")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-flow-node-type="message"]')).toHaveLength(2);
  });

  it("os botões de menu e de mensagem convivem; o de menu continua criando 'Menu N'", async () => {
    await renderWithFlow(FIXED);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de menu/i }));
    expect(screen.getByText("Configuração do Nó: Menu 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de mensagem/i }));
    expect(screen.getByText("Configuração do Nó: Mensagem 1")).toBeInTheDocument();
  });

  it("editar título e texto reflete no card e no inspector; o aviso de texto vazio some", async () => {
    await renderWithFlow(FIXED);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar nó de mensagem/i }));

    fireEvent.change(screen.getByPlaceholderText("Ex: Horário de atendimento"), { target: { value: "Horário" } });
    fireEvent.change(screen.getByPlaceholderText(/Atendemos de segunda a sexta/), {
      target: { value: "Seg–sex 9h–18h" },
    });

    expect(screen.getByText("Configuração do Nó: Horário")).toBeInTheDocument();
    expect(screen.getByText("Seg–sex 9h–18h", { selector: "p" })).toBeInTheDocument(); // resumo no card
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("o nó de mensagem NÃO é fixo: o inspector não mostra a nota 'Nó fixo do fluxo'", async () => {
    await renderWithFlow([...FIXED, message()]);
    const container = document.body;
    clickNode(container, "msg-horario");
    expect(screen.queryByText(/Nó fixo do fluxo/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir nó/i })).toBeInTheDocument();
  });
});

describe("R7 · nó 'mensagem' — conexões (lista 'Conexões do fluxo')", () => {
  it("destino: lista só menus/mensagens (sem fixos e sem o próprio nó); escolher um menu cria a aresta 'next' editável", async () => {
    const container = await renderWithFlow([...FIXED, menu(), message()]);
    clickNode(container, "msg-horario");

    expect(connections().some((li) => li.getAttribute("data-edge-from") === "msg-horario")).toBe(false);

    const list = await openSelect("Encerrar o fluxo");
    const labels = list.getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Encerrar o fluxo — padrão", "Menu A"]); // sem Horário (ele mesmo) nem fixos
    fireEvent.click(list.getByText("Menu A"));

    const next = connections().filter((li) => li.getAttribute("data-edge-from") === "msg-horario");
    expect(next.map(triple)).toEqual([["next", "msg-horario", "menu-a"]]);
    expect(next[0].getAttribute("data-edge-editable")).toBe("true");
    expect(next[0]).toHaveTextContent("Horário → Menu A");
  });

  it("'Encerrar o fluxo' de volta: a aresta some e a chave nextNodeId sai do flow_data salvo", async () => {
    const container = await renderWithFlow([...FIXED, menu(), message({ properties: { mensagem: "Seg–sex", nextNodeId: "menu-a" } })]);
    expect(connections().some((li) => li.getAttribute("data-edge-kind") === "next")).toBe(true);

    clickNode(container, "msg-horario");
    const list = await openSelect("Menu A");
    fireEvent.click(list.getByText("Encerrar o fluxo — padrão"));
    expect(connections().some((li) => li.getAttribute("data-edge-kind") === "next")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string; properties: Record<string, unknown> }> };
    const saved = payload.flow_data.find((n) => n.id === "msg-horario")!;
    expect(saved.properties).toEqual({ mensagem: "Seg–sex" });
    expect("nextNodeId" in saved.properties).toBe(false);
  });

  it("mensagem → mensagem → menu e opção do menu → mensagem aparecem como arestas reais; fixos seguem só com a sequência", async () => {
    const flow = [
      ...FIXED,
      menu({ opcoes: [{ numero: 1, rotulo: "Horário", nextNodeId: "msg-horario" }] }),
      message({ properties: { mensagem: "Seg–sex", nextNodeId: "msg-endereco" } }),
      message({ id: "msg-endereco", title: "Endereço", properties: { mensagem: "Rua X", nextNodeId: "menu-a" } }),
    ];
    await renderWithFlow(flow);

    const editable = connections().filter((li) => li.getAttribute("data-edge-editable") === "true");
    expect(editable.map(triple)).toEqual([
      ["option", "menu-a", "msg-horario"],
      ["next", "msg-horario", "msg-endereco"],
      ["next", "msg-endereco", "menu-a"],
    ]);
    const seq = connections().filter((li) => li.getAttribute("data-edge-kind") === "sequence");
    expect(seq.map(triple)).toEqual([
      ["sequence", "node-trigger", "node-ai"],
      ["sequence", "node-ai", "node-send"],
      ["sequence", "node-send", "node-handover"],
    ]); // nenhuma seta posicional entra/sai da mensagem
  });

  it("'Começar por' aceita mensagem: escolher gera a aresta de entrada trigger → mensagem", async () => {
    await renderWithFlow([...FIXED, menu(), message({ id: "msg-boas-vindas", title: "Boas-vindas" })]);
    fireEvent.click(screen.getByText("Gatilho de Entrada"));

    const list = await openSelect("Automático (primeiro menu habilitado)");
    expect(list.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Automático (primeiro menu habilitado)",
      "Menu A",
      "Boas-vindas",
    ]);
    fireEvent.click(list.getByText("Boas-vindas"));

    const entry = connections().filter((li) => li.getAttribute("data-edge-kind") === "entry");
    expect(entry.map(triple)).toEqual([["entry", "node-trigger", "msg-boas-vindas"]]);
    // mensagem habilitada é uma entrada VÁLIDA: sem aviso de "entrada ignorada"
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("entrada apontando pra mensagem DESABILITADA: desenhada, mas o inspector avisa que é ignorada", async () => {
    const trig = { ...FIXED[0], properties: { respondAll: true, nextNodeId: "msg-horario" } } as WorkflowNode;
    await renderWithFlow([trig, ...FIXED.slice(1), menu(), message({ enabled: false })]);
    fireEvent.click(screen.getByText("Gatilho de Entrada"));
    expect(screen.getByRole("alert")).toHaveTextContent(/não é um menu habilitado nem uma mensagem habilitada/);
  });

  it("destino que sumiu: a aresta NÃO é desenhada e o inspector da mensagem avisa", async () => {
    const container = await renderWithFlow([...FIXED, message({ properties: { mensagem: "x", nextNodeId: "node-que-sumiu" } })]);
    expect(connections().some((li) => li.getAttribute("data-edge-from") === "msg-horario")).toBe(false);

    clickNode(container, "msg-horario");
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toMatch(/destino depois de enviar não existe mais/);
  });

  it("destino que é um nó fixo/desabilitado: o inspector avisa que o fluxo encerra depois do texto", async () => {
    const container = await renderWithFlow([
      ...FIXED,
      message({ properties: { mensagem: "x", nextNodeId: "node-handover" } }),
    ]);
    clickNode(container, "msg-horario");
    expect(screen.getAllByRole("alert").map((a) => a.textContent).join(" ")).toMatch(/não é um menu habilitado nem uma mensagem habilitada/);
  });
});

describe("R7 · nó 'mensagem' — exclusão e persistência", () => {
  it("excluir (2 passos) remove o nó e limpa opção do menu e entrada do trigger que apontavam pra ele", async () => {
    const trig = { ...FIXED[0], properties: { respondAll: true, nextNodeId: "msg-horario" } } as WorkflowNode;
    const container = await renderWithFlow([
      trig, ...FIXED.slice(1),
      menu({ opcoes: [{ numero: 1, rotulo: "Horário", nextNodeId: "msg-horario" }] }),
      message({ properties: { mensagem: "x", nextNodeId: "menu-a" } }),
    ]);
    clickNode(container, "msg-horario");

    fireEvent.click(screen.getByRole("button", { name: /Excluir nó/i }));
    // entrada + opção + saída da mensagem = 3 conexões que somem junto
    expect(screen.getByRole("alert")).toHaveTextContent(/3 conexão\(ões\)/);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar exclusão/i }));

    expect(container.querySelector('[data-flow-node-id="msg-horario"]')).toBeNull();
    expect(connections().filter((li) => li.getAttribute("data-edge-editable") === "true")).toHaveLength(0);
    // a opção ficou "sem destino" (não um id fantasma) e a seleção voltou pro gatilho
    expect(screen.getByText("Configuração do Nó: Gatilho de Entrada")).toBeInTheDocument();
  });

  it("flow_data salvo com nós 'message' carrega (compat) e salvar grava mensagem + nextNodeId + posição", async () => {
    await renderWithFlow([
      ...FIXED,
      menu(),
      message({ properties: { mensagem: "Seg–sex 9h–18h", nextNodeId: "menu-a" } }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/i }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as {
      flow_data: Array<{ id: string; type: string; properties: Record<string, unknown>; position?: { x: number; y: number } }>;
    };
    const saved = payload.flow_data.find((n) => n.type === "message")!;
    expect(saved.properties).toEqual({ mensagem: "Seg–sex 9h–18h", nextNodeId: "menu-a" });
    expect(typeof saved.position?.x).toBe("number");
  });

  it("flow_data SEM nós 'message' (antes da R7) abre igual: nenhum card de mensagem, mesmas arestas", async () => {
    const container = await renderWithFlow([...FIXED, menu({ opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "node-handover" }] })]);
    expect(container.querySelector('[data-flow-node-type="message"]')).toBeNull();
    expect(connections().map(triple)).toEqual([
      ["sequence", "node-trigger", "node-ai"],
      ["sequence", "node-ai", "node-send"],
      ["sequence", "node-send", "node-handover"],
      ["option", "menu-a", "node-handover"],
    ]);
  });
});
