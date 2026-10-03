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
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { projectsRepository } from "@/repositories/projectsRepository";
import { mapLocalProjectToSupabase } from "@/services/projects/projectsMapper";
import { PROJECTS_DATA_SOURCE_KEY } from "@/config/flags";
import { toast } from "sonner";

vi.mock("@/hooks/useProjects");
// Cutover do irmão de CRM: o dialog passou a chamar useSupabaseProjects()
// (createSupabaseProject, modo Supabase) — sem mock, useQueryClient/
// useCurrentWorkspace quebram por falta de Provider na árvore de teste.
vi.mock("@/hooks/useSupabaseProjects", () => ({ useSupabaseProjects: vi.fn() }));
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
    // getProjectsDataSource() default virou "supabase" (flip) — este describe
    // exercita o caminho local + espelho (G22), então força "local" explícito.
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.clearAllMocks();
    addProject = vi.fn(() => ({ id: "proj-local-1" }));
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ createProject: vi.fn() } as never);
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

// Cutover do irmão de CRM (mesma decisão de produto do Caso 7.2 de Vendas,
// QuoteToProjectDialog, 5be5c3d) — em modo Supabase, "Gerar projeto" cria o
// projeto NATIVAMENTE na nuvem (createSupabaseProject), com vínculos reais
// (quote_id/client_id/opportunity_id uuid — G37; G67: sem Number(uuid)).
describe("CreateProjectFromQuoteDialog — cutover nativo em modo Supabase", () => {
  let addProject: ReturnType<typeof vi.fn>;
  let createProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    addProject = vi.fn(() => ({ id: "proj-local-1" }));
    createProject = vi.fn().mockResolvedValue({ id: "cloud-proj-1" });
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ createProject } as never);
  });

  it("modo Supabase (default pós-flip): chama createSupabaseProject, NUNCA addProject local nem o espelho", async () => {
    const onSuccess = vi.fn();
    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(addProject).not.toHaveBeenCalled();
    expect(projectsRepository.createProjectFromQuote).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Projeto criado. Veja em Projetos.");
  });

  it("vínculos uuid chegam intactos (sem Number(uuid)=NaN) e o mapper os resolve pra quote_id/client_id/opportunity_id + source 'quote'", async () => {
    render(<CreateProjectFromQuoteDialog {...baseProps} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(createProject).toHaveBeenCalled());

    const input = createProject.mock.calls[0][0];
    expect(input).toMatchObject({
      name: "Projeto - Identidade visual Acme",
      clientName: "Acme Corp",
      clientId: "client-uuid-1",
      quoteId: "quote-uuid-1",
      opportunityId: "opp-uuid-1",
      source: "orçamento",
      budget: 8500,
      status: "planning",
    });
    expect(Number.isNaN(input.clientId)).toBe(false);

    // Mesma função que createMutation (useSupabaseProjects) aplica ao input.
    // uuids reais pra exercitar o passthrough de resolveProjectFk.
    const uuid = (n: string) => `${n}${n}${n}${n}${n}${n}${n}${n}-1111-4111-8111-111111111111`;
    const payload = mapLocalProjectToSupabase({
      ...input, id: "", createdAt: "", progress: 0, isDemo: false,
      clientId: uuid("c"), quoteId: uuid("a"), opportunityId: uuid("b"),
    });
    expect(payload).toMatchObject({
      client_id: uuid("c"), quote_id: uuid("a"), opportunity_id: uuid("b"), source: "quote",
    });
  });

  it("sem clientId/opportunityId (cotação avulsa): payload sem vínculo inventado — undefined, não NaN/'undefined'", async () => {
    render(<CreateProjectFromQuoteDialog {...baseProps} clientId={undefined} opportunityId={null} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(createProject).toHaveBeenCalled());

    const input = createProject.mock.calls[0][0];
    expect(input.clientId).toBeUndefined();
    expect(input.opportunityId).toBeUndefined();
    expect(input.quoteId).toBe("quote-uuid-1");
  });

  it("falha da nuvem: toast de erro explícito, projeto NÃO fica local, onSuccess/fechar não disparam (sem sucesso falso)", async () => {
    createProject.mockRejectedValue(new Error("network down"));
    const onSuccess = vi.fn();
    const onOpenChange = vi.fn();

    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(addProject).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("modo local explícito: continua local + espelho best-effort, createSupabaseProject nunca chamado (regressão)", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.mocked(projectsRepository.createProjectFromQuote).mockResolvedValue({ id: "proj-1" } as never);
    const onSuccess = vi.fn();

    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(addProject).toHaveBeenCalledTimes(1);
    expect(projectsRepository.createProjectFromQuote).toHaveBeenCalledTimes(1);
    expect(createProject).not.toHaveBeenCalled();
  });
});
