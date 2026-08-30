// Etapa 9 · item 4, rodada R2 — WhatsAppBotConfig.tsx buscava o node de
// trigger/ai/handover por POSIÇÃO no array (`nodes[0]`/`nodes[1]`/`nodes[3]`),
// assumindo a ordem fixa de hoje (trigger, ai, send, handover). O runtime
// (whatsapp-bot-reply/index.ts:422-424, _shared/botFlowTemplate.ts:14) já
// busca por tipo — só a UI ficou pra trás. Isso quebra no momento em que a
// árvore ganhar um nó novo (`menu`, item 4 R1) em posição arbitrária, ou
// simplesmente reordenar os 4 nós existentes. Fix: `nodes.find(isXNode)`
// em vez de índice fixo — sem mudança de comportamento na ordem padrão
// (provado pelas suítes G31/G71/role-gate já existentes, todas ainda
// verdes), só deixa de depender de posição.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const loadSelect = vi.fn(() => ({ eq }));
  const single = vi.fn().mockResolvedValue({ data: { id: "bot-1" }, error: null });
  const insertSelect = vi.fn(() => ({ single }));
  const insert = vi.fn((_payload: unknown) => ({ select: insertSelect }));
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn((_payload: unknown) => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select: loadSelect, insert, update }));
  const invoke = vi.fn().mockResolvedValue({ data: { reply: "resposta simulada" }, error: null });
  return { maybeSingle, eq, loadSelect, single, insertSelect, insert, updateEq, update, from, invoke };
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

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

// jsdom não implementa scrollIntoView (usado no autoscroll do chat do
// simulador) — mesmo polyfill de outras suítes desta sessão.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

// flow_data com os MESMOS 4 nós do default, mas em ordem EMBARALHADA
// (handover, send, ai, trigger — o inverso da ordem que nodes[0..3] assume).
// Array válido — passa por Array.isArray(savedFlow), o caminho "novo formato"
// de loadSettings (:172), não o fallback legado.
const SCRAMBLED_FLOW = [
  { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: true, properties: { assignTo: "" } },
  { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
  {
    id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
    properties: {
      instruction: "instrucao embaralhada", model: "gemini-3.6-flash", provider: "gemini_api_key",
      geminiApiKey: "", gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
    },
  },
  { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
];

function mockScrambledLoad() {
  mocks.maybeSingle.mockResolvedValueOnce({
    data: {
      id: "bot-1", is_active: true, system_instruction: "instrucao embaralhada",
      provider: "gemini_api_key", model_name: "gemini-3.6-flash", gemini_api_key: "ROW-KEY",
      gcp_project_id: null, gcp_region: "us-central1", gcp_service_account: null,
      respond_all: true, flow_data: SCRAMBLED_FLOW,
    },
    error: null,
  });
}

describe("WhatsAppBotConfig · R2 — Salvar Fluxo encontra trigger/ai por tipo, não por posição", () => {
  it("nós em ordem embaralhada (handover, send, ai, trigger): Salvar Fluxo ainda funciona — não aborta em silêncio", async () => {
    mockScrambledLoad();
    render(<WhatsAppBotConfig workspaceId="ws-1" />);

    await screen.findByText("Agente IA (Gemini)");
    fireEvent.click(screen.getByText("Salvar Fluxo"));

    // Fixture carrega com id existente ("bot-1") -> caminho de UPDATE. Com
    // nodes[0]/nodes[1] (código antigo), nodes[0] seria "handover" (não
    // "trigger") e o guard `triggerNode.type !== "trigger"` abortava o save
    // inteiro em silêncio — nenhuma chamada a insert/update, nenhum erro
    // visível. A prova central desta rodada: o save precisa acontecer.
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));

    const payload = mocks.update.mock.calls[0][0] as {
      respond_all: boolean;
      system_instruction: string;
    };
    // Confirma que os dados salvos vieram do node CERTO (trigger/ai reais),
    // não de qualquer coisa que calhasse estar na posição 0/1.
    expect(payload.respond_all).toBe(true);
    expect(payload.system_instruction).toBe("instrucao embaralhada");
  });
});

describe("WhatsAppBotConfig · R2 — Simular mensagem encontra ai/handover por tipo, não por posição", () => {
  it("nós em ordem embaralhada: simular mensagem chama a edge function com os dados do node 'ai' real", async () => {
    mockScrambledLoad();
    render(<WhatsAppBotConfig workspaceId="ws-1" />);

    await screen.findByText("Agente IA (Gemini)");

    const simInput = screen.getByPlaceholderText("Envie uma mensagem de teste...");
    fireEvent.change(simInput, { target: { value: "oi" } });
    fireEvent.submit(simInput.closest("form")!);

    // Com nodes[1] (código antigo), nodes[1] seria "send" (não "ai") — o
    // guard `aiNode.type !== "ai"` retornava sem chamar a edge function.
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));

    const body = mocks.invoke.mock.calls[0][1] as { body: { systemInstruction: string } };
    expect(body.body.systemInstruction).toBe("instrucao embaralhada");
  });

  it("nós em ordem embaralhada, mensagem com 'atendente': simulação de transbordo dispara mesmo com handover fora da posição 3", async () => {
    mockScrambledLoad();
    render(<WhatsAppBotConfig workspaceId="ws-1" />);

    await screen.findByText("Agente IA (Gemini)");

    const simInput = screen.getByPlaceholderText("Envie uma mensagem de teste...");
    fireEvent.change(simInput, { target: { value: "quero falar com atendente" } });
    fireEvent.submit(simInput.closest("form")!);

    // Com nodes[3] (código antigo), nodes[3] seria "trigger" (não
    // "handover") — .enabled existe em todo node (WorkflowNodeBase), então
    // não quebraria, mas leria o campo do node ERRADO. Aqui o handover está
    // na posição 0 e habilitado — a simulação de transbordo precisa disparar.
    await waitFor(() => expect(
      screen.getByText(/Simulação de Transbordo/),
    ).toBeInTheDocument());
  });
});

describe("WhatsAppBotConfig · R2 — regressão do caminho legado (flow_data ausente)", () => {
  it("sem flow_data salvo (linha legada, só colunas): trigger/ai continuam sendo encontrados e atualizados", async () => {
    mocks.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "bot-1", is_active: true, system_instruction: "instrucao legada",
        provider: "gemini_api_key", model_name: "gemini-3.6-flash", gemini_api_key: "LEGACY-KEY",
        gcp_project_id: null, gcp_region: "us-central1", gcp_service_account: null,
        respond_all: false, flow_data: null,
      },
      error: null,
    });

    render(<WhatsAppBotConfig workspaceId="ws-3" />);

    // Node "ai" reidratado a partir das colunas legadas (não de flow_data,
    // que é null aqui) — prova que updated.find(isAiNode) continua achando
    // e preenchendo o node certo no caminho de conversão legado.
    fireEvent.click(await screen.findByText("Agente IA (Gemini)"));
    const instructionArea = (await screen.findByPlaceholderText(
      /Você é a Sofia/,
    )) as HTMLTextAreaElement;
    expect(instructionArea.value).toBe("instrucao legada");
  });
});
