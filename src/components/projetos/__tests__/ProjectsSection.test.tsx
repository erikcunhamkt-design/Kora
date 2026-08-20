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
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
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
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
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
  vi.mocked(useTasks).mockReturnValue({ addTask: vi.fn(), moveTask: vi.fn() } as never);
  vi.mocked(useBifurcatedTasks).mockReturnValue([] as never);
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
  // jsdom não implementa scrollIntoView/hasPointerCapture — o <Select> (Radix)
  // do filtro de status precisa dos dois pra abrir via interação real. Mesmo
  // polyfill já usado em QuotesSection.test.tsx/WhatsApp.tab-gate.test.tsx.
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
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

// G29 (Fase D, Caso 1) — o banner/badge de "modo leitura" da era Fatia N
// nunca foram atualizados na Fase B, quando o CRUD em modo Supabase virou
// real e incondicional (createSupabaseProject/updateSupabaseProject não
// checam nenhuma flag, só `!workspace`). Causa raiz NÃO é divergência de
// semântica entre pontos de leitura de `kora.projects.supabaseWrite.enabled`
// (hipótese original) — é ausência TOTAL de checagem: o banner era gated
// só por `dataSource === "supabase"`, texto fixo, nunca olhava pra flag
// nenhuma. A flag (`isSupabaseProjectsWriteEnabled`) só gateia o ESPELHO
// em modo local (G22) — nunca gateou o CRUD direto em modo Supabase, nos
// dois sentidos (não gateava antes deste fix, e não deveria passar a
// gatear agora: seria uma mudança de comportamento não pedida, e teria
// quebrado a escrita real que o Caso 1 da homologação acabou de confirmar
// funcionando).
describe("ProjectsSection · G29 — banner/badge refletem a escrita real em modo Supabase", () => {
  it("usuário novo (sem nenhuma chave em localStorage) — badge/banner mostram OPERACIONAL, nunca 'modo leitura'", async () => {
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject: vi.fn() } as never);
    mockSupabaseProjects({ projects: [] });

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    await screen.findByText("Modo operacional");
    await screen.findByText("Projetos operacionais (Supabase)");
    expect(screen.queryByText("Modo leitura")).not.toBeInTheDocument();
    expect(screen.queryByText("Projetos em modo leitura (Supabase)")).not.toBeInTheDocument();
  });

  it("escrita real funciona mesmo com kora.projects.supabaseWrite.enabled=false — a flag NÃO gateia CRUD em modo Supabase", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    const createProject = vi.fn().mockResolvedValue({ id: "cloud-uuid-new" });
    vi.mocked(useProjects).mockReturnValue({ projects: [], addProject: vi.fn() } as never);
    mockSupabaseProjects({ createProject });

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Projetos operacionais (Supabase)");

    fireEvent.click(screen.getByText("Novo projeto"));
    fillCreateForm("X", "Y");
    fireEvent.click(screen.getByText("Criar projeto"));

    await waitFor(() => expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "X", clientName: "Y" }),
    ));
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
    await screen.findByText("Projetos operacionais (Supabase)");

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
    await screen.findByText("Projetos operacionais (Supabase)");

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

// Fase D (homologação) — achado ao vivo: um projeto arquivado ("HOMOLOG-FLIP-projeto-A")
// apareceu na lista principal com badge "Arquivado" mesmo com o filtro em "Todos status".
// Causa: `filtered` (ProjectsSection.tsx) só excluía por status quando `filterStatus !==
// "all"` — sob "all" (o default), nada excluía `status === "archived"`. Contraste com
// QuotesSection.tsx:236, que já exclui "arquivado" explicitamente sob "all" e só mostra
// arquivados quando o filtro de status é "arquivado" de propósito.
describe("ProjectsSection · Fase D — \"Todos status\" não inclui projeto arquivado", () => {
  it("projeto arquivado fica de fora da lista sob o filtro default \"Todos status\"", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.mocked(useProjects).mockReturnValue({
      projects: [
        makeLocalProject({ id: "pj-ativo", name: "Projeto Ativo", status: "in_progress" }),
        makeLocalProject({ id: "pj-arquivado", name: "Projeto Arquivado", status: "archived" }),
      ],
      addProject: vi.fn(),
    } as never);

    renderSection();

    expect(await screen.findByText("Projeto Ativo")).toBeInTheDocument();
    expect(screen.queryByText("Projeto Arquivado")).not.toBeInTheDocument();
  });

  it("projeto arquivado aparece quando o filtro de status é explicitamente \"Arquivado\"", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.mocked(useProjects).mockReturnValue({
      projects: [
        makeLocalProject({ id: "pj-ativo", name: "Projeto Ativo", status: "in_progress" }),
        makeLocalProject({ id: "pj-arquivado", name: "Projeto Arquivado", status: "archived" }),
      ],
      addProject: vi.fn(),
    } as never);

    renderSection();
    await screen.findByText("Projeto Ativo");

    const statusSelect = screen.getByText("Todos status");
    fireEvent.click(statusSelect);
    fireEvent.click(await screen.findByText("Arquivado"));

    expect(await screen.findByText("Projeto Arquivado")).toBeInTheDocument();
    expect(screen.queryByText("Projeto Ativo")).not.toBeInTheDocument();
  });
});

// Addendum G39 — sinalizado como fora de escopo naquela rodada: a lista sob
// "Todos status" já exclui arquivado (describe acima), mas o card KPI
// "Total" somava projects.length cru, incluindo arquivados — discordava do
// que a própria lista mostra sob o mesmo filtro "todos". Precedente: nenhuma
// KPI de QuotesSection.tsx conta "arquivado" (todas são filtros de status
// específico que o excluem estruturalmente).
describe("ProjectsSection · addendum G39 — KPI \"Total\" não conta projeto arquivado", () => {
  it("card Total reflete só os projetos não-arquivados, igual à lista sob \"Todos status\"", async () => {
    localStorage.setItem(PROJECTS_DATA_SOURCE_KEY, "local");
    vi.mocked(useProjects).mockReturnValue({
      projects: [
        makeLocalProject({ id: "pj-ativo", name: "Projeto Ativo", status: "in_progress" }),
        makeLocalProject({ id: "pj-arquivado", name: "Projeto Arquivado", status: "archived" }),
      ],
      addProject: vi.fn(),
    } as never);

    renderSection();
    await screen.findByText("Projeto Ativo");

    const totalLabel = screen.getByText("Total");
    const totalCard = totalLabel.closest("div")?.parentElement as HTMLElement;
    expect(within(totalCard).getByText("1")).toBeInTheDocument();
    expect(within(totalCard).queryByText("2")).not.toBeInTheDocument();
  });
});
