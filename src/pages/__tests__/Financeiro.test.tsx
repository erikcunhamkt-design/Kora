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
import { FINANCE_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseFinanceWriteFlag";
import type { SupabaseFinancialTransaction } from "@/repositories/financeRepository";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/repositories/financeRepository", () => ({
  financeRepository: {
    listTransactions: vi.fn(),
    importTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    softDeleteReceivable: vi.fn(),
  },
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

// Radix DropdownMenu (v2) abre no `pointerdown`, não no `click` — e este
// jsdom não implementa `PointerEvent` (typeof window.PointerEvent ===
// "undefined"), então fireEvent.pointerDown cairia num MouseEvent genérico
// sem os campos que o handler do Radix lê. Mesmo polyfill de CRM.test.tsx —
// precisa aqui pela primeira vez nesta suíte porque o painel de ações do
// Supabase (Fase B) é o primeiro DropdownMenu de Financeiro.tsx exercitado
// via clique num teste.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfill de teste, jsdom não implementa PointerEvent.
  window.PointerEvent = PointerEventPolyfill;
}

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

  // Fase B (Pacote do Flip, item 2/§2 do desenho) — useSupabaseFinanceTransactions()
  // sobe pro topo de Financeiro (G32 da casa, mesmo padrão de
  // useSupabaseProjects()/useSupabaseQuotes() em ProjectsSection.tsx/
  // QuotesSection.tsx: o hook busca em paralelo sempre, só o seletor decide
  // qual resultado a tela EXIBE) — precisa estar pronto pra escrita
  // (create/update/delete) assim que a flag ligar, sem esperar uma
  // remontagem do painel. A UI (banner/painel) continua só aparecendo em
  // modo Supabase — ver teste acima ("sem o painel/banner Supabase").
  it("financeRepository.listTransactions É chamado mesmo em modo local (Fase B, G32 — busca paralela, só a UI decide o que exibir)", async () => {
    renderPage();
    await waitFor(() => expect(financeRepository.listTransactions).toHaveBeenCalled());
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

// Etapa 5 · Financeiro Fase B (Pacote do Flip, item 2/§2 do desenho) —
// escrita real quando useSupabaseFinanceWriteFlag está ligada
// (kora.finance.supabaseWrite.enabled). Prova fail->fix->pass: rodar estes
// testes contra o código PRÉ-Fase B (blockWrite() incondicional, painel
// genuinamente read-only) falha todos — blockWrite() sempre bloqueava e o
// painel não tinha coluna de Ações nenhuma.
describe("Financeiro · escrita real com a flag ligada (Fase B, §2 do desenho)", () => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

  async function switchToSupabaseWithWrite() {
    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "true");
    renderPage();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText(/Transações operacionais \(Supabase\)/);
  }

  function pickCategory(name: string) {
    const trigger = screen.getByText("Selecione");
    fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByText(name));
  }

  it("com a flag ligada, \"Venda rápida\" abre o diálogo normalmente — blockWrite() não bloqueia mais", async () => {
    await switchToSupabaseWithWrite();

    fireEvent.click(screen.getByText("Venda rápida"));

    expect(document.querySelector('[role="dialog"]')).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("criar uma venda em modo Supabase (flag ligada) grava via financeRepository.importTransaction — nunca no addTransaction local", async () => {
    vi.mocked(financeRepository.importTransaction).mockResolvedValue({
      id: "sft-new", workspace_id: "ws1", type: "receivable", status: "pending",
      title: "Venda nuvem", amount: 250, source: "sale", is_demo: false, archived: false,
      created_at: "2026-08-15T00:00:00Z", updated_at: "2026-08-15T00:00:00Z",
    } as never);
    await switchToSupabaseWithWrite();

    fireEvent.click(screen.getByText("Venda rápida"));
    fireEvent.change(screen.getByPlaceholderText("Ex: Projeto de branding"), { target: { value: "Venda nuvem" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "250" } });
    pickCategory("Serviços");
    fireEvent.click(screen.getByRole("button", { name: "Registrar venda" }));

    await waitFor(() => expect(financeRepository.importTransaction).toHaveBeenCalledWith(
      "ws1",
      expect.stringContaining("native:"),
      expect.objectContaining({ type: "receivable", title: "Venda nuvem", amount: 250, category: "Serviços" }),
    ));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Venda registrada na nuvem"));
  });

  it("escolher \"Recorrente\" em modo Supabase avisa (post-flip gap) mas NÃO bloqueia a criação — §1.2 do desenho", async () => {
    vi.mocked(financeRepository.importTransaction).mockResolvedValue({
      id: "sft-new2", workspace_id: "ws1", type: "receivable", status: "pending",
      title: "Venda recorrente", amount: 100, source: "sale", is_demo: false, archived: false,
      created_at: "2026-08-15T00:00:00Z", updated_at: "2026-08-15T00:00:00Z",
    } as never);
    await switchToSupabaseWithWrite();

    fireEvent.click(screen.getByText("Venda rápida"));
    fireEvent.change(screen.getByPlaceholderText("Ex: Projeto de branding"), { target: { value: "Venda recorrente" } });
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "100" } });
    pickCategory("Serviços");
    fireEvent.click(screen.getByText("À vista"));
    fireEvent.click(screen.getByText("Recorrente"));
    fireEvent.click(screen.getByRole("button", { name: "Registrar venda" }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(expect.stringContaining("Recorrência ainda não é gravada")));
    await waitFor(() => expect(financeRepository.importTransaction).toHaveBeenCalled());
  });

  it("painel ganha coluna \"Ações\" quando a flag está ligada (some quando desligada)", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([makeRow()]);
    await switchToSupabaseWithWrite();

    expect(await screen.findByText("Recebível Nuvem X")).toBeInTheDocument();
    expect(screen.getByText("Ações")).toBeInTheDocument();
  });

  it("painel NÃO tem coluna \"Ações\" quando a flag está desligada (comportamento Fatia N preservado)", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([makeRow()]);
    renderPage();
    fireEvent.click(screen.getByText("Supabase experimental"));

    expect(await screen.findByText("Recebível Nuvem X")).toBeInTheDocument();
    expect(screen.queryByText("Ações")).not.toBeInTheDocument();
  });

  // G52 — marcar como pago via setStatus() enviava só {status:"paid"},
  // deixando paid_at NULL na nuvem (dado de "quando pagou" perdido em
  // silêncio). Espelha a semântica local de updateTransactionStatus
  // (useFinance.ts:265): transição PRA "paid" grava paid_at = hoje.
  it("marcar como pago no painel chama financeRepository.updateTransaction com paid_at preenchido (G52 — G30 preservado, a própria resposta atualiza a linha)", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([makeRow()]);
    vi.mocked(financeRepository.updateTransaction).mockResolvedValue(makeRow({ status: "paid" }) as never);
    await switchToSupabaseWithWrite();
    await screen.findByText("Recebível Nuvem X");

    const trigger1 = screen.getByRole("button", { name: "Ações" });
    fireEvent.pointerDown(trigger1, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(trigger1, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(trigger1);
    fireEvent.click(await screen.findByText("Marcar como recebido"));

    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => expect(financeRepository.updateTransaction).toHaveBeenCalledWith("ws1", "sft-1", { status: "paid", paid_at: today }));
    expect(financeRepository.listTransactions).toHaveBeenCalledTimes(1);
  });

  // G52 — o lado inverso: cancelar (ou qualquer transição PRA FORA de
  // "paid") NUNCA deve enviar paid_at (nem null, nem qualquer valor) — um
  // UPDATE parcial sem a chave deixa a coluna intocada na nuvem, mesmo
  // efeito de `t.paidDate` (mantém o valor anterior) no updateTransactionStatus
  // local. Provar que um NULL explícito não sobrescreveria indevidamente um
  // paid_at já existente.
  it("cancelar no painel NUNCA envia paid_at — nem null, nem sobrescreve o que já existia (G52, o lado inverso)", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([makeRow({ status: "paid", paid_at: "2026-08-01" })]);
    vi.mocked(financeRepository.updateTransaction).mockResolvedValue(makeRow({ status: "canceled", paid_at: "2026-08-01" }) as never);
    await switchToSupabaseWithWrite();
    await screen.findByText("Recebível Nuvem X");

    const trigger1 = screen.getByRole("button", { name: "Ações" });
    fireEvent.pointerDown(trigger1, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(trigger1, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(trigger1);
    fireEvent.click(await screen.findByText("Cancelar"));

    await waitFor(() => expect(financeRepository.updateTransaction).toHaveBeenCalledWith("ws1", "sft-1", { status: "canceled" }));
    const patchArg = vi.mocked(financeRepository.updateTransaction).mock.calls[0][2];
    expect(patchArg).not.toHaveProperty("paid_at");
  });

  it("excluir no painel chama financeRepository.softDeleteReceivable e a linha some", async () => {
    vi.mocked(financeRepository.listTransactions).mockResolvedValue([makeRow()]);
    vi.mocked(financeRepository.softDeleteReceivable).mockResolvedValue(makeRow() as never);
    await switchToSupabaseWithWrite();
    await screen.findByText("Recebível Nuvem X");

    const trigger2 = screen.getByRole("button", { name: "Ações" });
    fireEvent.pointerDown(trigger2, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(trigger2, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(trigger2);
    fireEvent.click(await screen.findByText("Excluir"));

    await waitFor(() => expect(financeRepository.softDeleteReceivable).toHaveBeenCalledWith("ws1", "sft-1"));
    await waitFor(() => expect(screen.queryByText("Recebível Nuvem X")).not.toBeInTheDocument());
  });
});
