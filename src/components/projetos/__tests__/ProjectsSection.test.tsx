// Etapa 5 · Pacote do Flip (projects) — matriz dual-mode da tela principal:
// (1) modo local (default) mostra dados locais intocados; (2) modo Supabase
// mostra os dados da nuvem, mapeados (status/cliente/source traduzidos);
// (3) CRUD real em modo Supabase (Fase B) — create vai direto pra nuvem,
// falha vira toast explícito, nunca um sucesso falso; (4) espelho best-effort
// no create em modo local (fatia N, padrão G22) — só dispara com o flag
// mestre ON, falha do espelho nunca desfaz o local.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ProjectsSection } from "@/components/projetos/ProjectsSection";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClients } from "@/hooks/useClients";
import { useTasks } from "@/hooks/useTasks";
import { PROJECTS_DATA_SOURCE_KEY } from "@/config/flags";
import { PROJECTS_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseProjectsWriteFlag";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import { toast } from "@/hooks/use-toast";

vi.mock("@/hooks/useProjects", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProjects")>("@/hooks/useProjects");
  return { ...actual, useProjects: vi.fn() };
});
vi.mock("@/hooks/useSupabaseProjects", () => ({ useSupabaseProjects: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn() }));
vi.mock("@/services/projects/projectsCloudMirror", () => ({ mirrorProjectToSupabase: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

function makeLocalProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pj-local-1",
    name: "Projeto Local",
    clientName: "Cliente Local",
    status: "in_progress",
    priority: "medium",
    progress: 40,
    tags: [],
    createdAt: "2026-07-01",
    isDemo: false,
    source: "manual",
    ...overrides,
  };
}

function makeSupabaseProjectRaw(overrides: Record<string, unknown> = {}) {
  return {
    id: "sp-cloud-1",
    workspace_id: "ws1",
    title: "Projeto Nuvem",
    status: "active", // alias legado — prova que o mapper traduz na tela real
    client_id: "uuid-client-1",
    is_demo: false,
    archived: false,
    created_at: "2026-07-20T00:00:00Z",
    updated_at: "2026-07-20T00:00:00Z",
    ...overrides,
  };
}

/** Default: hook de nuvem sem projetos, create/update mockados sem-op. Cada
 * teste sobrescreve o que precisar via vi.mocked(useSupabaseProjects).mockReturnValue. */
function mockSupabaseProjects(overrides: Record<string, unknown> = {}) {
  vi.mocked(useSupabaseProjects).mockReturnValue({
    projects: [], loading: false, error: null,
    createProject: vi.fn(), updateProject: vi.fn(), refresh: vi.fn(),
    ...overrides,
  } as never);
}

function setupCommonMocks() {
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useTasks).mockReturnValue({ tasks: [], addTask: vi.fn(), moveTask: vi.fn() } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({
    clients: [{ id: "uuid-client-1", name: "Acme Corp" }],
  } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  mockSupabaseProjects();
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setupCommonMocks();
});

function renderSection() {
  return render(
    <MemoryRouter>
      <ProjectsSection />
    </MemoryRouter>,
  );
}

// Label/Input não têm htmlFor/id ligados no form (ProjectsSection.tsx) —
// getByLabelText não resolve. DialogContent (Radix) faz portal pra
// document.body, fora da árvore do `container` de render() — consulta
// direta em document.body por `name`.
function fillCreateForm(name: string, clientName: string) {
  const nameInput = document.body.querySelector('input[name="name"]') as HTMLInputElement;
  const clientInput = document.body.querySelector('input[name="clientName"]') as HTMLInputElement;
  fireEvent.change(nameInput, { target: { value: name } });
  fireEvent.change(clientInput, { target: { value: clientName } });
}

// Etapa 5 · Pacote do Flip (Fase C) — getProjectsDataSource() default virou
// "supabase" (só "local" explícito escolhe local, mesmo formato do CRM/
// quotes). Este describe passou de "default" pra "explícito": o teste
// agora grava "local" no seletor antes de renderizar, provando que a
// escolha explícita continua funcionando — não mais o cenário de "seletor
// nunca tocado", que agora mostra nuvem (novo describe abaixo).
describe("ProjectsSection · modo local (explícito)", () => {
  it("mostra os dados locais quando o seletor está explicitamente em \"local\"", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.mocked(useProjects).mockReturnValue({
      projects: [makeLocalProject()], addProject: vi.fn(),
    } as never);

    renderSection();

    expect(await screen.findByText("Projeto Local")).toBeInTheDocument();
    expect(screen.queryByText("Projeto Nuvem")).not.toBeInTheDocument();
  });
});

describe("ProjectsSection · modo Supabase (leitura, novo default)", () => {
  it("mostra os dados da nuvem quando o seletor nunca foi tocado (novo default, Pacote do Flip)", async () => {
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject: vi.fn() } as never);
    mockSupabaseProjects({ projects: [makeSupabaseProjectRaw()] });

    renderSection();

    expect(await screen.findByText("Projeto Nuvem")).toBeInTheDocument();
  });

  it("mostra os dados da nuvem MAPEADOS — status 'active' traduzido, clientName resolvido", async () => {
    vi.mocked(useProjects).mockReturnValue({
      projects: [makeLocalProject()], addProject: vi.fn(),
    } as never);
    mockSupabaseProjects({ projects: [makeSupabaseProjectRaw()] });

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    const titleEl = await screen.findByText("Projeto Nuvem");
    const card = titleEl.closest('[role="button"]') as HTMLElement;
    expect(screen.queryByText("Projeto Local")).not.toBeInTheDocument();
    // 'active' é alias legado -> 'in_progress' (badge de status do card, não o
    // card de métrica "Em andamento" — por isso escopado com `within`).
    expect(within(card).getByText("Em andamento")).toBeInTheDocument();
    // client_id resolvido via useClientsDataSource -> "Acme Corp", não vazio/uuid cru.
    expect(within(card).getByText(/Acme Corp/)).toBeInTheDocument();
  });

  it("grava o seletor no localStorage ao trocar de fonte", async () => {
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject: vi.fn() } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    await waitFor(() => expect(localStorage.getItem(PROJECTS_DATA_SOURCE_KEY)).toBe("supabase"));
  });
});

describe("ProjectsSection · CRUD real em modo Supabase (Pacote do Flip, Fase B)", () => {
  it("criar projeto em modo Supabase chama createProject (nativo) — NUNCA addProject local", async () => {
    const addProject = vi.fn();
    const createProject = vi.fn().mockResolvedValue({ id: "cloud-uuid-new" });
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject } as never);
    mockSupabaseProjects({ createProject });

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Projetos em modo leitura (Supabase)");

    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("X", "Y");
    fireEvent.click(screen.getByText("Criar projeto"));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "X", clientName: "Y" }),
    ));
    expect(addProject).not.toHaveBeenCalled();
  });

  it("falha ao criar em modo Supabase vira toast de erro explícito — nunca sucesso falso", async () => {
    const createProject = vi.fn().mockRejectedValue(new Error("network down"));
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject: vi.fn() } as never);
    mockSupabaseProjects({ createProject });

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Projetos em modo leitura (Supabase)");

    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("X", "Y");
    fireEvent.click(screen.getByText("Criar projeto"));

    await waitFor(() => expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: expect.stringContaining("Falha ao criar projeto no Supabase"), variant: "destructive" }),
    ));
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: "Projeto criado" }));
  });
});

// Etapa 5 · Pacote do Flip (Fase C) — dataSource default virou "supabase";
// todo teste deste describe grava "local" explicitamente pra exercitar o
// caminho de escrita local + espelho (padrão G22 da fatia N, inalterado
// pela Fase C). supabaseWrite também virou opt-out (default ON) — os 2
// primeiros testes agora provam isso: "OFF" precisa de override explícito,
// e um novo teste prova o ON sem setar nada (novo default).
describe("ProjectsSection · espelho best-effort no create em modo local (fatia N, padrão G22)", () => {
  it("flag mestre OFF (override explícito) — cria local, NUNCA chama o espelho", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    const addProject = vi.fn().mockReturnValue(makeLocalProject({ id: "pj-new" }));
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject } as never);

    renderSection();
    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("Novo", "Cliente");
    fireEvent.click(screen.getByText("Criar projeto"));

    await waitFor(() => expect(addProject).toHaveBeenCalled());
    expect(mirrorProjectToSupabase).not.toHaveBeenCalled();
  });

  it("flag mestre ON (novo default, sem setar nada manualmente) — cria local E tenta o espelho", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    const created = makeLocalProject({ id: "pj-new" });
    const addProject = vi.fn().mockReturnValue(created);
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject } as never);
    vi.mocked(mirrorProjectToSupabase).mockResolvedValue({ id: "cloud-uuid" } as never);

    renderSection();
    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("Novo", "Cliente");
    fireEvent.click(screen.getByText("Criar projeto"));

    await waitFor(() => expect(mirrorProjectToSupabase).toHaveBeenCalledWith("ws1", created));
  });

  it("flag mestre ON (explícito) — cria local E tenta o espelho best-effort", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    const created = makeLocalProject({ id: "pj-new" });
    const addProject = vi.fn().mockReturnValue(created);
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject } as never);
    vi.mocked(mirrorProjectToSupabase).mockResolvedValue({ id: "cloud-uuid" } as never);

    renderSection();
    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("Novo", "Cliente");
    fireEvent.click(screen.getByText("Criar projeto"));

    await waitFor(() => expect(mirrorProjectToSupabase).toHaveBeenCalledWith("ws1", created));
  });

  it("falha do espelho NUNCA desfaz o local — projeto já foi criado antes do espelho rodar", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    const created = makeLocalProject({ id: "pj-new" });
    const addProject = vi.fn().mockReturnValue(created);
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject } as never);
    vi.mocked(mirrorProjectToSupabase).mockRejectedValue(new Error("network down"));

    renderSection();
    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("Novo", "Cliente");
    fireEvent.click(screen.getByText("Criar projeto"));

    // addProject (local) já foi chamado e NÃO é revertido pela falha do espelho.
    await waitFor(() => expect(addProject).toHaveBeenCalled());
    await waitFor(() => expect(mirrorProjectToSupabase).toHaveBeenCalled());
    // Toast de sucesso do create local dispara sempre; o toast de falha do
    // espelho é uma chamada SEPARADA e adicional (mock async, aguardamos as duas).
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringContaining("espelho no Supabase falhou") }),
      ),
    );
  });
});
