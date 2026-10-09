// Etapa 9 · item 3 — PARIDADE do simulador com a base de conhecimento, montagem
// real de WhatsAppBotConfig. O `functions.invoke` roda o motor REAL do simulador
// (simulateFlowTurn) e, no caminho de IA, o MESMO primitivo de produção que
// whatsapp-bot-reply usa (loadKnowledgeForPrompt) — o selo no painel é o que o
// servidor devolveria, sem lógica duplicada no front.
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { simulateFlowTurn, withKnowledgeInfo } from "../../../../supabase/functions/_shared/botFlowSimulation";
import { loadKnowledgeForPrompt, type KnowledgeDataAccess } from "../../../../supabase/functions/_shared/knowledgeLoader";

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
vi.mock("@/components/whatsapp/FlowCanvas", () => ({ FlowCanvas: () => <div data-testid="flow-canvas-stub" /> }));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";

const FLOW = [
  { id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true, properties: { respondAll: true } },
  {
    id: "node-ai", type: "ai", title: "Agente de IA", enabled: true,
    properties: {
      instruction: "Seja breve", model: "gemini-2.5-flash", provider: "gemini_api_key",
      geminiApiKey: "", gcpProjectId: "", gcpRegion: "us-central1", gcpServiceAccount: "", customModelName: "",
    },
  },
];

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const quote = (id: string) => ({
  id, status: "sent", archived: false, deleted_at: null, client_name: null, company: null,
  quote_items: [{ name: "Landing Page", unit_price: 4000 }, { name: "Social Media", unit_price: 1800 }],
});

function knowledgeAccess(consents: unknown[]): KnowledgeDataAccess {
  return {
    fetchConsents: () => ok(consents),
    fetchQuotesWithItems: () => ok([quote("1"), quote("2")]),
    fetchClients: () => ok([]),
    fetchCurrency: () => ok({ currency: "BRL" }),
  };
}

// Emula o ramo isTest de whatsapp-bot-reply/index.ts: motor do simulador + (no
// caminho de IA) primitivo de conhecimento + withKnowledgeInfo.
function installServer(consents: unknown[]) {
  mocks.invoke.mockImplementation(async (_name: string, { body }: { body: Record<string, unknown> }) => {
    const turn = simulateFlowTurn(body.flowData as never, body.simState, String(body.messageText));
    if (turn.kind === "respond") return { data: { ok: true, reply: turn.reply, simulation: turn.simulation }, error: null };
    const knowledge = await loadKnowledgeForPrompt(knowledgeAccess(consents));
    return { data: { ok: true, reply: "RESPOSTA DA IA", simulation: withKnowledgeInfo(turn.simulation, knowledge) }, error: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  mocks.maybeSingle.mockResolvedValue({
    data: { is_active: true, flow_data: FLOW, gemini_api_key: "", gcp_service_account: "" },
    error: null,
  });
});

async function sayHello() {
  render(<WhatsAppBotConfig workspaceId="ws-1" />);
  await screen.findByRole("log", { name: "Conversa simulada" });
  fireEvent.change(screen.getByPlaceholderText("Envie uma mensagem de teste..."), { target: { value: "oi" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem de teste" }));
  await waitFor(() => expect(screen.getByPlaceholderText("Envie uma mensagem de teste...")).toBeEnabled());
  return within(screen.getByRole("log", { name: "Conversa simulada" }));
}

describe("Simulador × base de conhecimento (selo)", () => {
  it("categoria A ativa: a resposta de IA mostra o selo de que o bloco entrou (itens já orçados, não 'catálogo')", async () => {
    installServer([{ category: "catalog", enabled: true, legal_basis_ack: false, revoked_at: null }]);
    const chat = await sayHello();

    expect(chat.getByText("RESPOSTA DA IA")).toBeInTheDocument();
    expect(chat.getByText("Base de conhecimento · 2 itens já orçados no contexto")).toBeInTheDocument();
  });

  it("nenhuma categoria ativa (default OFF): resposta de IA SEM selo — simulador idêntico a antes", async () => {
    installServer([]);
    const chat = await sayHello();

    expect(chat.getByText("RESPOSTA DA IA")).toBeInTheDocument();
    expect(chat.queryByText(/Base de conhecimento/)).not.toBeInTheDocument();
  });

  it("categoria revogada ou C sem atesto: mesma regra de produção — sem selo", async () => {
    installServer([
      { category: "catalog", enabled: true, legal_basis_ack: false, revoked_at: "2026-10-01T00:00:00Z" },
      { category: "crm", enabled: true, legal_basis_ack: false, revoked_at: null },
    ]);
    const chat = await sayHello();

    expect(chat.queryByText(/Base de conhecimento/)).not.toBeInTheDocument();
  });
});
