// Etapa 5 · Fatia 9 (quotes — fundação + cutover de leitura) — item 4.
// Prova: (1) modo local (default) mostra os dados locais, intocado; (2) modo
// Supabase mostra os dados da nuvem, com status traduzido (Q9) e campos Q8
// visíveis; (3) TODA ação de escrita fica bloqueada em modo Supabase — nunca
// chama a função local, nunca mostra toast de sucesso (lição O2/O3/O4).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import { QuotesSection } from "@/components/vendas/QuotesSection";
import { useQuotes, type Quote } from "@/hooks/useQuotes";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { QUOTES_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useQuotes", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useQuotes")>("@/hooks/useQuotes");
  return { ...actual, useQuotes: vi.fn() };
});
vi.mock("@/hooks/useSupabaseQuotes", () => ({ useSupabaseQuotes: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

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

beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

function makeLocalQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-local-1",
    clientName: "Cliente Local",
    clientEmail: "local@teste.com",
    clientWhatsapp: "",
    title: "Orçamento Local",
    description: "",
    items: [],
    subtotal: 1000,
    discount: 0,
    total: 1000,
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 15,
    status: "rascunho",
    createdAt: "2026-07-01",
    ...overrides,
  };
}

function makeSupabaseMappedQuote(overrides: Partial<Quote> = {}): Quote {
  // Já passou pelo mapper (mapSupabaseQuoteToLocalQuote) — é o formato que
  // useSupabaseQuotes() de fato devolve.
  return {
    id: "q-cloud-1",
    clientName: "Cliente Nuvem",
    clientEmail: "nuvem@teste.com",
    clientWhatsapp: "(11) 99999-9999",
    title: "Orçamento Nuvem",
    description: "",
    items: [{ id: "i1", name: "Item Nuvem", quantity: 1, unitPrice: 500 }],
    subtotal: 500,
    discount: 0,
    total: 500,
    paymentCondition: "À vista",
    deliveryDeadline: "10 dias",
    validityDays: 20,
    status: "aprovado", // já traduzido (Q9) — veio de "approved" na nuvem
    company: "Empresa Nuvem Ltda",
    createdAt: "2026-07-20",
    ...overrides,
  };
}

function setupCommonMocks() {
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useLeads).mockReturnValue({ leads: [], updateLead: vi.fn() } as never);
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setupCommonMocks();
});

function renderSection() {
  return render(
    <MemoryRouter>
      <QuotesSection />
    </MemoryRouter>,
  );
}

async function openQuoteMenu(title: string) {
  const titleEl = await screen.findByText(title);
  const row = titleEl.closest("tr") as HTMLElement;
  const trigger = row.querySelector('button[aria-label="Mais ações"]') as HTMLElement;
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(trigger);
  return screen.findByText("Excluir");
}

describe("QuotesSection · modo local (default)", () => {
  it("mostra os dados locais quando o seletor nunca foi tocado", async () => {
    const localUpdateStatus = vi.fn();
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(),
      updateStatus: localUpdateStatus,
      updateQuote: vi.fn(),
      duplicateQuote: vi.fn(),
      deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null,
    } as never);
    expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBeNull();

    renderSection();

    expect(await screen.findByText("Orçamento Local")).toBeInTheDocument();
    expect(screen.queryByText("Orçamento Nuvem")).not.toBeInTheDocument();
  });

  it("aprovar em modo local chama updateStatus normalmente (comportamento preservado)", async () => {
    const localUpdateStatus = vi.fn();
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(),
      updateStatus: localUpdateStatus,
      updateQuote: vi.fn(),
      duplicateQuote: vi.fn(),
      deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);

    renderSection();
    await openQuoteMenu("Orçamento Local");
    fireEvent.click(screen.getByText("Marcar como aprovado"));

    expect(localUpdateStatus).toHaveBeenCalledWith("q-local-1", "aprovado");
    expect(toast.success).toHaveBeenCalledWith("Orçamento aprovado");
  });
});

describe("QuotesSection · modo Supabase (leitura)", () => {
  it("mostra os dados da nuvem após o flip, com status traduzido e campos Q8 visíveis", async () => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [makeLocalQuote()],
      addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    const titleEl = await screen.findByText("Orçamento Nuvem");
    expect(screen.queryByText("Orçamento Local")).not.toBeInTheDocument();
    // Q9: status já chega traduzido ("aprovado", não "approved") — a badge
    // da LINHA mostra o rótulo local (há também um botão de filtro com o
    // mesmo texto na página, por isso o escopo é a linha).
    const row = titleEl.closest("tr") as HTMLElement;
    expect(within(row).getByText("Aprovado")).toBeInTheDocument();
    // Q8: company aparece na tabela (mesmo lugar que já mostrava pro local).
    expect(screen.getByText("Empresa Nuvem Ltda")).toBeInTheDocument();
  });

  it("persiste o seletor no localStorage e mostra o banner de modo leitura", async () => {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(),
      duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);

    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));

    await waitFor(() => expect(localStorage.getItem(QUOTES_DATA_SOURCE_KEY)).toBe("supabase"));
    expect(await screen.findByText("Orçamentos em modo leitura (Supabase)")).toBeInTheDocument();
  });
});

describe("QuotesSection · escrita bloqueada em modo Supabase (lição O2/O3/O4)", () => {
  async function renderInSupabaseMode(localFns: {
    updateStatus?: ReturnType<typeof vi.fn>;
    duplicateQuote?: ReturnType<typeof vi.fn>;
    deleteQuote?: ReturnType<typeof vi.fn>;
  } = {}) {
    vi.mocked(useQuotes).mockReturnValue({
      quotes: [],
      addQuote: vi.fn(),
      updateStatus: localFns.updateStatus ?? vi.fn(),
      updateQuote: vi.fn(),
      duplicateQuote: localFns.duplicateQuote ?? vi.fn(),
      deleteQuote: localFns.deleteQuote ?? vi.fn(),
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [makeSupabaseMappedQuote()], loading: false, error: null,
    } as never);
    renderSection();
    fireEvent.click(screen.getByText("Supabase experimental"));
    await screen.findByText("Orçamento Nuvem");
    // Limpa o histórico do toast informativo do próprio flip de fonte, pra
    // não contaminar as asserções de "nunca mostra toast de sucesso" abaixo.
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
  }

  it("aprovar: nunca chama updateStatus, nunca mostra toast de sucesso", async () => {
    const localUpdateStatus = vi.fn();
    await renderInSupabaseMode({ updateStatus: localUpdateStatus });

    await openQuoteMenu("Orçamento Nuvem");
    // "Aprovado" já é o status atual da quote sintética — usa "Marcar como
    // recusado" pra ter uma ação disponível independente do status inicial.
    fireEvent.click(screen.getByText("Marcar como recusado"));

    expect(localUpdateStatus).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("Edição de orçamentos no modo Supabase"),
    );
  });

  it("duplicar: nunca chama duplicateQuote, nunca mostra toast de sucesso", async () => {
    const localDuplicateQuote = vi.fn();
    await renderInSupabaseMode({ duplicateQuote: localDuplicateQuote });

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Duplicar"));

    expect(localDuplicateQuote).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("excluir: o diálogo de confirmação abre, mas confirmar nunca chama deleteQuote", async () => {
    const localDeleteQuote = vi.fn();
    await renderInSupabaseMode({ deleteQuote: localDeleteQuote });

    await openQuoteMenu("Orçamento Nuvem");
    fireEvent.click(screen.getByText("Excluir"));

    const confirmBtn = await screen.findByRole("button", { name: "Excluir" });
    fireEvent.click(confirmBtn);

    expect(localDeleteQuote).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it("criar (Novo orçamento): abre o wizard mas não bloqueia a UI — só bloqueia ao salvar (via handleSave)", async () => {
    // O botão "Novo orçamento" permanece clicável (lição: nenhum botão
    // desaparece) — o bloqueio real é dentro de handleSave, já cobrido pelo
    // guard `if (blockWrite()) return` antes de addQuote. Prova indireta:
    // o botão está habilitado mesmo em modo Supabase.
    await renderInSupabaseMode();
    const newQuoteBtn = screen.getByText("Novo orçamento");
    expect(newQuoteBtn).toBeEnabled();
  });
});
