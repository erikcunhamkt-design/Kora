// UX2 (resgate de UI) — o early-return de WhatsApp.tsx bloqueava a página inteira
// (inclusive a aba "Robô IA") sempre que não havia instância WhatsApp conectada.
// WhatsAppBotConfig não depende de `instance`/`status` (o simulador chama
// whatsapp-bot-reply com isTest: true diretamente) — não tinha motivo pra ficar
// atrás desse gate. Fix: o gate de conexão desceu pra dentro de cada aba
// individualmente, exceto "bot". Estes testes provam, por montagem real (não só
// leitura de código), que: (1) a aba Robô IA renderiza SEM instância conectada;
// (2) as outras 4 abas mostram o empty state SEM instância; (3) o conteúdo real
// ainda aparece COM instância conectada — nenhuma das duas pontas quebrou.
//
// clickTab() dispara a sequência completa pointerdown/mousedown/pointerup/mouseup/
// click — um `fireEvent.click` isolado não é suficiente pra ativar o TabsTrigger
// do Radix nesta versão (confirmado por depuração: o clique "funcionava" nos
// testes desconectados só porque a aba "chat" (default) já mostra o mesmo empty
// state que as outras abas gateadas — um clique que não fizesse nada passaria
// pela asserção do mesmo jeito). Cada teste confirma explicitamente, via
// aria-selected, que a aba certa ficou ativa — não só que "algum" texto apareceu.
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import WhatsAppPage from "@/pages/WhatsApp";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useWhatsAppInstance");
vi.mock("@/hooks/useWhatsAppConversations");
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  },
}));

// Não são o alvo destes testes — stubs simples e identificáveis evitam mockar toda
// a árvore de cada aba (cada uma já tem cobertura própria, quando existe).
vi.mock("@/components/whatsapp/WhatsAppBotConfig", () => ({
  WhatsAppBotConfig: () => <div>STUB: WhatsAppBotConfig montado</div>,
}));
vi.mock("@/components/whatsapp/audiences/AudiencesBackendPage", () => ({
  AudiencesBackendPage: () => <div>STUB: AudiencesBackendPage montado</div>,
}));
vi.mock("@/components/whatsapp/templates/TemplatesBackendPage", () => ({
  TemplatesBackendPage: () => <div>STUB: TemplatesBackendPage montado</div>,
}));
vi.mock("@/components/whatsapp/campaigns/CampaignsBackendPage", () => ({
  CampaignsBackendPage: () => <div>STUB: CampaignsBackendPage montado</div>,
}));

// jsdom não implementa PointerEvent/hasPointerCapture/scrollIntoView — os
// componentes Radix da aba Chat (conectada) chamam esses métodos em efeitos
// de montagem/interação. Mesmo polyfill já usado em QuotesSection.test.tsx.
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

const emptyConversations = {
  conversations: [], messages: [], selectedId: null,
  setSelectedId: vi.fn(), loading: false, markRead: vi.fn(),
};

function mockDisconnected() {
  vi.mocked(useWhatsAppInstance).mockReturnValue({ instance: null, loading: false } as never);
}

function mockConnected() {
  vi.mocked(useWhatsAppInstance).mockReturnValue({
    instance: {
      id: "inst-1", workspace_id: "ws-1", status: "connected",
      phone: "5511999999999", phone_name: "Linha QA", qr_code: null,
      connected_at: "2024-01-01T00:00:00Z", last_status_at: "2024-01-01T00:00:00Z",
      created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
    },
    loading: false,
  } as never);
}

function renderWhatsAppPage() {
  return render(
    <MemoryRouter initialEntries={["/whatsapp"]}>
      <WhatsAppPage />
    </MemoryRouter>,
  );
}

function clickTab(name: RegExp) {
  const trigger = screen.getByRole("tab", { name });
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.mouseDown(trigger, { button: 0 });
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, pointerType: "mouse" });
  fireEvent.mouseUp(trigger, { button: 0 });
  fireEvent.click(trigger);
  expect(trigger).toHaveAttribute("aria-selected", "true");
  return trigger;
}

describe("WhatsApp.tsx · UX2 — gate de conexão por aba (Robô IA sempre acessível)", () => {
  beforeEach(() => {
    Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
    Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    } as never);
    vi.mocked(useWhatsAppConversations).mockReturnValue(emptyConversations as never);
  });

  it("SEM instância conectada: aba Chat (default) mostra o empty state, não o Inbox", () => {
    mockDisconnected();
    renderWhatsAppPage();

    expect(screen.getByText("WhatsApp não conectado")).toBeInTheDocument();
    expect(screen.queryByText("Inbox WhatsApp")).not.toBeInTheDocument();
  });

  it("SEM instância conectada: aba Robô IA renderiza WhatsAppBotConfig normalmente", () => {
    mockDisconnected();
    renderWhatsAppPage();

    clickTab(/Robô IA/i);

    expect(screen.getByText("STUB: WhatsAppBotConfig montado")).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp não conectado")).not.toBeInTheDocument();
  });

  it("SEM instância conectada: aba Campanhas mostra o empty state, não CampaignsBackendPage", () => {
    mockDisconnected();
    renderWhatsAppPage();

    clickTab(/Campanhas/i);

    expect(screen.getByText("WhatsApp não conectado")).toBeInTheDocument();
    expect(screen.queryByText("STUB: CampaignsBackendPage montado")).not.toBeInTheDocument();
  });

  it("SEM instância conectada: aba Audiências mostra o empty state, não AudiencesBackendPage", () => {
    mockDisconnected();
    renderWhatsAppPage();

    clickTab(/Audiências/i);

    expect(screen.getByText("WhatsApp não conectado")).toBeInTheDocument();
    expect(screen.queryByText("STUB: AudiencesBackendPage montado")).not.toBeInTheDocument();
  });

  it("SEM instância conectada: aba Modelos de Mensagem mostra o empty state, não TemplatesBackendPage", () => {
    mockDisconnected();
    renderWhatsAppPage();

    clickTab(/Modelos de Mensagem/i);

    expect(screen.getByText("WhatsApp não conectado")).toBeInTheDocument();
    expect(screen.queryByText("STUB: TemplatesBackendPage montado")).not.toBeInTheDocument();
  });

  it("COM instância conectada: aba Chat mostra o Inbox real (sidebar via showSidebar), não o empty state", () => {
    mockConnected();
    renderWhatsAppPage();

    expect(screen.getByText("Inbox WhatsApp")).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp não conectado")).not.toBeInTheDocument();
  });

  it("COM instância conectada: aba Campanhas mostra CampaignsBackendPage, não o empty state", () => {
    mockConnected();
    renderWhatsAppPage();

    clickTab(/Campanhas/i);

    expect(screen.getByText("STUB: CampaignsBackendPage montado")).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp não conectado")).not.toBeInTheDocument();
  });

  it("COM instância conectada: aba Audiências mostra AudiencesBackendPage, não o empty state", () => {
    mockConnected();
    renderWhatsAppPage();

    clickTab(/Audiências/i);

    expect(screen.getByText("STUB: AudiencesBackendPage montado")).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp não conectado")).not.toBeInTheDocument();
  });

  it("COM instância conectada: aba Modelos de Mensagem mostra TemplatesBackendPage, não o empty state", () => {
    mockConnected();
    renderWhatsAppPage();

    clickTab(/Modelos de Mensagem/i);

    expect(screen.getByText("STUB: TemplatesBackendPage montado")).toBeInTheDocument();
    expect(screen.queryByText("WhatsApp não conectado")).not.toBeInTheDocument();
  });

  it("COM instância conectada: aba Robô IA continua acessível normalmente", () => {
    mockConnected();
    renderWhatsAppPage();

    clickTab(/Robô IA/i);

    expect(screen.getByText("STUB: WhatsAppBotConfig montado")).toBeInTheDocument();
  });
});
