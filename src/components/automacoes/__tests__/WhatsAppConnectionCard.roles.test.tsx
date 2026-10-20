// Etapa 9 · Item 4 (G103, fatia 1) — administrar a instância do WhatsApp (conectar, QR, desconectar,
// importar token, remover) é owner/admin no servidor (403 para os demais): o card NÃO oferece o botão a
// quem não pode (G29) e diz por quê. Papel ainda desconhecido: nem botão nem aviso (sem piscar).
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useWorkspaceRoleMock: vi.fn() }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: mocks.useWorkspaceRoleMock }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }) }));

import { WhatsAppConnectionCard } from "@/components/automacoes/WhatsAppConnectionCard";
import { ADMIN_ONLY_INSTANCE_MESSAGE } from "@/lib/whatsapp/permissions";
import type { WhatsAppInstance } from "@/hooks/useWhatsAppInstance";

const fns = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  removeInstance: vi.fn(),
  refreshStatus: vi.fn(),
  importInstance: vi.fn(),
});

function instance(status: WhatsAppInstance["status"]): WhatsAppInstance {
  return {
    id: "i-1", workspace_id: "ws-1", status, phone: "5511999999999", phone_name: "Linha QA", qr_code: null,
    connected_at: null, last_status_at: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  };
}

const setRole = (role: string | null) =>
  mocks.useWorkspaceRoleMock.mockReturnValue({ role, isAdmin: role === "owner" || role === "admin", loading: role === null });

const ADMIN_BUTTONS = [/Desconectar/, /Ver QR/, /Remover conexão/, /Importar token/, /Reconectar|Conectar WhatsApp/];

beforeEach(() => vi.clearAllMocks());

describe("WhatsAppConnectionCard — gate de papel (instância = owner/admin)", () => {
  it.each(["owner", "admin"])("%s: vê e usa os controles da instância (desconectada: Importar token + Conectar)", (role) => {
    setRole(role);
    render(<WhatsAppConnectionCard instance={null} {...fns()} />);

    expect(screen.getByRole("button", { name: /Importar token/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Conectar WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByText(ADMIN_ONLY_INSTANCE_MESSAGE)).not.toBeInTheDocument();
  });

  it("admin com a instância conectada: Desconectar e Remover conexão", () => {
    setRole("admin");
    render(<WhatsAppConnectionCard instance={instance("connected")} {...fns()} />);

    expect(screen.getByRole("button", { name: /Desconectar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remover conexão/ })).toBeInTheDocument();
  });

  it.each(["member", "viewer"])("%s: NENHUM botão de administração em nenhum estado; o aviso explica o porquê", (role) => {
    setRole(role);
    for (const status of ["disconnected", "connecting", "connected"] as const) {
      const { unmount } = render(<WhatsAppConnectionCard instance={instance(status)} {...fns()} />);
      for (const name of ADMIN_BUTTONS) expect(screen.queryByRole("button", { name }), `${status} / ${String(name)}`).not.toBeInTheDocument();
      expect(screen.getByRole("note")).toHaveTextContent(ADMIN_ONLY_INSTANCE_MESSAGE);
      unmount();
    }
  });

  it("sem instância e sem permissão: também só o aviso (não oferece 'Conectar WhatsApp')", () => {
    setRole("member");
    render(<WhatsAppConnectionCard instance={null} {...fns()} />);

    expect(screen.queryByRole("button", { name: /Conectar WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole("note")).toBeInTheDocument();
  });

  it("papel ainda desconhecido (carregando): nem botão nem aviso — nunca presume admin, nunca pisca 'somente administradores'", () => {
    setRole(null);
    render(<WhatsAppConnectionCard instance={instance("connected")} {...fns()} />);

    expect(screen.queryByRole("button", { name: /Desconectar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("o status continua visível para qualquer papel (leitura)", () => {
    setRole("viewer");
    render(<WhatsAppConnectionCard instance={instance("connected")} {...fns()} />);

    expect(screen.getByText(/Conectado: Linha QA/)).toBeInTheDocument();
  });
});
