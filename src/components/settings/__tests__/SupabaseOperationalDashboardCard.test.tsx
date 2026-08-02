// Resgate do dashboard órfão (irmão do G16) — Fase C, rodada `dashboard-orfao-fase-c`.
// SupabaseOperationalDashboardCard era importado em Configuracoes.tsx mas nunca
// renderizado (removido deliberadamente em 77f479c, "end-client safety", sem que o
// toggle reintroduzido em 8d017f4 fosse reconectado a ele). Reconectado após
// revalidação de schema (achado G20, ver docs/architecture/kora-hub-auditoria-e-plano.md).
//
// Este teste prova o gate próprio do card pela flag `supabaseOperationalDashboard`
// (kora.supabase.operationalDashboard.enabled) — ligada/desligada, sem depender de
// Configuracoes.tsx inteiro.
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { SupabaseOperationalDashboardCard } from "@/components/settings/SupabaseOperationalDashboardCard";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useSupabaseFinancialSummary } from "@/hooks/useSupabaseFinancialSummary";
import { useSupabaseProjectsSummary } from "@/hooks/useSupabaseProjectsSummary";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseOpportunities");
vi.mock("@/hooks/useSupabaseQuotes");
vi.mock("@/hooks/useSupabaseFinancialSummary");
vi.mock("@/hooks/useSupabaseProjectsSummary");

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
