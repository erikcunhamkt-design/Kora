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
import {
  END_HANDOVER_BOT_STILL_MUTED_TITLE,
  END_HANDOVER_UNASSIGNED_DESCRIPTION,
  endHandoverBotStillMutedDescription,
} from "@/lib/whatsapp/handover";
import {
  ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION,
  ASSIGN_ORIGIN_NOT_RECORDED_TITLE,
} from "@/lib/whatsapp/assignment";

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
// O stub expõe as props recebidas — é o que prova a fiação página -> painel (`handoverAt`, e do
// G101: `canAssign`, `attendants`, `assignedTo`, `assignmentOrigin`) — e dois botões que
// disparam `onAssign` (o painel real é testado em WhatsAppContactPanel.assignment.test.tsx).
vi.mock("@/components/whatsapp/WhatsAppContactPanel", () => ({
  WhatsAppContactPanel: (props: {
    handoverAt?: string | null;
    canAssign?: boolean;
    assignedTo?: string | null;
    assignmentOrigin?: string | null;
    attendants?: Array<{ name: string }>;
    onAssign?: (userId: string | null) => void;
  }) => (
    <div
      data-testid="contact-panel-stub"
      data-handover-at={props.handoverAt ?? ""}
      data-can-assign={String(!!props.canAssign)}
      data-assigned-to={props.assignedTo ?? ""}
      data-origin={props.assignmentOrigin ?? ""}
      data-attendants={(props.attendants ?? []).map((a) => a.name).join("|")}
    >
      STUB: ContactPanel
      <button onClick={() => props.onAssign?.("u-ana")}>stub-atribuir-ana</button>
      <button onClick={() => props.onAssign?.(null)}>stub-remover</button>
    </div>
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

// Várias ações de uma vez (G101): cada chave é uma `action`; as demais resolvem vazio.
function mockActions(handlers: Record<string, unknown>) {
  invoke.mockImplementation(((_name: string, options: { body: InvokeBody }) => {
    const action = options.body.action ?? "";
    return action in handlers ? handlers[action] : Promise.resolve({ data: null, error: null });
  }) as never);
}

function callsOf(action: string) {
  return invoke.mock.calls.filter(([, options]) => (options as { body: InvokeBody }).body.action === action);
}

const TEAM_RESPONSE = {
  data: {
    ok: true,
    attendants: [
      { id: "u-ana", name: "Ana Lima", role: "member" },
      { id: "u-caio", name: "Caio Reis", role: "viewer" },
    ],
  },
  error: null,
};

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

    it("a lista mostra 'Aguardando humano' na conversa entregue e SEM atendente (e só nela)", () => {
      mockConversations(
        [
          makeConversation({ id: "conv-1", handover_at: "2026-10-02T12:00:00.000Z" }),
          makeConversation({ id: "conv-2", contact_name: "João Outro", handover_at: null }),
        ],
        null,
      );
      renderPage();

      expect(screen.getAllByText("Aguardando humano")).toHaveLength(1);
      expect(screen.queryByText("Humano")).not.toBeInTheDocument();
    });

    it("entregue e COM atendente atribuído: badge calmo 'Humano' (não 'Aguardando humano')", () => {
      mockConversations(
        [makeConversation({ id: "conv-1", handover_at: "2026-10-02T12:00:00.000Z", assigned_to: "user-9" })],
        null,
      );
      renderPage();

      expect(screen.getAllByText("Humano")).toHaveLength(1);
      expect(screen.queryByText("Aguardando humano")).not.toBeInTheDocument();
    });

    it("DEGRADAÇÃO — linha SEM a coluna handover_at (migration pendente): nem banner nem badge, a página renderiza normal", () => {
      mockConversations([makeConversation()], "conv-1"); // sem a chave handover_at
      renderPage();

      expect(screen.getByText("Inbox WhatsApp")).toBeInTheDocument();
      expect(screen.getAllByText("Maria Cliente").length).toBeGreaterThan(0);
      expect(screen.queryByText(/Entregue a atendimento humano/)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Devolver ao robô/ })).not.toBeInTheDocument();
      expect(screen.queryByText("Humano")).not.toBeInTheDocument();
      expect(screen.queryByText("Aguardando humano")).not.toBeInTheDocument();
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

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Conversa devolvida ao robô", {
          description: "O robô volta a responder a próxima mensagem do cliente.",
        }),
      );
      expect(toast.warning).not.toHaveBeenCalled();
      expect(endHandoverCalls()).toHaveLength(1);
      expect(endHandoverCalls()[0]).toEqual([
        "whatsapp-instance",
        { body: { action: "end_human_handover", workspaceId: "ws-1", conversationId: "conv-1" } },
      ]);
      expect(toast.error).not.toHaveBeenCalled();
    });

    // Os 3 desfechos que o servidor reporta (unassigned / botStillMuted).
    it("devolução que DESATRIBUIU a atribuição automática -> confirma 'robô de volta e conversa sem atribuição'", async () => {
      mockEndHandover(Promise.resolve({ data: { ok: true, cleared: {}, unassigned: true, botStillMuted: false }, error: null }));
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

      await waitFor(() =>
        expect(toast.success).toHaveBeenCalledWith("Conversa devolvida ao robô", {
          description: END_HANDOVER_UNASSIGNED_DESCRIPTION,
        }),
      );
      expect(END_HANDOVER_UNASSIGNED_DESCRIPTION).toMatch(/Robô de volta e conversa sem atribuição/);
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("segue atribuída (manual) com o gatilho em Triagem -> AVISO honesto COM O NOME do atendente, não o sucesso 'robô volta a responder'", async () => {
      mockConversations([makeConversation({ handover_at: "2026-10-02T12:00:00.000Z", assigned_to: "u-ana" })], "conv-1");
      mockActions({
        list_attendants: Promise.resolve(TEAM_RESPONSE),
        end_human_handover: Promise.resolve({ data: { ok: true, cleared: {}, unassigned: false, botStillMuted: true }, error: null }),
      });
      renderPage();
      await waitFor(() => expect(callsOf("list_attendants")).toHaveLength(1)); // a lista chega antes do clique
      await act(async () => {});

      fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

      await waitFor(() =>
        expect(toast.warning).toHaveBeenCalledWith(END_HANDOVER_BOT_STILL_MUTED_TITLE, {
          description: endHandoverBotStillMutedDescription("Ana Lima"),
        }),
      );
      // vocabulário real da tela, o nome no lugar do genérico, e nada de prometer que o robô voltou
      expect(vi.mocked(toast.warning).mock.calls[0][1]?.description).toContain("atribuída a Ana Lima");
      expect(vi.mocked(toast.warning).mock.calls[0][1]?.description).toContain("Apenas Conversas Novas (Triagem)");
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("dono fora da lista de atendentes (ou lista que não carregou): o aviso diz 'um atendente', sem inventar nome", async () => {
      mockConversations([makeConversation({ handover_at: "2026-10-02T12:00:00.000Z", assigned_to: "u-fantasma" })], "conv-1");
      mockActions({
        list_attendants: Promise.resolve({ data: null, error: new Error("403") }),
        end_human_handover: Promise.resolve({ data: { ok: true, cleared: {}, unassigned: false, botStillMuted: true }, error: null }),
      });
      renderPage();

      fireEvent.click(screen.getByRole("button", { name: /Devolver ao robô/ }));

      await waitFor(() =>
        expect(toast.warning).toHaveBeenCalledWith(END_HANDOVER_BOT_STILL_MUTED_TITLE, {
          description: endHandoverBotStillMutedDescription("um atendente"),
        }),
      );
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

// Acabamento de Atendimento: o painel de contato também mostra o estado.
describe("WhatsApp.tsx · estado 'entregue a humano' chega ao painel de contato", () => {
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

  it("conversa entregue: o painel de contato recebe handoverAt (lido por unknown, como no banner)", () => {
    mockConversations([makeConversation({ handover_at: "2026-10-02T12:00:00.000Z" })], "conv-1");
    renderPage();
    fireEvent.click(screen.getByTitle("Mostrar painel"));

    expect(screen.getByTestId("contact-panel-stub")).toHaveAttribute("data-handover-at", "2026-10-02T12:00:00.000Z");
  });

  it("DEGRADAÇÃO — linha SEM a coluna handover_at: o painel recebe nada (string vazia no stub), nada quebra", () => {
    mockConversations([makeConversation()], "conv-1");
    renderPage();
    fireEvent.click(screen.getByTitle("Mostrar painel"));

    expect(screen.getByTestId("contact-panel-stub")).toHaveAttribute("data-handover-at", "");
  });

  it("handover_at null (devolvida): o painel recebe nada", () => {
    mockConversations([makeConversation({ handover_at: null })], "conv-1");
    renderPage();
    fireEvent.click(screen.getByTitle("Mostrar painel"));

    expect(screen.getByTestId("contact-panel-stub")).toHaveAttribute("data-handover-at", "");
  });
});

// G101 — controle de atribuição: a página dá ao painel o gate de papel, a lista de atendentes
// (vinda do servidor) e o `onAssign`; e mostra o NOME de quem é o dono no banner.
describe("WhatsApp.tsx · G101 — atribuição pelo painel de contato", () => {
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

  const asRole = (role: string | null) =>
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: role ? { role } : null, loading: false, error: null,
    } as never);

  const openPanel = async () => {
    renderPage();
    fireEvent.click(screen.getByTitle("Mostrar painel"));
    await waitFor(() => expect(callsOf("list_attendants")).toHaveLength(1));
    return screen.getByTestId("contact-panel-stub");
  };

  describe("gate de papel e lista de atendentes", () => {
    it.each([["owner", "true"], ["admin", "true"], ["member", "false"], ["viewer", "false"], [null, "false"]])(
      "papel %s -> painel recebe canAssign=%s (o mesmo gate do Robô IA: useWorkspaceRole().isAdmin)",
      async (role, expected) => {
        asRole(role);
        mockConversations([makeConversation()], "conv-1");
        mockActions({ list_attendants: Promise.resolve(TEAM_RESPONSE) });

        const panel = await openPanel();

        expect(panel).toHaveAttribute("data-can-assign", expected);
      },
    );

    it("a lista vem do SERVIDOR (list_attendants, uma vez, com o workspace) e chega ao painel", async () => {
      mockConversations([makeConversation()], "conv-1");
      mockActions({ list_attendants: Promise.resolve(TEAM_RESPONSE) });

      const panel = await openPanel();

      expect(callsOf("list_attendants")[0]).toEqual([
        "whatsapp-instance",
        { body: { action: "list_attendants", workspaceId: "ws-1" } },
      ]);
      await waitFor(() => expect(panel).toHaveAttribute("data-attendants", "Ana Lima|Caio Reis"));
    });

    it("DEGRADAÇÃO — list_attendants falha: o painel recebe lista vazia e a página segue normal", async () => {
      mockConversations([makeConversation()], "conv-1");
      mockActions({ list_attendants: Promise.resolve({ data: null, error: new Error("403") }) });

      const panel = await openPanel();

      expect(panel).toHaveAttribute("data-attendants", "");
      expect(screen.getByText("Inbox WhatsApp")).toBeInTheDocument();
    });

    it("entrega ao painel o dono e a origem da conversa (origem lida por unknown)", async () => {
      mockConversations([makeConversation({ assigned_to: "u-ana", assignment_origin: "auto" })], "conv-1");
      mockActions({ list_attendants: Promise.resolve(TEAM_RESPONSE) });
      const panel = await openPanel();
      expect(panel).toHaveAttribute("data-assigned-to", "u-ana");
      expect(panel).toHaveAttribute("data-origin", "auto");
    });

    it("DEGRADAÇÃO — linha SEM assignment_origin (coluna inexistente): origem vazia, nada quebra", async () => {
      mockConversations([makeConversation({ assigned_to: "u-ana" })], "conv-1");
      mockActions({ list_attendants: Promise.resolve(TEAM_RESPONSE) });
      const panel = await openPanel();
      expect(panel).toHaveAttribute("data-origin", "");
    });
  });

  describe("atribuir e remover (assign_conversation)", () => {
    beforeEach(() => {
      mockConversations([makeConversation()], "conv-1");
    });

    it("atribuir: chama assign_conversation com o atendente e confirma com o NOME", async () => {
      mockActions({
        list_attendants: Promise.resolve(TEAM_RESPONSE),
        assign_conversation: Promise.resolve({ data: { ok: true, originRecorded: true }, error: null }),
      });
      await openPanel();
      await waitFor(() => expect(screen.getByTestId("contact-panel-stub")).toHaveAttribute("data-attendants", "Ana Lima|Caio Reis"));

      fireEvent.click(screen.getByText("stub-atribuir-ana"));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Conversa atribuída", { description: "Atribuída a Ana Lima." }));
      expect(callsOf("assign_conversation")[0]).toEqual([
        "whatsapp-instance",
        { body: { action: "assign_conversation", workspaceId: "ws-1", conversationId: "conv-1", userId: "u-ana" } },
      ]);
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("remover: assign_conversation com userId null e 'Atribuição removida'", async () => {
      mockActions({
        list_attendants: Promise.resolve(TEAM_RESPONSE),
        assign_conversation: Promise.resolve({ data: { ok: true, originRecorded: true }, error: null }),
      });
      await openPanel();

      fireEvent.click(screen.getByText("stub-remover"));

      await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Atribuição removida"));
      expect(callsOf("assign_conversation")[0][1]).toEqual({
        body: { action: "assign_conversation", workspaceId: "ws-1", conversationId: "conv-1", userId: null },
      });
    });

    it("DEGRADAÇÃO — coluna assignment_origin ausente (originRecorded:false): atribuiu, mas AVISA que 'Devolver ao robô' não vai desfazer", async () => {
      mockActions({
        list_attendants: Promise.resolve(TEAM_RESPONSE),
        assign_conversation: Promise.resolve({ data: { ok: true, originRecorded: false }, error: null }),
      });
      await openPanel();

      fireEvent.click(screen.getByText("stub-atribuir-ana"));

      await waitFor(() =>
        expect(toast.warning).toHaveBeenCalledWith(ASSIGN_ORIGIN_NOT_RECORDED_TITLE, {
          description: ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION,
        }),
      );
      expect(toast.success).not.toHaveBeenCalled(); // não confirma como se estivesse tudo registrado
    });

    it("erro do servidor (ex.: 400 atendente inelegível): mostra a mensagem REAL do corpo, não o genérico", async () => {
      const error = Object.assign(new Error("Edge Function returned a non-2xx status code"), {
        context: { json: async () => ({ error: "user is not an eligible attendant of this workspace" }) },
      });
      mockActions({
        list_attendants: Promise.resolve(TEAM_RESPONSE),
        assign_conversation: Promise.resolve({ data: null, error }),
      });
      await openPanel();

      fireEvent.click(screen.getByText("stub-atribuir-ana"));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Falha", { description: "user is not an eligible attendant of this workspace" }),
      );
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  describe("banner da conversa entregue mostra de quem ela é (G29: nome real)", () => {
    const HANDED = "2026-10-02T12:00:00.000Z";

    it("atribuída a alguém da lista: 'Atribuída a Ana Lima (automática)'", async () => {
      mockConversations([makeConversation({ handover_at: HANDED, assigned_to: "u-ana", assignment_origin: "auto" })], "conv-1");
      mockActions({ list_attendants: Promise.resolve(TEAM_RESPONSE) });
      renderPage();

      expect(await screen.findByText("Atribuída a Ana Lima (automática).")).toBeInTheDocument();
    });

    it("sem dono: 'Sem atendente atribuído'", () => {
      mockConversations([makeConversation({ handover_at: HANDED, assigned_to: null })], "conv-1");
      renderPage();

      expect(screen.getByText("Sem atendente atribuído.")).toBeInTheDocument();
    });

    it("dono que ninguém reconhece (lista vazia): 'Atribuída a um atendente', sem inventar nome nem origem", () => {
      mockConversations([makeConversation({ handover_at: HANDED, assigned_to: "u-fantasma" })], "conv-1");
      renderPage();

      expect(screen.getByText("Atribuída a um atendente.")).toBeInTheDocument();
    });

    it("conversa NÃO entregue: não há banner, logo nenhuma frase de atribuição", () => {
      mockConversations([makeConversation({ handover_at: null, assigned_to: "u-ana" })], "conv-1");
      renderPage();

      expect(screen.queryByText(/^Atribuída a/)).not.toBeInTheDocument();
      expect(screen.queryByText("Sem atendente atribuído.")).not.toBeInTheDocument();
    });
  });
});
