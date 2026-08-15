// Resgate do dashboard órfão (irmão do G16) — Fase C, rodada `dashboard-orfao-fase-c`.
// SupabaseOperationalDashboardCard era importado em Configuracoes.tsx mas nunca
// renderizado (removido deliberadamente em 77f479c, "end-client safety", sem que o
// toggle reintroduzido em 8d017f4 fosse reconectado a ele). Reconectado após
// revalidação de schema (achado G20, ver docs/architecture/kora-hub-auditoria-e-plano.md).
//
// Este teste prova o gate próprio do card pela flag `supabaseOperationalDashboard`
// (kora.supabase.operationalDashboard.enabled) — ligada/desligada, sem depender de
// Configuracoes.tsx inteiro.
import { render, screen, fireEvent, within } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { SupabaseOperationalDashboardCard } from "@/components/settings/SupabaseOperationalDashboardCard";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useSupabaseFinancialSummary } from "@/hooks/useSupabaseFinancialSummary";
import { useSupabaseProjectsSummary } from "@/hooks/useSupabaseProjectsSummary";
import { useSupabaseProjectTasks } from "@/hooks/useSupabaseProjectTasks";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseOpportunities");
vi.mock("@/hooks/useSupabaseQuotes");
vi.mock("@/hooks/useSupabaseFinancialSummary");
vi.mock("@/hooks/useSupabaseProjectsSummary");
vi.mock("@/hooks/useSupabaseProjectTasks");

const mockWorkspace = {
  id: "ws-1", name: "QA Workspace", slug: "qa-workspace", owner_id: "owner-1",
  created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  currency: "BRL", locale: "pt-BR", timezone: null,
};

const FLAG_KEY = "kora.supabase.operationalDashboard.enabled";

describe("SupabaseOperationalDashboardCard — gate pela flag supabaseOperationalDashboard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    } as never);
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseFinancialSummary).mockReturnValue({
      receivables: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({
      projects: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
  });

  it("flag desligada (default): mostra o placeholder, nunca o painel de dados", () => {
    render(<SupabaseOperationalDashboardCard />);

    expect(screen.getByText(/Painel desativado experimentalmente/)).toBeInTheDocument();
    expect(screen.queryByText("Relações do Fluxo Comercial")).not.toBeInTheDocument();
  });

  it("flag ligada: mostra o painel de dados real, não o placeholder", () => {
    localStorage.setItem(FLAG_KEY, "true");

    render(<SupabaseOperationalDashboardCard />);

    expect(screen.getByText("Relações do Fluxo Comercial")).toBeInTheDocument();
    expect(screen.queryByText(/Painel desativado experimentalmente/)).not.toBeInTheDocument();
  });

  it("flag ligada: reconciliação conta oportunidade com orçamento vinculado", () => {
    localStorage.setItem(FLAG_KEY, "true");
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [{ id: "o1", status: "open", quote_id: "q1" }],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseOperationalDashboardCard />);

    const row = screen.getByText("Oportunidades com orçamento vinculado").closest("div");
    expect(row).toHaveTextContent("1");
  });
});

// R1 (docs/qa/tarefas-r2-auditoria.md §2.2) — updateTaskStatus/dropdown só
// cobriam todo/in_progress/done; "revisão" (4º valor real, useTasks.ts) não
// tinha pra onde ir na transição de status deste painel experimental.
describe("SupabaseOperationalDashboardCard · ProjectTasksList — R1, vocabulário dos 4 estados", () => {
  const mockProject = {
    id: "proj-1", workspace_id: "ws-1", title: "Projeto X", status: "in_progress",
    is_demo: false, archived: false, created_at: "", updated_at: "",
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    localStorage.setItem(FLAG_KEY, "true");
    localStorage.setItem("kora.tasks.supabaseStatusTransition.enabled", "true");

    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    } as never);
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseFinancialSummary).mockReturnValue({
      receivables: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({
      projects: [mockProject], loading: false, error: null, refresh: vi.fn(),
    } as never);
  });

  async function renderWithTaskAtStatus(status: string, updateStatus = vi.fn()) {
    vi.mocked(useSupabaseProjectTasks).mockReturnValue({
      tasks: [{
        id: "tk-1", workspace_id: "ws-1", project_id: "proj-1", title: "Revisar escopo",
        status, priority: "medium", source: "manual", sort_order: 0,
        is_demo: false, archived: false, created_at: "", updated_at: "",
      }],
      loading: false, error: null, refresh: vi.fn(), updateStatus,
    } as never);

    render(<SupabaseOperationalDashboardCard />);
    fireEvent.click(screen.getByText("Ver tarefas"));
    return screen.findByText("Revisar escopo");
  }

  it("o dropdown de status oferece as 4 opções, incluindo Revisão", async () => {
    await renderWithTaskAtStatus("a_fazer");

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = within(select).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(options).toEqual(["a_fazer", "em_andamento", "revisao", "concluido"]);
    expect(screen.getByRole("option", { name: "Revisão" })).toBeInTheDocument();
  });

  it("uma tarefa já em revisão aparece selecionada no dropdown — não fica em branco/não-casada", async () => {
    await renderWithTaskAtStatus("revisao");

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("revisao");
  });

  it("selecionar Revisão chama updateStatus(taskId, \"revisao\") — vocabulário local, sem tradução", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    await renderWithTaskAtStatus("a_fazer", updateStatus);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "revisao" } });

    expect(updateStatus).toHaveBeenCalledWith("tk-1", "revisao");
  });
});
