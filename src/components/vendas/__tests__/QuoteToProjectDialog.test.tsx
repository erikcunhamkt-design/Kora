// Etapa 5 · Pacote do Flip (projects) — Fase B, item 2. Resolve o risco R5
// da Fase A do flip (o mais crítico dos 5 consumidores classe (a)): antes
// desta fatia, "Gerar projeto" (Vendas) era o ÚNICO caminho de criação sem
// nenhum espelho — o projeto ficaria invisível assim que a tela principal
// passasse a ler da nuvem por padrão. Prova o mesmo padrão G22 já usado em
// ProjectsSection.tsx (fatia N): local sempre grava primeiro, espelho é
// best-effort e só dispara com o flag mestre ON.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { QuoteToProjectDialog } from "@/components/vendas/QuoteToProjectDialog";
import { useProjects, type Project } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PROJECTS_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseProjectsWriteFlag";
import { mirrorProjectToSupabase } from "@/services/projects/projectsCloudMirror";
import type { Quote } from "@/hooks/useQuotes";

vi.mock("@/hooks/useProjects", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useProjects")>("@/hooks/useProjects");
  return { ...actual, useProjects: vi.fn() };
});
vi.mock("@/hooks/useTasks", () => ({ useTasks: vi.fn(), formatPtBr: (iso: string) => iso }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/services/projects/projectsCloudMirror", () => ({ mirrorProjectToSupabase: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q1", clientName: "Acme Corp", clientEmail: "", clientWhatsapp: "",
    title: "Website institucional", description: "", items: [],
    subtotal: 1000, discount: 0, total: 1000, paymentCondition: "",
    deliveryDeadline: "", validityDays: 15, status: "aprovado",
    createdAt: "2026-07-01",
    ...overrides,
  };
}

function makeCreatedProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "pj-new", name: "Projeto — Website institucional", clientName: "Acme Corp",
    status: "planning", priority: "medium", progress: 0, tags: [],
    createdAt: "2026-08-11", isDemo: false, source: "orçamento",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useTasks).mockReturnValue({ addTask: vi.fn() } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
});

function renderDialog(quote: Quote) {
  return render(
    <QuoteToProjectDialog quote={quote} open onOpenChange={() => {}} onGenerated={() => {}} />,
  );
}

describe("QuoteToProjectDialog · espelho best-effort (padrão G22, resolve R5)", () => {
  it("flag mestre OFF (override explícito, Pacote do Flip virou opt-out) — cria local, NUNCA chama o espelho", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    const addProject = vi.fn().mockReturnValue(makeCreatedProject());
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(addProject).toHaveBeenCalled());
    expect(mirrorProjectToSupabase).not.toHaveBeenCalled();
  });

  it("flag mestre ON — cria local E tenta o espelho best-effort", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    const created = makeCreatedProject();
    const addProject = vi.fn().mockReturnValue(created);
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);
    vi.mocked(mirrorProjectToSupabase).mockResolvedValue({ id: "cloud-uuid" } as never);

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(mirrorProjectToSupabase).toHaveBeenCalledWith("ws1", created));
  });

  it("falha do espelho NUNCA desfaz o local — projeto já foi criado antes do espelho rodar", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    const created = makeCreatedProject();
    const addProject = vi.fn().mockReturnValue(created);
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);
    vi.mocked(mirrorProjectToSupabase).mockRejectedValue(new Error("network down"));

    renderDialog(makeQuote());
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(addProject).toHaveBeenCalled());
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(
      expect.stringContaining("espelho no Supabase falhou"),
      expect.anything(),
    ));
  });
});

// G44 — cascata do clientId: NewQuoteWizard.tsx (QuotesSection.tsx) passou a
// gravar um clientId real (uuid da nuvem, quando selecionado do dropdown de
// cliente existente — useClientsDataSource()) em vez de deixar sempre
// undefined. Este teste prova que esse clientId sobrevive até o projeto —
// a dor real da Fase D de Projetos (quote sem clientId -> projeto sem
// clientId -> ficha do cliente cega). Nenhum código deste dialog mudou pra
// isso: quote.clientId já era repassado cru (linha `clientId: quote.clientId`),
// e resolveProjectFk/mapLocalProjectToSupabase (G37) já sabe passar um uuid
// direto sem tradução — só faltava uma tela alimentando um clientId de
// verdade. Este teste tranca esse contrato, não corrige um bug novo aqui.
describe("QuoteToProjectDialog · G44 — clientId da quote sobrevive até o projeto", () => {
  it("quote com clientId uuid (selecionado no wizard) -> addProject recebe o MESMO clientId", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    const addProject = vi.fn().mockReturnValue(makeCreatedProject({ clientId: "client-uuid-1" as never }));
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);

    renderDialog(makeQuote({ clientId: "client-uuid-1" as never, clientName: "Cliente Cadastrado" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(addProject).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: "client-uuid-1", clientName: "Cliente Cadastrado" }),
    ));
  });

  it("quote sem clientId (nome livre, sem seleção) -> addProject recebe undefined, nunca um id inventado", async () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    const addProject = vi.fn().mockReturnValue(makeCreatedProject());
    vi.mocked(useProjects).mockReturnValue({ addProject } as never);

    renderDialog(makeQuote({ clientId: undefined, clientName: "Cliente Digitado Na Mão" }));
    fireEvent.click(screen.getByRole("button", { name: "Gerar projeto" }));

    await waitFor(() => expect(addProject).toHaveBeenCalledWith(
      expect.objectContaining({ clientId: undefined, clientName: "Cliente Digitado Na Mão" }),
    ));
  });
});
