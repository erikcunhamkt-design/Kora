// G71 (adendo de backlog de UI) — não-admin vê "Salvar Fluxo" desabilitado
// com aviso explícito (Lock + Tooltip); admin continua com o botão normal,
// sem regressão. isAdmin vem de useWorkspaceRole (mockado aqui — hook já
// testado isoladamente em useWorkspaceRole.test.ts). Também prova a rede
// de segurança (c): erro 42501 (RLS) vira mensagem amigável via
// normalizeSupabaseError/toastError, não o texto técnico cru do Postgres.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const loadSelect = vi.fn(() => ({ eq }));
  const single = vi.fn().mockResolvedValue({
    data: null,
    error: { code: "42501", message: "new row violates row-level security policy for table \"whatsapp_bot_settings\"" },
  });
  const insertSelect = vi.fn(() => ({ single }));
  const insert = vi.fn((_payload: unknown) => ({ select: insertSelect }));
  const from = vi.fn(() => ({ select: loadSelect, insert }));
  const useWorkspaceRoleMock = vi.fn();
  return { maybeSingle, eq, loadSelect, single, insertSelect, insert, from, useWorkspaceRoleMock };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: mocks.useWorkspaceRoleMock }));

import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";
import { toast } from "sonner";

describe("WhatsAppBotConfig · G71 (adendo) — role-gate do botão Salvar Fluxo", () => {
  it("não-admin: botão Salvar Fluxo desabilitado, com aviso explícito (title, já que o hover do Radix Tooltip não é testável de forma confiável em jsdom)", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "member", isAdmin: false, loading: false });

    render(<WhatsAppBotConfig workspaceId="ws-1" />);
    await screen.findByText("Apenas Conversas Novas (Triagem)");

    const saveButton = screen.getByRole("button", { name: /Salvar Fluxo/ });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAttribute("title", "Apenas administradores do workspace podem alterar esta configuração.");
  });

  it("admin: botão Salvar Fluxo continua habilitado, comportamento original preservado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });

    render(<WhatsAppBotConfig workspaceId="ws-1" />);
    await screen.findByText("Apenas Conversas Novas (Triagem)");

    const saveButton = screen.getByRole("button", { name: /Salvar Fluxo/ });
    expect(saveButton).not.toBeDisabled();
  });

  it("loading do papel (isAdmin ainda não resolvido): botão continua desabilitado, nunca pisca habilitado", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: null, isAdmin: false, loading: true });

    render(<WhatsAppBotConfig workspaceId="ws-1" />);
    await screen.findByText("Apenas Conversas Novas (Triagem)");

    const saveButton = screen.getByRole("button", { name: /Salvar Fluxo/ });
    expect(saveButton).toBeDisabled();
  });
});

describe("WhatsAppBotConfig · G71 (adendo) — rede (c): 42501 vira mensagem amigável", () => {
  it("erro 42501 (RLS) no save mostra a mensagem traduzida, não o texto técnico do Postgres", async () => {
    mocks.useWorkspaceRoleMock.mockReturnValue({ role: "owner", isAdmin: true, loading: false });

    render(<WhatsAppBotConfig workspaceId="ws-1" />);
    await screen.findByText("Apenas Conversas Novas (Triagem)");

    fireEvent.click(screen.getByRole("button", { name: /Salvar Fluxo/ }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [title, opts] = vi.mocked(toast.error).mock.calls[0];
    expect(title).toBe("Erro ao salvar configurações");
    expect((opts as { description?: string })?.description).toBe(
      "Você não tem permissão para realizar esta ação.",
    );
    expect((opts as { description?: string })?.description).not.toMatch(/row-level security policy/i);
  });
});
