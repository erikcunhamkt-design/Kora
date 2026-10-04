// Etapa 9 · Item 4 — simulador do fluxo, lado UI (fecha U1–U4 de docs/qa/etapa-9-
// bot-simulador-fluxo-cobertura.md §1.2). Montagem REAL de WhatsAppBotConfig.
//
// O `functions.invoke` aqui NÃO é um stub de respostas prontas: ele roda o motor
// REAL do server (`simulateFlowTurn`/`wantsFlowSimulation`, as mesmas funções que
// whatsapp-bot-reply usa no ramo isTest) — então estes testes provam o contrato
// UI ↔ server de ponta a ponta (qualquer divergência de formato quebra aqui).
// Só o caminho de IA é simulado (devolve "RESPOSTA DA IA").
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { simulateFlowTurn, wantsFlowSimulation } from "../../../../supabase/functions/_shared/botFlowSimulation";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const invoke = vi.fn();
  return { maybeSingle, eq, select, from, invoke };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from, functions: { invoke: mocks.invoke } },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: () => ({ role: "owner", isAdmin: true, loading: false }),
}));
// O canvas (xyflow) não é o alvo destes testes (tem suíte própria — R6) e re-renderizar
// ele a cada mensagem do simulador deixava cada teste lento no jsdom.
vi.mock("@/components/whatsapp/FlowCanvas", () => ({ FlowCanvas: () => <div data-testid="flow-canvas-stub" /> }));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

// ---- fluxos de teste (formato salvo em whatsapp_bot_settings.flow_data) ----

const trigger = (props: Record<string, unknown> = {}, enabled = true) => ({
  id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled, properties: { respondAll: true, ...props },
});
const aiNode = {
  id: "node-ai", type: "ai", title: "Agente de IA", enabled: true,
  properties: {
    instruction: "Seja breve", model: "gemini-2.5-flash", provider: "gemini_api_key",
    geminiApiKey: "", gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
  },
};
const handoverNode = { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: true, properties: { assignTo: "" } };
const menuPrincipal = {
  id: "menu-1", type: "menu", title: "Menu principal", enabled: true,
  properties: {
    mensagem: "Escolha uma opção:",
    opcoes: [
      { numero: 1, rotulo: "Financeiro", nextNodeId: "menu-fin" },
      { numero: 2, rotulo: "Falar com atendente", nextNodeId: "node-handover" },
    ],
    fallback: { maxTentativas: 3, acao: "reprompt" },
  },
};
const menuFinanceiro = {
  id: "menu-fin", type: "menu", title: "Menu financeiro", enabled: true,
  properties: {
    mensagem: "Financeiro:",
    opcoes: [{ numero: 1, rotulo: "Segunda via", nextNodeId: "node-ai" }],
    fallback: { maxTentativas: 3, acao: "reprompt" },
  },
};

function loadFlow(flow: unknown[]) {
  mocks.maybeSingle.mockResolvedValue({
    data: { is_active: true, flow_data: flow, gemini_api_key: "", gcp_service_account: "", system_instruction: "", provider: "gemini_api_key", model_name: "gemini-2.5-flash" },
    error: null,
  });
}

// Emula o ramo isTest de whatsapp-bot-reply/index.ts usando o motor real.
function installServerEmulation() {
  mocks.invoke.mockImplementation(async (_name: string, { body }: { body: Record<string, unknown> }) => {
    if (!wantsFlowSimulation(body.simState)) return { data: { ok: true, reply: "RESPOSTA DA IA (servidor legado)" }, error: null };
    const turn = simulateFlowTurn(body.flowData as never, body.simState, String(body.messageText));
    if (turn.kind === "respond") return { data: { ok: true, reply: turn.reply, simulation: turn.simulation }, error: null };
    return { data: { ok: true, reply: "RESPOSTA DA IA", simulation: turn.simulation }, error: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  installServerEmulation();
});

async function mountWith(flow: unknown[]) {
  loadFlow(flow);
  render(<WhatsAppBotConfig workspaceId="ws-1" />);
  await screen.findByRole("log", { name: "Conversa simulada" });
}

const chat = () => screen.getByRole("log", { name: "Conversa simulada" });
const stateBar = () => screen.getByRole("status", { name: "Estado da simulação" });

async function say(text: string) {
  fireEvent.change(screen.getByPlaceholderText("Envie uma mensagem de teste..."), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem de teste" }));
  // espera a resposta (o input é destravado quando a simulação termina)
  await waitFor(() => expect(screen.getByPlaceholderText("Envie uma mensagem de teste...")).toBeEnabled());
}

const lastInvokeBody = () => mocks.invoke.mock.calls[mocks.invoke.mock.calls.length - 1][1].body as Record<string, unknown>;

describe("Simulador do fluxo (UI) — menu: opção válida avança (U3)", () => {
  it("1ª mensagem apresenta o menu; resposta numérica válida avança pro próximo nó; o estado legível acompanha", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    expect(stateBar()).toHaveTextContent("Fora do menu");

    await say("oi");
    expect(within(chat()).getByText(/Escolha uma opção:/)).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("No menu “Menu principal” — respostas inválidas: 0 de 3");

    await say("1");
    expect(within(chat()).getByText(/Financeiro:/)).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("No menu “Menu financeiro” — respostas inválidas: 0 de 3");

    // ida e volta: a chamada de "1" carregou o estado que o server devolveu pra "oi"…
    expect(lastInvokeBody().simState).toEqual({ botFlowState: { currentNodeId: "menu-1", attempts: 0 }, handedOver: false });
    // …e a PRÓXIMA chamada carrega o que o server devolveu pra "1" (já no menu financeiro).
    await say("1");
    expect(lastInvokeBody().simState).toEqual({ botFlowState: { currentNodeId: "menu-fin", attempts: 0 }, handedOver: false });
  });

  it("opção que leva a um nó de IA sai do menu e segue pra IA (estado volta a 'fora do menu')", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");
    await say("1"); // -> menu financeiro
    await say("1"); // -> node-ai

    expect(within(chat()).getByText("RESPOSTA DA IA")).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("Fora do menu");
  });

  it("resposta inválida reprompta e o contador sobe no painel", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");
    await say("abc");

    expect(within(chat()).getByText(/Resposta inválida/)).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("respostas inválidas: 1 de 3");
  });
});

describe("Simulador do fluxo (UI) — handover vem do server (U2) e robô em silêncio (U4)", () => {
  it("inválida ×N (maxTentativas) -> entrega a humano: a bolha é a cortesia (sem IA), com selo e estado", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");
    await say("abc");
    await say("abc");
    await say("abc"); // 3ª inválida = maxTentativas -> entrega

    expect(within(chat()).getByText(/Encaminhando o seu contato para o atendimento humano/)).toBeInTheDocument();
    expect(within(chat()).getByText("Entregue a atendimento humano · tentativas esgotadas")).toBeInTheDocument();
    expect(within(chat()).queryByText("RESPOSTA DA IA")).not.toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("Entregue a atendimento humano — o robô está em silêncio");
  });

  it("depois da entrega: reply null vira 'robô em silêncio', NUNCA 'Resposta da IA vazia' nem erro vermelho", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");
    await say("2"); // opção -> nó handover
    await say("alguém aí?");

    expect(within(chat()).getByText(/Robô em silêncio/)).toBeInTheDocument();
    expect(within(chat()).queryByText(/Resposta da IA vazia/)).not.toBeInTheDocument();
    expect(within(chat()).queryByText(/Falha no fluxo/)).not.toBeInTheDocument();
    expect(lastInvokeBody().simState).toEqual({ botFlowState: null, handedOver: true });
  });

  it("U2 — palavra 'atendente' com fluxo linear: o handover REAL substitui a IA e NÃO sobra o texto fabricado '[Simulação de Transbordo]'", async () => {
    await mountWith([trigger(), aiNode, handoverNode]);
    await say("quero falar com um atendente");

    expect(within(chat()).getByText(/Encaminhando o seu contato para o atendimento humano/)).toBeInTheDocument();
    expect(within(chat()).getByText("Entregue a atendimento humano · palavra-chave")).toBeInTheDocument();
    expect(within(chat()).queryByText("RESPOSTA DA IA")).not.toBeInTheDocument();
    expect(within(chat()).queryByText(/Simulação de Transbordo/)).not.toBeInTheDocument();
  });

  it("U2 — server LEGADO (ignora simState): só a resposta da IA; nenhum handover é fabricado no navegador", async () => {
    mocks.invoke.mockResolvedValue({ data: { ok: true, reply: "RESPOSTA DA IA (servidor legado)" }, error: null });
    await mountWith([trigger(), aiNode, handoverNode]);
    await say("quero falar com um atendente");

    expect(within(chat()).getByText("RESPOSTA DA IA (servidor legado)")).toBeInTheDocument();
    expect(within(chat()).queryByText(/Simulação de Transbordo/)).not.toBeInTheDocument();
    expect(within(chat()).queryByText(/Entregue a atendimento humano/)).not.toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("Fora do menu");
  });
});

describe("Simulador do fluxo (UI) — fluxo SÓ-MENU, sem nó de IA (U1)", () => {
  it("simula normalmente: a UI chama o server (sem 'return' silencioso) e o menu aparece", async () => {
    await mountWith([trigger(), menuPrincipal, handoverNode]);
    await say("oi");

    expect(mocks.invoke).toHaveBeenCalledTimes(1);
    expect(within(chat()).getByText(/Escolha uma opção:/)).toBeInTheDocument();
    // sem nó ai: nenhum campo de provider/credencial no corpo
    expect(lastInvokeBody()).not.toHaveProperty("provider");
    expect(lastInvokeBody()).not.toHaveProperty("geminiApiKey");
    expect(stateBar()).toHaveTextContent("No menu “Menu principal”");
  });

  it("só-menu: opção que leva ao nó Transbordo entrega a humano, sem nunca precisar de IA", async () => {
    await mountWith([trigger(), menuPrincipal, handoverNode]);
    await say("oi");
    await say("2");

    expect(within(chat()).getByText("Entregue a atendimento humano · opção do menu")).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("Entregue a atendimento humano");
  });

  it("fluxo com nós mas SEM nó de IA habilitado e fora do menu: aviso 'nada a responder' (espelha produção), não erro", async () => {
    // O menu leva a um nó que não é menu nem handover (node-ai desabilitado) e não há IA habilitada.
    const menuSemIa = {
      ...menuPrincipal,
      properties: { ...menuPrincipal.properties, opcoes: [{ numero: 1, rotulo: "IA", nextNodeId: "node-ai" }] },
    };
    await mountWith([trigger(), menuSemIa, { ...aiNode, enabled: false }, handoverNode]);
    await say("oi");
    await say("1");

    expect(within(chat()).getByText(/nada a responder/)).toBeInTheDocument();
    expect(within(chat()).queryByText(/Falha no fluxo/)).not.toBeInTheDocument();
  });
});

describe("Simulador do fluxo (UI) — reiniciar simulação (U3)", () => {
  it("depois de entregue, 'Reiniciar simulação' limpa o chat e devolve o robô: próxima mensagem volta a apresentar o menu", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");
    await say("2");
    expect(stateBar()).toHaveTextContent("Entregue a atendimento humano");

    fireEvent.click(screen.getByRole("button", { name: /Reiniciar simulação/ }));

    expect(within(chat()).queryByText(/Encaminhando o seu contato/)).not.toBeInTheDocument();
    expect(within(chat()).getByText("Simulador reiniciado! Digite algo para rodar o fluxo.")).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("Fora do menu");

    await say("oi");
    expect(lastInvokeBody().simState).toEqual({ botFlowState: null, handedOver: false });
    expect(within(chat()).getByText(/Escolha uma opção:/)).toBeInTheDocument();
  });

  it("reiniciar no meio de um menu volta a 'fora do menu' (estado zerado)", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");
    await say("abc");
    expect(stateBar()).toHaveTextContent("respostas inválidas: 1 de 3");

    fireEvent.click(screen.getByRole("button", { name: /Reiniciar simulação/ }));

    expect(stateBar()).toHaveTextContent("Fora do menu");
  });
});

describe("Simulador do fluxo (UI) — entrada pela aresta do R6 e erros", () => {
  it("trigger.nextNodeId aponta o menu de entrada: a 1ª mensagem abre ESSE menu (paridade UI → server)", async () => {
    await mountWith([trigger({ nextNodeId: "menu-fin" }), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    await say("oi");

    expect(within(chat()).getByText(/Financeiro:/)).toBeInTheDocument();
    expect(stateBar()).toHaveTextContent("No menu “Menu financeiro”");
  });

  it("erro do server aparece como aviso do simulador e NÃO entra no histórico das próximas chamadas", async () => {
    await mountWith([trigger(), menuPrincipal, menuFinanceiro, aiNode, handoverNode]);
    mocks.invoke.mockRejectedValueOnce(new Error("boom"));
    await say("oi");

    expect(within(chat()).getByText(/Falha no fluxo: boom/)).toBeInTheDocument();

    installServerEmulation();
    await say("oi de novo");
    const history = lastInvokeBody().history as Array<{ role: string; text: string }>;
    expect(history.every((m) => !m.text.includes("Falha no fluxo"))).toBe(true);
  });
});
