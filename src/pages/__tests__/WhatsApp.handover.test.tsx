// Etapa 9 · Item 4, R4 (UI de Atendimento) — prova, por montagem real da página,
// o indicador "entregue a humano" + a ação "Devolver ao robô" + o tratamento
// honesto do 409 (coluna handover_at ainda não existe — migration §8-b) + a
// degradação (linha SEM a coluna: nada aparece, nada quebra).
// Contrato do server: docs/qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md §4.
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import WhatsAppPage from "@/pages/WhatsApp";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useWhatsAppInstance");
vi.mock("@/hooks/useWhatsAppConversations");
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

// Não são o alvo destes testes (mesmos stubs de WhatsApp.tab-gate.test.tsx).
vi.mock("@/components/whatsapp/WhatsAppBotConfig", () => ({
  WhatsAppBotConfig: () => <div>STUB: WhatsAppBotConfig</div>,
}));
vi.mock("@/components/whatsapp/audiences/AudiencesBackendPage", () => ({
  AudiencesBackendPage: () => <div>STUB: Audiences</div>,
}));
vi.mock("@/components/whatsapp/templates/TemplatesBackendPage", () => ({
  TemplatesBackendPage: () => <div>STUB: Templates</div>,
}));
vi.mock("@/components/whatsapp/campaigns/CampaignsBackendPage", () => ({
  CampaignsBackendPage: () => <div>STUB: Campaigns</div>,
}));
vi.mock("@/components/whatsapp/WhatsAppChatInput", () => ({
  WhatsAppChatInput: () => <div>STUB: ChatInput</div>,
}));
vi.mock("@/components/whatsapp/WhatsAppContactPanel", () => ({
  WhatsAppContactPanel: () => <div>STUB: ContactPanel</div>,
}));

if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfill de teste, jsdom não implementa PointerEvent.
  window.PointerEvent = PointerEventPolyfill;
}

const mockWorkspace = {
  id: "ws-1", name: "QA Workspace", slug: "qa-workspace", owner_id: "owner-1",
  created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  currency: "BRL", locale: "pt-BR", timezone: null,
};

function makeConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: "conv-1", workspace_id: "ws-1", instance_id: "inst-1",
    contact_name: "Maria Cliente", contact_phone: "5511999990000", avatar_url: null,
    last_message: "quero falar com atendente", last_message_at: "2026-10-02T12:00:00.000Z",
    unread_count: 0, status: "open", assigned_to: null, tags: [],
    created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z",
    ...overrides,
  };
}

function mockConversations(conversations: ReturnType<typeof makeConversation>[], selectedId: string | null) {
  vi.mocked(useWhatsAppConversations).mockReturnValue({
    conversations, messages: [], selectedId,
    setSelectedId: vi.fn(), loading: false, markRead: vi.fn(),
  } as never);
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/whatsapp"]}>
      <WhatsAppPage />
    </MemoryRouter>,
  );
}

const invoke = vi.mocked(supabase.functions.invoke);

type InvokeBody = { action?: string; workspaceId?: string; conversationId?: string };

// A página também chama functions.invoke por conta própria na montagem
// (set_webhook etc.) — o teste isola só a ação do handover. Chamadas de outras
// ações sempre resolvem sem erro; a do handover devolve o que o teste pedir.
function mockEndHandover(result: unknown | Promise<unknown>) {
  invoke.mockImplementation(((_name: string, options: { body: InvokeBody }) =>
    options.body.action === "end_human_handover" ? result : Promise.resolve({ data: null, error: null })) as never);
}

function endHandoverCalls() {
  return invoke.mock.calls.filter(([, options]) => (options as { body: InvokeBody }).body.action === "end_human_handover");
}

describe("WhatsApp.tsx · R4 — UI de Atendimento do handover", () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
    vi.clearAllMocks();
    invoke.mockResolvedValue({ data: null, error: null } as never);
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    } as never);
    vi.mocked(useWhatsAppInstance).mockReturnValue({
      instance: {
        id: "inst-1", workspace_id: "ws-1", status: "connected",
        phone: "5511999999999", phone_name: "Linha QA", qr_code: null,
        connected_at: "2024-01-01T00:00:00Z", last_status_at: "2024-01-01T00:00:00Z",
        created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
      },
      loading: false,
    } as never);
  });

  describe("indicador", () => {
    it("conversa selecionada COM handover_at -> banner 'Entregue a atendimento humano' + botão Devolver ao robô", () => {
      mockConversations([makeConversation({ handover_at: "2026-10-02T12:00:00.000Z" })], "conv-1");
      renderPage();

      expect(screen.getByText(/Entregue a atendimento humano/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Devolver ao robô/ })).toBeInTheDocument();
    });

    it("a lista de conversas mostra o badge 'Humano' na conversa entregue (e só nela)", () => {
      mockConversations(
        [
          makeConversation({ id: "conv-1", handover_at: "2026-10-02T12:00:00.000Z" }),
          makeConversation({ id: "conv-2", contact_name: "João Outro", handover_at: null }),
        ],
        null,
      );
      renderPage();

      expect(screen.getAllByText("Humano")).toHaveLength(1);
    });

    it("DEGRADAÇÃO — linha SEM a coluna handover_at (migration pendente): nem banner nem badge, a página renderiza normal", () => {
      mockConversations([makeConversation()], "conv-1"); // sem a chave handover_at
      renderPage();

      expect(screen.getByText("Inbox WhatsApp")).toBeInTheDocument();
      expect(screen.getAllByText("Maria Cliente").length).toBeGreaterThan(0);
      expect(screen.queryByText(/Entregue a atendimento humano/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Devolver ao robô/ })).not.toBeInTheDocument();
      expect(screen.queryByText("Humano")).not.toBeInTheDocument();
    });

    it("handover_at null (devolvida/nunca entregue) -> sem banner", () => {
      mockConversations([makeConversation({ handover_at: null })], "conv-1");
      renderPage();

      expect(screen.queryByText(/Entregue a atendimento humano/)).not.toBeInTheDocument();
    });
  });

  describe("ação 'Devolver ao robô'", () => {
    beforeEach(() => {
      mockConversations([makeConversation({ handover_at: "2026-10-02T12:00:00.000Z" })], "conv-1");
    });

    it("chama whatsapp-instance com end_human_handover (workspace + conversa) e confirma com toast de sucesso", async () => {
      mockEndHandover(Promise.resolve({ data: { ok: true }, error: null }));
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Conversa devolvida ao robô", expect.anything()));
      expect(endHandoverCalls()).toHaveLength(1);
      expect(endHandoverCalls()[0]).toEqual([
        "whatsapp-instance",
        { body: { action: "end_human_handover", workspaceId: "ws-1", conversationId: "conv-1" } },
      ]);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("409 (coluna ausente) -> mensagem HONESTA de migration pendente, não o toast genérico 'Falha'", async () => {
      const error409 = Object.assign(new Error("Edge Function returned a non-2xx status code"), { context: { status: 409 } });
      mockEndHandover(Promise.resolve({ data: null, error: error409 }));
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      const [title, opts] = vi.mocked(toast.error).mock.calls[0] as [string, { description: string }];
      expect(title).toBe("Migration pendente");
      expect(opts.description).toMatch(/migration/i);
      expect(opts.description).toMatch(/operador/i);
      expect(opts.description).not.toMatch(/non-2xx/);
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("outro erro (ex.: 500) -> toast de falha com a mensagem do erro (não o texto de migration)", async () => {
      const error500 = Object.assign(new Error("Edge Function returned a non-2xx status code"), { context: { status: 500 } });
      mockEndHandover(Promise.resolve({ data: null, error: error500 }));
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

      await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
      const [title, opts] = vi.mocked(toast.error).mock.calls[0] as [string, { description: string }];
      expect(title).toBe("Falha ao devolver ao robô");
      expect(opts.description).toBe("Edge Function returned a non-2xx status code");
    });

    it("enquanto a ação roda o botão fica desabilitado (sem duplo clique) e volta ao normal depois", async () => {
      let resolveInvoke: (v: unknown) => void = () => {};
      mockEndHandover(new Promise((res) => { resolveInvoke = res; }));
      renderPage();

      const btn = () => screen.getByRole("button", { name: /Devolver ao robô/ });
      fireEvent.click(btn());
      await waitFor(() => expect(btn()).toBeDisabled());

      fireEvent.click(btn()); // segundo clique ignorado
      expect(endHandoverCalls()).toHaveLength(1);

      await act(async () => { resolveInvoke({ data: { ok: true }, error: null }); });
      await waitFor(() => expect(btn()).toBeEnabled());
    });
  });
});
