// Etapa 9 · Item 4 (G103, fatias 1+2) — a página do WhatsApp respeita o papel como o servidor: o `viewer` é
// somente leitura (composer, ações da mensagem, arquivar/marcar não lida, tags) e a página NÃO dispara, em nome de
// quem não pode, as chamadas automáticas que dariam 403 (`sync`, `refresh_avatars`, `set_webhook`).
// Os filhos pesados são stubs que expõem a prop recebida (a montagem real dos filhos é testada nos testes deles).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import WhatsAppPage from "@/pages/WhatsApp";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { supabase } from "@/integrations/supabase/client";

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

vi.mock("@/components/whatsapp/WhatsAppBotConfig", () => ({ WhatsAppBotConfig: () => <div>STUB: WhatsAppBotConfig</div> }));
vi.mock("@/components/whatsapp/audiences/AudiencesBackendPage", () => ({ AudiencesBackendPage: () => <div>STUB</div> }));
vi.mock("@/components/whatsapp/templates/TemplatesBackendPage", () => ({ TemplatesBackendPage: () => <div>STUB</div> }));
vi.mock("@/components/whatsapp/campaigns/CampaignsBackendPage", () => ({ CampaignsBackendPage: () => <div>STUB</div> }));
vi.mock("@/components/whatsapp/WhatsAppChatInput", () => ({
  WhatsAppChatInput: (props: { readOnly?: boolean }) => <div data-testid="chat-input" data-readonly={String(!!props.readOnly)} />,
}));
vi.mock("@/components/whatsapp/WhatsAppMessageBubble", () => ({
  WhatsAppMessageBubble: (props: { id: string; readOnly?: boolean }) => (
    <div data-testid={`bubble-${props.id}`} data-readonly={String(!!props.readOnly)} />
  ),
}));
vi.mock("@/components/whatsapp/WhatsAppContactPanel", () => ({
  WhatsAppContactPanel: (props: { canEditTags?: boolean; canAssign?: boolean }) => (
    <div data-testid="contact-panel" data-can-edit-tags={String(props.canEditTags)} data-can-assign={String(props.canAssign)} />
  ),
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

const conversation = {
  id: "conv-1", workspace_id: "ws-1", instance_id: "inst-1",
  contact_name: "Maria Cliente", contact_phone: "5511999990000", avatar_url: null,
  last_message: "oi", last_message_at: "2026-10-02T12:00:00.000Z",
  unread_count: 0, status: "open", assigned_to: null, tags: [],
  created_at: "2026-10-01T10:00:00.000Z", updated_at: "2026-10-02T12:00:00.000Z",
};

const message = {
  id: "m-1", conversation_id: "conv-1", workspace_id: "ws-1", direction: "inbound", type: "text", content: "oi",
  created_at: "2026-10-02T12:00:00.000Z", status: "received", sender_id: null, media_url: null, reactions: null,
  pinned_at: null, deleted_at: null, reply_to_message_id: null,
};

function setup(role: string | null, opts: { conversations?: unknown[]; selectedId?: string | null; messages?: unknown[] } = {}) {
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: mockWorkspace, membership: role ? { role } : null, loading: false, error: null,
  } as never);
  vi.mocked(useWhatsAppInstance).mockReturnValue({
    instance: {
      id: "inst-1", workspace_id: "ws-1", status: "connected", phone: "5511999999999", phone_name: "Linha QA",
      qr_code: null, connected_at: "2024-01-01T00:00:00Z", last_status_at: "2024-01-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
    },
    loading: false,
  } as never);
  vi.mocked(useWhatsAppConversations).mockReturnValue({
    conversations: opts.conversations ?? [conversation],
    messages: opts.messages ?? [],
    selectedId: opts.selectedId === undefined ? "conv-1" : opts.selectedId,
    setSelectedId: vi.fn(), loading: false, markRead: vi.fn(),
  } as never);
}

const invoke = vi.mocked(supabase.functions.invoke);
const actionsCalled = () => invoke.mock.calls.map(([, o]) => (o as { body: { action?: string } }).body.action);

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/whatsapp"]}>
      <WhatsAppPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
  // mensagem recebida toca o som de notificação; jsdom não implementa `play()` (devolveria undefined)
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  vi.clearAllMocks();
  invoke.mockResolvedValue({ data: { ok: true, synced: 0, attendants: [] }, error: null } as never);
});

describe("WhatsApp.tsx · viewer = somente leitura (G103 fatia 2)", () => {
  it("viewer: composer e balões em readOnly; os demais papéis (e o papel desconhecido) escrevem", () => {
    for (const [role, readOnly] of [["viewer", "true"], ["member", "false"], ["admin", "false"], ["owner", "false"], [null, "false"]] as const) {
      setup(role, { messages: [message] });
      const { unmount } = renderPage();
      expect(screen.getByTestId("chat-input"), String(role)).toHaveAttribute("data-readonly", readOnly);
      expect(screen.getByTestId("bubble-m-1"), String(role)).toHaveAttribute("data-readonly", readOnly);
      unmount();
    }
  });

  it("viewer: o menu 'Mais opções' NÃO oferece Arquivar nem Marcar como não lida (mantém densidade e som)", async () => {
    setup("viewer");
    renderPage();

    fireEvent.pointerDown(screen.getByTitle("Mais opções"), { button: 0, pointerId: 1, isPrimary: true });

    expect(await screen.findByText("Densidade das mensagens")).toBeInTheDocument();
    expect(screen.getByText("Som de notificação")).toBeInTheDocument();
    expect(screen.queryByText("Arquivar conversa")).not.toBeInTheDocument();
    expect(screen.queryByText("Marcar como não lida")).not.toBeInTheDocument();
  });

  it("member: o menu oferece Arquivar e Marcar como não lida", async () => {
    setup("member");
    renderPage();

    fireEvent.pointerDown(screen.getByTitle("Mais opções"), { button: 0, pointerId: 1, isPrimary: true });

    expect(await screen.findByText("Arquivar conversa")).toBeInTheDocument();
    expect(screen.getByText("Marcar como não lida")).toBeInTheDocument();
  });

  it("painel de contato: viewer não edita tags (canEditTags=false) e não atribui; member edita tags mas não atribui; admin faz as duas", async () => {
    for (const [role, tags, assign] of [["viewer", "false", "false"], ["member", "true", "false"], ["admin", "true", "true"]] as const) {
      setup(role);
      const { unmount } = renderPage();
      fireEvent.click(screen.getByTitle("Mostrar painel"));
      const panel = await screen.findByTestId("contact-panel");
      expect(panel, role).toHaveAttribute("data-can-edit-tags", tags);
      expect(panel, role).toHaveAttribute("data-can-assign", assign);
      unmount();
    }
  });
});

describe("WhatsApp.tsx · chamadas automáticas só para quem pode (sem 403 de graça)", () => {
  it("lista vazia + conectada: `sync` automático NÃO sai para viewer; sai para member/admin/owner e papel desconhecido", async () => {
    for (const [role, syncs] of [["viewer", false], ["member", true], ["admin", true], ["owner", true], [null, true]] as const) {
      vi.clearAllMocks();
      invoke.mockResolvedValue({ data: { ok: true, synced: 0, attendants: [] }, error: null } as never);
      setup(role, { conversations: [], selectedId: null });
      const { unmount } = renderPage();
      await waitFor(() => expect(actionsCalled().includes("sync"), String(role)).toBe(syncs));
      if (!syncs) await new Promise((r) => setTimeout(r, 30)); // dá tempo de um disparo indevido aparecer
      expect(actionsCalled().includes("sync"), String(role)).toBe(syncs);
      unmount();
    }
  });

  it("`set_webhook` (administração da instância): só owner/admin dispara; member, viewer e papel desconhecido não", async () => {
    for (const [role, fires] of [["owner", true], ["admin", true], ["member", false], ["viewer", false], [null, false]] as const) {
      vi.clearAllMocks();
      invoke.mockResolvedValue({ data: { ok: true, attendants: [] }, error: null } as never);
      setup(role);
      const { unmount } = renderPage();
      await waitFor(() => expect(actionsCalled().includes("list_attendants"), String(role)).toBe(true)); // a página montou
      await new Promise((r) => setTimeout(r, 30));
      expect(actionsCalled().includes("set_webhook"), String(role)).toBe(fires);
      unmount();
    }
  });

  it("conversa sem avatar: `refresh_avatars` automático não sai para viewer; sai para member", async () => {
    for (const [role, fires] of [["viewer", false], ["member", true]] as const) {
      vi.clearAllMocks();
      invoke.mockResolvedValue({ data: { ok: true, attendants: [] }, error: null } as never);
      setup(role);
      const { unmount } = renderPage();
      await waitFor(() => expect(actionsCalled().includes("list_attendants"), role).toBe(true));
      await new Promise((r) => setTimeout(r, 30));
      expect(actionsCalled().includes("refresh_avatars"), role).toBe(fires);
      unmount();
    }
  });

  it("leitura segue para todo papel: list_attendants sai para o viewer também", async () => {
    setup("viewer");
    renderPage();

    await waitFor(() => expect(actionsCalled()).toContain("list_attendants"));
  });
});
