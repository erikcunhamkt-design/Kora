// Etapa 9 · item 3 — UI do opt-in da base de conhecimento (Configurações, ao
// lado do cérebro): default OFF, só "itens já orçados" é operante, C/D/E e B
// desabilitadas, rótulo honesto, admin-gated, degradação sem tabela.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";

import { AiKnowledgeSection } from "@/components/settings/AiKnowledgeSection";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { aiKnowledgeConsentsRepository } from "@/repositories/aiKnowledgeConsentsRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useWorkspaceRole", () => ({ useWorkspaceRole: vi.fn() }));
vi.mock("@/repositories/aiKnowledgeConsentsRepository", async () => {
  const actual = await vi.importActual<typeof import("@/repositories/aiKnowledgeConsentsRepository")>(
    "@/repositories/aiKnowledgeConsentsRepository",
  );
  return { ...actual, aiKnowledgeConsentsRepository: { list: vi.fn(), setEnabled: vi.fn() } };
});
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

const repo = aiKnowledgeConsentsRepository as unknown as {
  list: ReturnType<typeof vi.fn>;
  setEnabled: ReturnType<typeof vi.fn>;
};

const row = (category: string, extra: Record<string, unknown> = {}) => ({
  category, enabled: true, legalBasisAck: false, revokedAt: null, ...extra,
});

function setRole(isAdmin: boolean) {
  (useWorkspaceRole as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ role: isAdmin ? "owner" : "member", isAdmin, loading: false });
}

async function openSection() {
  render(<AiKnowledgeSection />);
  fireEvent.click(screen.getByRole("switch", { name: "Mostrar a base de conhecimento" }));
  await screen.findByText("Itens já orçados");
}

const catalogSwitch = () => screen.getByRole("switch", { name: /usar itens já orçados como contexto do robô/i });

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  (useCurrentWorkspace as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    workspace: { id: "ws1" },
    membership: { user_id: "user-1", role: "owner" },
  });
  setRole(true);
  repo.list.mockResolvedValue({ available: true, consents: [] });
  repo.setEnabled.mockResolvedValue(undefined);
});

describe("AiKnowledgeSection — gate da flag (default OFF)", () => {
  it("flag OFF por padrão: só o interruptor aparece, nenhuma chamada ao repository", () => {
    render(<AiKnowledgeSection />);
    expect(screen.getByText("Mostrar a base de conhecimento")).toBeInTheDocument();
    expect(screen.queryByText("Itens já orçados")).not.toBeInTheDocument();
    expect(repo.list).not.toHaveBeenCalled();
  });

  it("ligar o interruptor carrega o consentimento e mostra as 5 categorias", async () => {
    await openSection();
    expect(repo.list).toHaveBeenCalledWith("ws1");
    for (const title of ["Itens já orçados", "Tarefas e projetos", "Cadastro de clientes e CRM", "Conversas de WhatsApp", "Financeiro"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });
});

describe("AiKnowledgeSection — default OFF e rótulo honesto (G29/G40)", () => {
  it("sem nenhuma linha: tudo DESLIGADO", async () => {
    await openSection();
    for (const sw of screen.getAllByRole("switch").slice(1)) expect(sw).not.toBeChecked();
  });

  it("a categoria A se chama 'itens já orçados' e diz que NÃO é o catálogo (que fica só no navegador)", async () => {
    await openSection();
    expect(screen.getByText("Itens já orçados")).toBeInTheDocument();
    expect(screen.queryByText(/^Catálogo$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Não é o seu catálogo de serviços/)).toBeInTheDocument();
    expect(screen.getByText(/pelo menos 2 orçamentos/)).toBeInTheDocument();
  });

  it("categoria ligada no banco aparece LIGADA", async () => {
    repo.list.mockResolvedValue({ available: true, consents: [row("catalog")] });
    await openSection();
    await waitFor(() => expect(catalogSwitch()).toBeChecked());
  });

  it("mostra o que o SERVIDOR usa: C ligada sem atesto no banco NÃO aparece como ligada (mesma regra activeCategories)", async () => {
    repo.list.mockResolvedValue({ available: true, consents: [row("crm")] });
    await openSection();
    expect(screen.getByRole("switch", { name: /cadastro de clientes e crm/i })).not.toBeChecked();
  });
});

describe("AiKnowledgeSection — só A é operante; B/C/D/E desabilitadas", () => {
  it("B, C, D e E ficam desabilitadas, com o motivo na tela", async () => {
    await openSection();
    for (const name of [/tarefas e projetos/i, /cadastro de clientes e crm/i, /conversas de whatsapp/i, /financeiro/i]) {
      expect(screen.getByRole("switch", { name })).toBeDisabled();
    }
    expect(screen.getAllByText(/Indisponível nesta versão/).length).toBe(4);
    expect(screen.getAllByText(/base legal \(LGPD\)/).length).toBe(3);
  });

  it("clicar numa categoria desabilitada não escreve nada", async () => {
    await openSection();
    fireEvent.click(screen.getByRole("switch", { name: /cadastro de clientes e crm/i }));
    expect(repo.setEnabled).not.toHaveBeenCalled();
  });
});

describe("AiKnowledgeSection — ligar/desligar a categoria A", () => {
  it("ligar chama setEnabled(workspace, 'catalog', true, userId) e recarrega", async () => {
    await openSection();
    fireEvent.click(catalogSwitch());

    await waitFor(() => expect(repo.setEnabled).toHaveBeenCalledWith("ws1", "catalog", true, "user-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Base de conhecimento ligada"));
    expect(repo.list).toHaveBeenCalledTimes(2);
  });

  it("desligar (revogar) chama setEnabled(..., false)", async () => {
    repo.list.mockResolvedValue({ available: true, consents: [row("catalog")] });
    await openSection();
    await waitFor(() => expect(catalogSwitch()).toBeChecked());
    fireEvent.click(catalogSwitch());

    await waitFor(() => expect(repo.setEnabled).toHaveBeenCalledWith("ws1", "catalog", false, "user-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Base de conhecimento desligada"));
  });

  it("erro ao salvar vira toast de erro (não some em silêncio)", async () => {
    repo.setEnabled.mockRejectedValue(new Error("RLS negou"));
    await openSection();
    fireEvent.click(catalogSwitch());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao salvar a base de conhecimento", { description: "RLS negou" }));
  });
});

describe("AiKnowledgeSection — admin-gated (precedente G71)", () => {
  it("não-admin vê o estado mas não consegue alterar, com o aviso de quem pode", async () => {
    setRole(false);
    await openSection();

    expect(catalogSwitch()).toBeDisabled();
    expect(screen.getByText(/Só o dono ou um administrador/)).toBeInTheDocument();
    fireEvent.click(catalogSwitch());
    expect(repo.setEnabled).not.toHaveBeenCalled();
  });
});

describe("AiKnowledgeSection — DEGRADAÇÃO sem a tabela (migration pendente)", () => {
  it("tabela ausente: aviso honesto, tudo desabilitado, robô segue como antes, nada quebra", async () => {
    repo.list.mockResolvedValue({ available: false, consents: [] });
    await openSection();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/ainda não está disponível neste ambiente/)).toBeInTheDocument();
    expect(within(alert).getByText(/o robô segue respondendo como antes/)).toBeInTheDocument();
    for (const sw of screen.getAllByRole("switch").slice(1)) expect(sw).toBeDisabled();
  });

  it("erro inesperado ao carregar vira toast e a tela não quebra", async () => {
    repo.list.mockRejectedValue(new Error("falha de rede"));
    render(<AiKnowledgeSection />);
    fireEvent.click(screen.getByRole("switch", { name: "Mostrar a base de conhecimento" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao carregar a base de conhecimento", { description: "falha de rede" }));
  });
});
