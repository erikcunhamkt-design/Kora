// G71 (adendo de backlog de UI) — 3ª tela do backlog: mesmo achado do
// WhatsAppBotConfig/VertexAIConnectionCard, mas aqui o precedente que o
// próprio G71 citou pro RLS admin-gated (whatsapp_official_credentials)
// nunca teve gate de papel na UI. 3 controles de escrita (salvar/atualizar,
// testar conexão, remover) viram admin-gated. Leitura intacta. Também prova
// a rede (c): erro amigável nos 3 catches.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  useWhatsAppOfficialMock: vi.fn(),
  useWorkspaceRoleMock: vi.fn(),
}));

vi.mock("@/hooks/useWhatsAppOfficial", () => ({ useWhatsAppOfficial: mocks.useWhatsAppOfficialMock }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: mocks.useWorkspaceRoleMock }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { OfficialWhatsAppCard } from "@/components/automacoes/OfficialWhatsAppCard";
import { toast } from "sonner";

const ADMIN_ONLY = "Apenas administradores do workspace podem alterar esta configuração.";

beforeEach(() => {
  vi.clearAllMocks();
});

const configuredCredentials = {
  id: "off-1",
  workspace_id: "ws-1",
  phone_number_id: "123",
  waba_id: "456",
  display_phone_number: "+55 11 90000-0000",
  verified_name: "Kora",
  verify_token: "tok-abc",
  status: "configured" as const,
  last_verified_at: null,
  has_app_secret: false,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
};

function baseHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    credentials: configuredCredentials,
    loading: false,
    busy: false,
    save: vi.fn().mockResolvedValue(configuredCredentials),
    verify: vi.fn().mockResolvedValue(configuredCredentials),
    remove: vi.fn().mockResolvedValue(undefined),
    setActive: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn(),
    ...overrides,
  };
}

describe("OfficialWhatsAppCard · G71 (adendo) — role-gate, credenciais já configuradas", () => {
  it("não-admin: Remover, Atualizar credenciais e Testar conexão desabilitados, com aviso explícito (title)", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "member", isAdmin: false, loading: false });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn());

    render(<OfficialWhatsAppCard />);

    const removeButton = await screen.findByRole("button", { name: /Remover/ });
    expect(removeButton).toBeDisabled();
    expect(removeButton).toHaveAttribute("title", ADMIN_ONLY);

    const updateButton = screen.getByRole("button", { name: /Atualizar credenciais/ });
    expect(updateButton).toBeDisabled();
    expect(updateButton).toHaveAttribute("title", ADMIN_ONLY);

    const verifyButton = screen.getByRole("button", { name: /Testar conexão/ });
    expect(verifyButton).toBeDisabled();
    expect(verifyButton).toHaveAttribute("title", ADMIN_ONLY);
  });

  it("admin: os 3 controles continuam habilitados, comportamento original preservado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn());

    render(<OfficialWhatsAppCard />);

    expect(await screen.findByRole("button", { name: /Remover/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Atualizar credenciais/ })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /Testar conexão/ })).not.toBeDisabled();
  });

  it("loading do papel: continua desabilitado, nunca pisca habilitado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: null, isAdmin: false, loading: true });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn());

    render(<OfficialWhatsAppCard />);

    expect(await screen.findByRole("button", { name: /Atualizar credenciais/ })).toBeDisabled();
  });
});

describe("OfficialWhatsAppCard · G71 (adendo) — role-gate, sem credenciais (1º cadastro)", () => {
  it("não-admin: Salvar credenciais desabilitado (Remover/Testar não existem ainda, credentials=null)", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "member", isAdmin: false, loading: false });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn({ credentials: null }));

    render(<OfficialWhatsAppCard />);

    const saveButton = await screen.findByRole("button", { name: /Salvar credenciais/ });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("title", ADMIN_ONLY);
    expect(screen.queryByRole("button", { name: /Remover/ })).not.toBeInTheDocument();
  });
});

describe("OfficialWhatsAppCard · G71 (adendo) — rede (c): erro vira mensagem amigável nos 3 catches", () => {
  it("erro 42501 (RLS) no save mostra a mensagem traduzida, não o texto técnico do Postgres", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });
    const save = vi.fn().mockRejectedValue({
      code: "42501",
      message: "new row violates row-level security policy for table \"whatsapp_official_credentials\"",
    });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn({ save }));

    render(<OfficialWhatsAppCard />);

    fireEvent.click(await screen.findByRole("button", { name: /Atualizar credenciais/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(title).toBe("Falha ao salvar");
    expect((opts as { description?: string })?.description).toBe(
      "Você não tem permissão para realizar esta ação.",
    );
  });

  it("erro 42501 (RLS) no verify mostra a mensagem traduzida", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });
    const verify = vi.fn().mockRejectedValue({ code: "42501", message: "raw pg error" });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn({ verify }));

    render(<OfficialWhatsAppCard />);

    fireEvent.click(await screen.findByRole("button", { name: /Testar conexão/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(title).toBe("Falha na verificação");
    expect((opts as { description?: string })?.description).toBe(
      "Você não tem permissão para realizar esta ação.",
    );
  });

  it("erro 42501 (RLS) no remove mostra a mensagem traduzida", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });
    const remove = vi.fn().mockRejectedValue({ code: "42501", message: "raw pg error" });
    mocks.useWhatsAppOfficialMock.mockReturnValue(baseHookReturn({ remove }));

    render(<OfficialWhatsAppCard />);

    fireEvent.click(await screen.findByRole("button", { name: /Remover/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Remover", exact: true }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(title).toBe("Falha ao remover");
    expect((opts as { description?: string })?.description).toBe(
      "Você não tem permissão para realizar esta ação.",
    );
  });
});
