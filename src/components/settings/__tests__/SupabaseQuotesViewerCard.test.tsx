// Vitest test for SupabaseQuotesViewerCard component and logic
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseQuotesViewerCard } from "@/components/settings/SupabaseQuotesViewerCard";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { quotesRepository } from "@/repositories/quotesRepository";
import type { Quote } from "@/hooks/useQuotes";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock hooks
vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseQuotes");
vi.mock("@/repositories/quotesRepository");

const mockWorkspace = {
  id: "ws-1",
  name: "Test Workspace",
  slug: "test-workspace",
  owner_id: "owner-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  currency: "BRL",
  locale: "pt-BR",
  timezone: null,
};

function baseQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "supabase-uuid-123",
    title: "Orçamento de Teste",
    clientName: "Cliente QA",
    clientEmail: "qa@kora.com",
    clientWhatsapp: "",
    description: "",
    total: 1500.5,
    status: "rascunho",
    items: [],
    subtotal: 1500.5,
    discount: 0,
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 0,
    createdAt: "2024-01-01T00:00:00Z",
    ...overrides,
  } as Quote;
}

describe("SupabaseQuotesViewerCard - QA Scenarios", () => {
  const mockRefresh = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not render if workspace is missing or experimental flag is false", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null });
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [],
      loading: false,
      error: null,
      refresh: mockRefresh,
      createQuoteWithItems: vi.fn(),
      updateQuote: vi.fn(),
      archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(),
      replaceQuoteItems: vi.fn(),
      updateStatus: vi.fn(),
    });

    const { container } = render(<SupabaseQuotesViewerCard />);
    expect(container.firstChild).toBeNull();
  });

  it("renders quote details and badge when flag is true", async () => {
    // Enable flag
    localStorage.setItem("kora.quotes.supabaseExperimental.enabled", "true");
    
    // Set metadata for 'Importado do local' check
    const mockMeta = {
      importedMap: {
        "local-123": "supabase-uuid-123"
      }
    };
    localStorage.setItem("kora.quotes.supabaseImport.v1", JSON.stringify(mockMeta));

    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: {
        id: "ws-1",
        name: "Test Workspace",
        slug: "test-workspace",
        owner_id: "owner-1",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        currency: "BRL",
        locale: "pt-BR",
        timezone: null,
      },
      membership: null,
      loading: false,
      error: null,
    });

    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [
        {
          id: "supabase-uuid-123",
          title: "Orçamento de Teste",
          clientName: "Cliente QA",
          clientEmail: "qa@kora.com",
          clientWhatsapp: "",
          description: "",
          total: 1500.50,
          status: "rascunho",
          items: [],
          subtotal: 1500.50,
          discount: 0,
          paymentCondition: "",
          deliveryDeadline: "",
          validityDays: 0,
          createdAt: "2024-01-01T00:00:00Z",
        } as Quote,
      ],
      loading: false,
      error: null,
      refresh: mockRefresh,
      createQuoteWithItems: vi.fn(),
      updateQuote: vi.fn(),
      archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(),
      replaceQuoteItems: vi.fn(),
      updateStatus: vi.fn(),
    });

    render(<SupabaseQuotesViewerCard />);

    // Verify fields
    expect(screen.getByText("Orçamento de Teste")).toBeInTheDocument();
    expect(screen.getByText(/Cliente QA/)).toBeInTheDocument();
    expect(screen.getByText(/R\$ 1\.500,50/)).toBeInTheDocument();
    
    // Check badges
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("Importado do local")).toBeInTheDocument();
  });
});

describe("SupabaseQuotesViewerCard · item 6 (Fatia 10) — comparação de status corrigida (era 'draft'/'approved' em inglês)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    localStorage.setItem("kora.quotes.supabaseExperimental.enabled", "true");
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    });
  });

  it("status 'rascunho' (já traduzido pelo mapper) mostra os botões Aprovar/Rejeitar", () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);

    expect(screen.getByText("Aprovar")).toBeInTheDocument();
    expect(screen.getByText("Rejeitar")).toBeInTheDocument();
  });

  it("status 'aprovado' mostra os botões Gerar recebível/Gerar projeto, não Aprovar/Rejeitar", () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "aprovado" })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);

    expect(screen.queryByText("Aprovar")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejeitar")).not.toBeInTheDocument();
    expect(screen.getByText("Gerar recebível")).toBeInTheDocument();
    expect(screen.getByText("Gerar projeto")).toBeInTheDocument();
  });

  it("clicar Aprovar (flag reachable) chama quotesRepository.updateStatus('aprovado'), nunca approveQuote", async () => {
    localStorage.setItem("kora.quotes.supabaseApproval.enabled", "true");
    const refresh = vi.fn();
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })],
      loading: false, error: null, refresh,
    } as never);
    vi.mocked(quotesRepository.updateStatus).mockResolvedValue({} as never);

    render(<SupabaseQuotesViewerCard />);
    fireEvent.click(screen.getByText("Aprovar"));
    fireEvent.click(await screen.findByText("Aprovar orçamento"));

    await waitFor(() =>
      expect(quotesRepository.updateStatus).toHaveBeenCalledWith("ws-1", "supabase-uuid-123", "aprovado"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("sem nenhuma das duas flags: clicar Aprovar não abre o diálogo de confirmação (toast informativo)", () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);
    fireEvent.click(screen.getByText("Aprovar"));

    expect(screen.queryByText("Aprovar orçamento")).not.toBeInTheDocument();
    expect(quotesRepository.updateStatus).not.toHaveBeenCalled();
  });
});

describe("SupabaseQuotesViewerCard · incidente #2 (Fatia 10, Fase D, achado 5a) — flag reage sem F5", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh: vi.fn(),
      createQuoteWithItems: vi.fn(), updateQuote: vi.fn(), archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(), replaceQuoteItems: vi.fn(), updateStatus: vi.fn(),
    } as never);
  });

  it("liga a flag depois do mount (mesmo evento 'storage' que o toggle card já dispara) e o card passa a renderizar, sem precisar de F5", async () => {
    // Flag desligada no mount — card não aparece (mesmo comportamento de antes).
    render(<SupabaseQuotesViewerCard />);
    expect(screen.queryByText("Orçamentos no Supabase (Experimental)")).not.toBeInTheDocument();

    // QuotesSupabaseExperimentalToggleCard.tsx liga a flag e dispara exatamente
    // este evento (window.dispatchEvent(new Event("storage"))) — sem F5. Antes
    // da correção, ninguém escutava e o card nunca aparecia (achado 5a).
    localStorage.setItem("kora.quotes.supabaseExperimental.enabled", "true");
    fireEvent(window, new Event("storage"));

    expect(await screen.findByText("Orçamentos no Supabase (Experimental)")).toBeInTheDocument();
  });
});