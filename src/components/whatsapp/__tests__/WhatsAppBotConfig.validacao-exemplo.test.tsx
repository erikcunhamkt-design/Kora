// R10 — render: painel "Problemas do fluxo" (lista clicável que seleciona o nó),
// contagem no botão Salvar ("Salvar mesmo assim" — erro NÃO bloqueia), resumo no
// simulador quando há erros, e "Carregar fluxo de exemplo" (2 passos, só no fluxo
// que ainda não tem menu/mensagem, nunca sobrescreve).
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
import "@/components/whatsapp/FlowCanvas";

beforeEach(() => {
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
});

function fixed(handover = true): WorkflowNode[] {
  return [
    { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
    {
      id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
      properties: {
        instruction: "x", model: "gemini-3.6-flash", provider: "gemini_api_key", geminiApiKey: "",
        gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
      },
    },
    { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
    { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: handover, properties: { assignTo: "" } },
  ];
}
const menu = (opcoes: MenuWorkflowNode["properties"]["opcoes"], id = "menu-a", title = "Menu A"): MenuWorkflowNode => ({
  id, type: "menu", title, enabled: true,
  properties: { mensagem: "Escolha", opcoes, fallback: { maxTentativas: 3, acao: "reprompt" } },
});
const message = (mensagem: string): MessageWorkflowNode => ({
  id: "msg-vazia", type: "message", title: "Aviso", enabled: true, properties: { mensagem, nextNodeId: "menu-a" },
});

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
const problems = () => screen.queryByRole("region", { name: "Problemas do fluxo" });

describe("R10 · painel 'Problemas do fluxo'", () => {
  it("fluxo sem problemas (os 4 fixos): nenhum painel, botão com o rótulo de sempre", async () => {
    await renderWithFlow(fixed(false));
    expect(problems()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Fluxo" })).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Problemas do fluxo no simulador" })).not.toBeInTheDocument();
  });

  it("lista erros e avisos com a severidade; contagem no título", async () => {
    await renderWithFlow([...fixed(), menu([]), message("   ")]);
    const panel = problems()!;
    expect(panel).toBeInTheDocument();
    // menu sem opções + mensagem vazia (erros) e a mensagem que ninguém alcança (aviso)
    expect(within(panel).getByRole("heading")).toHaveTextContent("Problemas do fluxo — 2 erros e 1 aviso");
    const items = within(panel).getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-issue-code")).sort()).toEqual(["inalcancavel", "mensagem-vazia", "menu-sem-opcoes"]);
    expect(items.map((li) => li.getAttribute("data-issue-severity"))).toEqual(["error", "error", "warning"]); // erros primeiro
  });

  it("só avisos: o título conta avisos e o botão mostra 'Salvar Fluxo (N avisos)' (sem 'mesmo assim')", async () => {
    // menu válido, mas há um segundo menu habilitado: entrada em Automático = ambígua (aviso) e o 2º menu ninguém alcança (aviso)
    await renderWithFlow([...fixed(), menu([{ numero: 1, rotulo: "H", nextNodeId: "node-handover" }]), menu([{ numero: 1, rotulo: "H", nextNodeId: "node-handover" }], "menu-b", "Menu B")]);
    expect(within(problems()!).getByRole("heading")).toHaveTextContent("Problemas do fluxo — 2 avisos");
    expect(screen.getByRole("button", { name: "Salvar Fluxo (2 avisos)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mesmo assim/ })).not.toBeInTheDocument();
  });

  it("clicar num problema SELECIONA o nó de origem (inspector do nó)", async () => {
    await renderWithFlow([...fixed(), menu([{ numero: 1, rotulo: "A", nextNodeId: "" }], "menu-a", "Menu A"), message("texto")]);
    expect(screen.getByText("Configuração do Nó: Gatilho de Entrada")).toBeInTheDocument();

    fireEvent.click(within(problems()!).getByRole("button", { name: /Opção 1.*não leva a lugar nenhum/ }));
    expect(screen.getByText("Configuração do Nó: Menu A")).toBeInTheDocument();
  });

  it("o painel acompanha a edição: corrigir o problema o remove", async () => {
    await renderWithFlow([...fixed(), menu([])]);
    expect(problems()).toBeInTheDocument();
    fireEvent.click(within(problems()!).getByRole("button", { name: /menu sem nenhuma opção/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar opção/i }));
    // a opção nova nasce sem destino → troca de "menu sem opções" por "opção sem destino"
    expect(within(problems()!).queryByRole("button", { name: /menu sem nenhuma opção/ })).not.toBeInTheDocument();
    expect(within(problems()!).getByRole("button", { name: /não leva a lugar nenhum/ })).toBeInTheDocument();
  });
});

describe("R10 · erro NÃO bloqueia salvar (mas nunca é escondido)", () => {
  it("com erros o botão vira 'Salvar mesmo assim (contagem)' e SALVA o fluxo como está", async () => {
    await renderWithFlow([...fixed(), menu([]), message("")]);
    const button = screen.getByRole("button", { name: "Salvar mesmo assim (2 erros e 1 aviso)" });
    expect(button).toBeEnabled();

    fireEvent.click(button);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as { flow_data: Array<{ id: string }> };
    expect(payload.flow_data.map((n) => n.id)).toContain("menu-a"); // gravou o menu com erro, sem "consertar"
  });

  it("1 erro usa o singular", async () => {
    await renderWithFlow([...fixed(), menu([])]);
    expect(screen.getByRole("button", { name: "Salvar mesmo assim (1 erro)" })).toBeInTheDocument();
  });
});

describe("R10 · resumo no simulador", () => {
  it("com ERROS o simulador mostra o mesmo resumo no topo", async () => {
    await renderWithFlow([...fixed(), menu([]), message("")]);
    const banner = screen.getByRole("status", { name: "Problemas do fluxo no simulador" });
    expect(banner).toHaveTextContent("Problemas do fluxo: 2 erros");
  });

  it("só AVISOS não poluem o simulador (o resumo é só quando há erros)", async () => {
    await renderWithFlow([...fixed(), menu([{ numero: 1, rotulo: "H", nextNodeId: "node-handover" }]), menu([{ numero: 1, rotulo: "H", nextNodeId: "node-handover" }], "menu-b", "Menu B")]);
    expect(screen.queryByRole("status", { name: "Problemas do fluxo no simulador" })).not.toBeInTheDocument();
  });
});

describe("R10 · Carregar fluxo de exemplo", () => {
  it("aparece só com os 4 fixos; confirmação em 2 passos antes de montar (Cancelar não muda nada)", async () => {
    const container = await renderWithFlow(fixed(false));
    const open = screen.getByRole("button", { name: /Carregar fluxo de exemplo/ });

    fireEvent.click(open);
    expect(screen.getByRole("alert")).toHaveTextContent(/Montar um fluxo de exemplo\?/);
    expect(container.querySelector('[data-flow-node-type="menu"]')).toBeNull(); // ainda nada montado

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector('[data-flow-node-type="menu"]')).toBeNull();
    expect(screen.getByRole("button", { name: /Carregar fluxo de exemplo/ })).toBeInTheDocument();
  });

  it("confirmar monta o exemplo (menu + 2 mensagens, entrada ligada), seleciona o menu e SOME o botão; sem problemas", async () => {
    const container = await renderWithFlow(fixed(false));
    fireEvent.click(screen.getByRole("button", { name: /Carregar fluxo de exemplo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Carregar exemplo" }));

    expect(container.querySelectorAll('[data-flow-node-type="menu"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-flow-node-type="message"]')).toHaveLength(2);
    expect(screen.getByText("Configuração do Nó: Menu principal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Carregar fluxo de exemplo/ })).not.toBeInTheDocument();

    const list = within(screen.getByRole("list", { name: "Conexões do fluxo" })).getAllByRole("listitem");
    const kinds = list.map((li) => li.getAttribute("data-edge-kind"));
    expect(kinds.filter((k) => k === "entry")).toHaveLength(1);
    expect(kinds.filter((k) => k === "option")).toHaveLength(3);
    expect(kinds.filter((k) => k === "next")).toHaveLength(2);

    // passa na validação: nenhum painel, botão com o rótulo de sempre
    expect(problems()).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar Fluxo" })).toBeInTheDocument();
  });

  it("o exemplo carregado salva no flow_data (com a palavra de retorno e o handover habilitado)", async () => {
    await renderWithFlow(fixed(false));
    fireEvent.click(screen.getByRole("button", { name: /Carregar fluxo de exemplo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Carregar exemplo" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar Fluxo" }));

    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    const payload = mocks.update.mock.calls[0][0] as {
      flow_data: Array<{ id: string; type: string; enabled: boolean; properties: Record<string, unknown> }>;
    };
    expect(payload.flow_data).toHaveLength(7);
    expect(payload.flow_data.find((n) => n.type === "handover")?.enabled).toBe(true);
    expect(payload.flow_data.find((n) => n.type === "ai")?.properties.palavraRetorno).toBe("menu");
    expect(payload.flow_data.find((n) => n.type === "trigger")?.properties.nextNodeId).toBeTruthy();
  });

  it("NUNCA sobrescreve: com um menu do usuário o botão nem existe", async () => {
    await renderWithFlow([...fixed(), menu([{ numero: 1, rotulo: "H", nextNodeId: "node-handover" }])]);
    expect(screen.queryByRole("button", { name: /Carregar fluxo de exemplo/ })).not.toBeInTheDocument();
  });

  it("com uma mensagem do usuário (mesmo sem menu) o botão também não existe", async () => {
    await renderWithFlow([...fixed(), { ...message("oi"), properties: { mensagem: "oi" } }]);
    expect(screen.queryByRole("button", { name: /Carregar fluxo de exemplo/ })).not.toBeInTheDocument();
  });
});
