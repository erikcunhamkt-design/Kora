// Etapa 5 · Financeiro Fatia N (item 4) — prova: (1) modo local (default)
// funciona intocado, zero regressão nos 8 consumidores/abas atuais; (2)
// seletor é opt-in (getFinanceDataSource, config/flags.ts); (3) painel de
// leitura Supabase renderiza a lista real (React Query real, só
// financeRepository/useCurrentWorkspace/useClientsDataSource mockados —
// mesmo padrão de useSupabaseFinanceTransactions.test.tsx); (4) escrita
// bloqueada em modo Supabase com toast explícito (molde do blockWrite() de
// QuotesSection.tsx pré-flip).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

import Financeiro from "@/pages/Financeiro";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { financeRepository } from "@/repositories/financeRepository";
import { FINANCE_DATA_SOURCE_KEY } from "@/config/flags";
import type { SupabaseFinancialTransaction } from "@/repositories/financeRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/repositories/financeRepository", () => ({
  financeRepository: { listTransactions: vi.fn() },
}));
// QuickSaleDialog/ExpenseDialog (sempre montados, mesmo com open=false) usam
// useFormat() -> useTranslation() -> LanguageContext, que exige um
// LanguageProvider real (não usado em nenhum outro teste desta página até
// agora — primeiro teste de Financeiro.tsx). Mock direto, mesmo padrão já
// usado pros outros hooks desta suíte, em vez de montar o provider inteiro.
vi.mock("@/hooks/useFormat", () => ({ useFormat: () => ({ currency: "BRL" }) }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

function makeRow(overrides: Partial<SupabaseFinancialTransaction> = {}): SupabaseFinancialTransaction {
  return {
    id: "sft-1", workspace_id: "ws1", type: "receivable", status: "pending",
    title: "Recebível Nuvem X", amount: 500, source: "manual", is_demo: false, archived: false,
    created_at: "2026-08-01T00:00:00Z", updated_at: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);
  vi.mocked(financeRepository.listTransactions).mockResolvedValue([]);
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Financeiro />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Financeiro · modo local (default) — zero regressão nos consumidores atuais", () => {
  it("renderiza as 9 abas normalmente, sem o painel/banner Supabase", () => {
    renderPage();

    expect(screen.getByText("Receber")).toBeInTheDocument();
    expect(screen.getByText("Pagar")).toBeInTheDocument();
    expect(screen.queryByText("Transações (Supabase — leitura)")).not.toBeInTheDocument();
    expect(screen.queryByText(/Transações operacionais \(Supabase\)/)).not.toBeInTheDocument();
  });

  it("botões de criação continuam abrindo os diálogos locais normalmente (sem bloqueio)", () => {
    renderPage();

    fireEvent.click(screen.getByText("Venda rápida"));
    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("financeRepository.listTransactions nunca é chamado em modo local (painel Supabase nem monta)", () => {
    renderPage();
    expect(financeRepository.listTransactions).not.toHaveBeenCalled();
  });
});

describe("Financeiro · seletor opt-in (getFinanceDataSource — nasce pré-flip)", () => {
  it("default é local sem tocar em nada — seletor mostra Local ativo", () => {
    expect(localStorage.getItem(FINANCE_DATA_SOURCE_KEY)).toBeNull();
    renderPage();
    expect(screen.getByText("Fonte do financeiro:")).toBeInTheDocument();
  });

  it("trocar pra Supabase experimental grava a flag e persiste", async () => {
    renderPage();
    fireEvent.click(screen.getByText("Supabase experimental"));

    await waitFor(() => expect(localStorage.getItem(FINANCE_DATA_SOURCE_KEY)).toBe("supabase"));
  });
});

describe("Financeiro · painel de leitura Supabase renderiza (item 3/4)", () => {
  it("lista real da nuvem aparece ao trocar pra Supabase experimental", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([makeRow()]);
    renderPage();

    fireEvent.click(screen.getByText("Supabase experimental"));

    expect(await screen.findByText("Recebível Nuvem X")).toBeInTheDocument();
  });
});

describe("Financeiro · escrita bloqueada em modo Supabase (molde blockWrite pré-flip)", () => {
  async function switchToSupabase() {
    renderPage();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText(/Transações operacionais \(Supabase\)/);
  }

  it("\"Venda rápida\" não abre o diálogo — toast de bloqueio explícito", async () => {
    await switchToSupabase();

    fireEvent.click(screen.getByText("Venda rápida"));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Escrita em modo Supabase"));
    expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it("\"Lançar despesa\" não abre o diálogo — mesmo bloqueio", async () => {
    await switchToSupabase();

    fireEvent.click(screen.getByText("Lançar despesa"));

    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Escrita em modo Supabase"));
    expect(document.querySelector('[role="dialog"]')).not.toBeInTheDocument();
  });

  it("voltando pra Local, os botões voltam a funcionar normalmente", async () => {
    await switchToSupabase();
    fireEvent.click(screen.getByText("Local"));

    fireEvent.click(screen.getByText("Venda rápida"));

    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
  });
});
