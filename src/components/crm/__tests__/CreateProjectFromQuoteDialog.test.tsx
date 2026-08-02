// G22 (Fase B, dashboard-g22-fix) — "Gerar projeto" gravava só local; a
// reconciliação do dashboard Supabase nunca via essas linhas (docs/architecture/
// kora-hub-auditoria-e-plano.md). Fix: dual-write — local intacto (invariante
// "nunca refém da nuvem") + espelho best-effort via
// projectsRepository.createProjectFromQuote (já idempotente contra o UNIQUE
// PARCIAL ux_projects_from_quote, precedente P8b).
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { CreateProjectFromQuoteDialog } from "@/components/crm/CreateProjectFromQuoteDialog";
import { useProjects } from "@/hooks/useProjects";
import { projectsRepository } from "@/repositories/projectsRepository";
import { toast } from "sonner";

vi.mock("@/hooks/useProjects");
vi.mock("@/repositories/projectsRepository");
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn(), message: vi.fn() },
}));

const baseProps = {
  open: true,
  onOpenChange: vi.fn(),
  quoteTitle: "Identidade visual Acme",
  quoteTotal: 8500,
  clientName: "Acme Corp",
  workspaceId: "ws-1",
  quoteId: "quote-uuid-1",
  clientId: "client-uuid-1",
  opportunityId: "opp-uuid-1",
  onSuccess: vi.fn(),
};

describe("CreateProjectFromQuoteDialog — G22 dual-write", () => {
  let addProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    addProject = vi.fn(() => ({ id: "proj-local-1" }));
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);
  });

  it("feliz: grava local E espelha na nuvem com os campos certos", async () => {
    vi.mocked(projectsRepository.createProjectFromQuote).mockResolvedValue({ id: "proj-1" } as never);
    const onSuccess = vi.fn();

    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    expect(addProject).toHaveBeenCalledTimes(1);
    expect(projectsRepository.createProjectFromQuote).toHaveBeenCalledTimes(1);
    expect(projectsRepository.createProjectFromQuote).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        quote_id: "quote-uuid-1",
        client_id: "client-uuid-1",
        opportunity_id: "opp-uuid-1",
        title: "Projeto - Identidade visual Acme",
        budget: 8500,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Projeto criado. Veja em Projetos.");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("nuvem falha: local persiste, sucesso ainda dispara, aviso extra de espelho pendente", async () => {
    vi.mocked(projectsRepository.createProjectFromQuote).mockRejectedValue(new Error("network down"));
    const onSuccess = vi.fn();

    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());

    // Local nunca é refém da nuvem: o projeto local foi criado mesmo com a nuvem falhando.
    expect(addProject).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Projeto criado. Veja em Projetos.");
    expect(toast.warning).toHaveBeenCalledWith(
      "Projeto salvo localmente, mas o espelho no Supabase falhou.",
      expect.objectContaining({ description: expect.stringContaining("Configurações") }),
    );
  });

  it("idempotência: 2ª geração para a mesma quote passa pelo mesmo caminho idempotente do repository", async () => {
    // O repository (projectsRepository.createProjectFromQuote) já garante, via
    // catch(23505)+re-consulta, que a 2ª chamada para o mesmo quote_id nunca duplica —
    // testado isoladamente em projectsRepository.test.ts. Aqui só provamos que o diálogo
    // SEMPRE invoca esse mesmo caminho, com o mesmo quote_id, em toda geração.
    vi.mocked(projectsRepository.createProjectFromQuote).mockResolvedValue({ id: "proj-existente" } as never);
    const onSuccess = vi.fn();

    const { unmount } = render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    unmount();

    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(2));

    expect(projectsRepository.createProjectFromQuote).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = vi.mocked(projectsRepository.createProjectFromQuote).mock.calls;
    expect(firstCall[1]).toMatchObject({ quote_id: "quote-uuid-1" });
    expect(secondCall[1]).toMatchObject({ quote_id: "quote-uuid-1" });
  });
});
