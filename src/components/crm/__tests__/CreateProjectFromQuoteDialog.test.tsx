// G22 (Fase B, dashboard-g22-fix) — "Gerar projeto" gravava só local; a
// reconciliação do dashboard Supabase nunca via essas linhas (docs/architecture/
// kora-hub-auditoria-e-plano.md). Fix: dual-write — local intacto (invariante
// "nunca refém da nuvem") + espelho best-effort.
//
// G85 — o espelho do ramo local chamava projectsRepository.createProjectFromQuote
// DIRETO: sem o gate de isSupabaseProjectsWriteEnabled() dos outros 3 call
// sites e gravando status "active" (alias legado). Agora usa o MESMO caminho
// (mirrorProjectToSupabase → mapper → importProject): estes testes exercitam o
// espelho e o mapper REAIS, mockando só o repository (importProject) — o payload
// que chega nele é a prova do vocabulário canônico.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { CreateProjectFromQuoteDialog } from "@/components/crm/CreateProjectFromQuoteDialog";
import { useProjects } from "@/hooks/useProjects";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository } from "@/repositories/projectsRepository";
import { mapLocalProjectToSupabase } from "@/services/projects/projectsMapper";
import { PROJECTS_DATA_SOURCE_KEY } from "@/config/flags";
import { PROJECTS_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseProjectsWriteFlag";
import { toast } from "sonner";

vi.mock("@/hooks/useProjects");
// Cutover do irmão de CRM: o dialog chama useSupabaseProjects()
// (createSupabaseProject, modo Supabase) e useCurrentWorkspace() (espelho do
// ramo local, G85) — sem mock, useQueryClient/useAuth quebram por falta de
// Provider na árvore de teste.
vi.mock("@/hooks/useSupabaseProjects", () => ({ useSupabaseProjects: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({
  useCurrentWorkspace: vi.fn(() => ({ workspace: { id: "ws-1" } })),
}));
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
  quoteId: "quote-uuid-1",
  clientId: "client-uuid-1",
  opportunityId: "opp-uuid-1",
  onSuccess: vi.fn(),
};

// UUIDs reais (formato v4) — resolveProjectFk só faz passthrough de uuid válido.
const QUOTE_UUID = "aaaaaaaa-1111-4111-8111-111111111111";
const CLIENT_UUID = "cccccccc-1111-4111-8111-111111111111";
const OPP_UUID = "bbbbbbbb-1111-4111-8111-111111111111";
const uuidProps = { ...baseProps, quoteId: QUOTE_UUID, clientId: CLIENT_UUID, opportunityId: OPP_UUID };

describe("CreateProjectFromQuoteDialog — espelho do ramo local (G22 + G85)", () => {
  let addProject: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    // getProjectsDataSource() default virou "supabase" (flip) — este describe
    // exercita o caminho local + espelho (G22), então força "local" explícito.
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.clearAllMocks();
    // addProject real devolve o Project completo — o mock devolve o input +
    // campos gerados, pro payload do espelho ser o mesmo de produção.
    addProject = vi.fn((input: Record<string, unknown>) => ({
      ...input, id: "proj-local-1", createdAt: "2026-10-02", progress: 0, isDemo: false,
    }));
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);
    vi.mocked(useSupabaseProjects).mockReturnValue({ createProject: vi.fn() } as never);
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws-1" } } as never);
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "cloud-proj-1" } as never);
  });

  const generate = async (props = uuidProps) => {
    const onSuccess = vi.fn();
    const utils = render(<CreateProjectFromQuoteDialog {...props} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    return { onSuccess, ...utils };
  };

  it("feliz: grava local E espelha pelo caminho canônico (importProject) — vínculos uuid, source 'quote', status 'planning'", async () => {
    await generate();

    expect(addProject).toHaveBeenCalledTimes(1);
    expect(projectsRepository.importProject).toHaveBeenCalledTimes(1);
    const [ws, sourceLocalId, payload] = vi.mocked(projectsRepository.importProject).mock.calls[0];
    expect(ws).toBe("ws-1");
    expect(sourceLocalId).toContain("proj-local-1");
    expect(payload).toMatchObject({
      quote_id: QUOTE_UUID,
      client_id: CLIENT_UUID,
      opportunity_id: OPP_UUID,
      source: "quote",
      status: "planning",
      title: "Projeto - Identidade visual Acme",
      budget: 8500,
    });
    expect(toast.success).toHaveBeenCalledWith("Projeto criado. Veja em Projetos.");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("G85 — zero escritor de 'active': o payload do espelho nunca carrega o alias legado, e o dialog não chama createProjectFromQuote direto", async () => {
    await generate();

    const payload = vi.mocked(projectsRepository.importProject).mock.calls[0][2];
    expect(payload.status).not.toBe("active");
    expect(projectsRepository.createProjectFromQuote).not.toHaveBeenCalled();
  });

  it("o projeto LOCAL fica byte a byte como antes: quoteId/clientId/opportunityId vão só na cópia do espelho", async () => {
    await generate();

    const localInput = addProject.mock.calls[0][0];
    expect(localInput).not.toHaveProperty("quoteId");
    expect(localInput).not.toHaveProperty("clientId");
    expect(localInput).not.toHaveProperty("opportunityId");
    expect(localInput).toMatchObject({ source: "orçamento", status: "planning", clientName: "Acme Corp" });
  });

  it("G85 — gate: flag de escrita OFF (override explícito) → cria local, NUNCA espelha, sem aviso falso", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");

    await generate();

    expect(addProject).toHaveBeenCalledTimes(1);
    expect(projectsRepository.importProject).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Projeto criado. Veja em Projetos.");
  });

  it("flag de escrita ON por default (opt-out, nenhuma chave gravada) → espelha", async () => {
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBeNull();

    await generate();

    expect(projectsRepository.importProject).toHaveBeenCalledTimes(1);
  });

  it("sem workspace ativo: cria local, não espelha, não quebra", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);

    await generate();

    expect(addProject).toHaveBeenCalledTimes(1);
    expect(projectsRepository.importProject).not.toHaveBeenCalled();
  });

  it("nuvem falha: local persiste, sucesso ainda dispara, aviso extra de espelho pendente", async () => {
    vi.mocked(projectsRepository.importProject).mockRejectedValue(new Error("network down"));

    await generate();

    // Local nunca é refém da nuvem: o projeto local foi criado mesmo com a nuvem falhando.
    expect(addProject).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Projeto criado. Veja em Projetos.");
    expect(toast.warning).toHaveBeenCalledWith(
      "Projeto salvo localmente, mas o espelho no Supabase falhou.",
      expect.objectContaining({ description: expect.stringContaining("Configurações") }),
    );
  });

  it("idempotência: 2ª geração pra mesma quote reenvia o mesmo quote_id — a idempotência é do repository (importProject → createProjectFromQuote/23505)", async () => {
    // importProject (projectsRepository.test.ts) roteia o payload quote-linked
    // por findProjectByQuote/createProjectFromQuote — testado isoladamente lá.
    // Aqui só provamos que o dialog SEMPRE entrega o mesmo quote_id.
    const first = await generate();
    first.unmount();
    await generate();

    expect(projectsRepository.importProject).toHaveBeenCalledTimes(2);
    const [firstCall, secondCall] = vi.mocked(projectsRepository.importProject).mock.calls;
    expect(firstCall[2]).toMatchObject({ quote_id: QUOTE_UUID });
    expect(secondCall[2]).toMatchObject({ quote_id: QUOTE_UUID });
  });

  it("log write-only kora.quotes.supabaseProjects.v1 morreu: nenhuma escrita no localStorage (modo local)", async () => {
    await generate();

    expect(localStorage.getItem("kora.quotes.supabaseProjects.v1")).toBeNull();
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
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws-1" } } as never);
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
    expect(projectsRepository.importProject).not.toHaveBeenCalled(); // espelho do ramo local não roda em modo Supabase
    expect(localStorage.getItem("kora.quotes.supabaseProjects.v1")).toBeNull(); // log write-only morreu
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
    vi.mocked(projectsRepository.importProject).mockResolvedValue({ id: "proj-1" } as never);
    const onSuccess = vi.fn();

    render(<CreateProjectFromQuoteDialog {...baseProps} onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText("Confirmar e Gerar"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(addProject).toHaveBeenCalledTimes(1);
    expect(projectsRepository.importProject).toHaveBeenCalledTimes(1);
    expect(createProject).not.toHaveBeenCalled();
  });
});
