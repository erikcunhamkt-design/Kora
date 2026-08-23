// G71 (adendo de backlog de UI) — 3 controles de escrita (ativar/desativar,
// remover, salvar e ativar) viram admin-gated na UI, espelhando o draft de
// RLS já proposto pra workspace_ai_credentials
// (docs/qa/g71-credenciais-terceiros-pacote-operador.md §3.1). Leitura
// intacta. Também prova a rede (c): erro 42501 vira mensagem amigável.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useVertexCredentialsMock: vi.fn(),
  useWorkspaceRoleMock: vi.fn(),
}));

vi.mock("@/hooks/useVertexCredentials", () => ({ useVertexCredentials: mocks.useVertexCredentialsMock }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: mocks.useWorkspaceRoleMock }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import { VertexAIConnectionCard } from "@/components/automacoes/VertexAIConnectionCard";
import { toast } from "sonner";

const ADMIN_ONLY = "Apenas administradores do workspace podem alterar esta configuração.";

const connectedStatus = {
  id: "cred-1",
  hasCredentials: true,
  isActive: true,
  location: "us-central1",
  defaultModel: "gemini-2.5-flash",
  projectId: "proj-1",
  clientEmail: "sa@proj-1.iam.gserviceaccount.com",
  updatedAt: "2026-08-01T00:00:00Z",
};

function baseHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    status: connectedStatus,
    loading: false,
    busy: false,
    save: vi.fn().mockResolvedValue(undefined),
    toggleActive: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("VertexAIConnectionCard · G71 (adendo) — role-gate (Switch/Remover), já conectado", () => {
  it("não-admin: Switch e Remover desabilitados, com aviso explícito (title)", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "member", isAdmin: false, loading: false });
    mocks.useVertexCredentialsMock.mockReturnValue(baseHookReturn());

    render(<VertexAIConnectionCard />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute("title", ADMIN_ONLY);

    const removeButton = screen.getByRole("button", { name: /Remover/ });
    expect(removeButton).toBeDisabled();
    expect(removeButton).toHaveAttribute("title", ADMIN_ONLY);
  });

  it("admin: Switch e Remover continuam habilitados, comportamento original preservado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });
    mocks.useVertexCredentialsMock.mockReturnValue(baseHookReturn());

    render(<VertexAIConnectionCard />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).not.toBeDisabled();
    const removeButton = screen.getByRole("button", { name: /Remover/ });
    expect(removeButton).not.toBeDisabled();
  });

  it("loading do papel: continua desabilitado, nunca pisca habilitado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: null, isAdmin: false, loading: true });
    mocks.useVertexCredentialsMock.mockReturnValue(baseHookReturn());

    render(<VertexAIConnectionCard />);

    const toggle = await screen.findByRole("switch");
    expect(toggle).toBeDisabled();
  });
});

describe("VertexAIConnectionCard · G71 (adendo) — role-gate (Salvar e ativar), formulário de conexão", () => {
  it("não-admin: botão Salvar e ativar desabilitado, com aviso explícito (title)", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "member", isAdmin: false, loading: false });
    mocks.useVertexCredentialsMock.mockReturnValue(
      baseHookReturn({ status: { ...connectedStatus, hasCredentials: false } }),
    );

    render(<VertexAIConnectionCard />);

    fireEvent.click(await screen.findByRole("button", { name: /Conectar Vertex AI/ }));

    const saveButton = screen.getByRole("button", { name: /Salvar e ativar/ });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("title", ADMIN_ONLY);
  });

  it("admin: botão Salvar e ativar continua habilitado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "admin", isAdmin: true, loading: false });
    mocks.useVertexCredentialsMock.mockReturnValue(
      baseHookReturn({ status: { ...connectedStatus, hasCredentials: false } }),
    );

    render(<VertexAIConnectionCard />);

    fireEvent.click(await screen.findByRole("button", { name: /Conectar Vertex AI/ }));

    const saveButton = screen.getByRole("button", { name: /Salvar e ativar/ });
    expect(saveButton).not.toBeDisabled();
  });
});

describe("VertexAIConnectionCard · G71 (adendo) — rede (c): 42501 vira mensagem amigável", () => {
  it("erro 42501 (RLS) no toggleActive mostra a mensagem traduzida, não o texto técnico do Postgres", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });
    const toggleActive = vi.fn().mockRejectedValue({
      code: "42501",
      message: "new row violates row-level security policy for table \"workspace_ai_credentials\"",
    });
    mocks.useVertexCredentialsMock.mockReturnValue(baseHookReturn({ toggleActive }));

    render(<VertexAIConnectionCard />);

    const toggle = await screen.findByRole("switch");
    fireEvent.click(toggle);

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [, opts] = vi.mocked(toast.error).mock.calls[0];
    const description = (opts as { description?: string })?.description;
    expect(description).toBe("Você não tem permissão para realizar esta ação.");
    expect(description).not.toMatch(/row-level security policy/i);
  });
});
