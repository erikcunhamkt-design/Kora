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

  it("does not render if workspace is missing", () => {
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

  it("renders quote details and badge", async () => {
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

  it("incidente #5 (pendência 1) — status 'enviado' também mostra os botões Aprovar/Rejeitar", () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "enviado" })],
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

  it("clicar Aprovar (master flag ON por padrão) chama quotesRepository.updateStatus('aprovado'), nunca approveQuote", async () => {
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

  // Pacote do Flip (Fase C) — master flag virou opt-out (default ON). Os 2
  // testes abaixo substituem o da Fatia 10 (que assumia default OFF sem
  // nenhuma flag setada). Nenhum teste do estado antigo sobrevive passando
  // por acidente (precisão 1 do revisor).
  it("sem nenhuma flag setada (default pós-flip): Aprovar já abre o diálogo de confirmação", async () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);
    fireEvent.click(screen.getByText("Aprovar"));

    expect(await screen.findByText("Aprovar orçamento")).toBeInTheDocument();
  });

  it("master flag explicitamente OFF: clicar Aprovar não abre o diálogo de confirmação", () => {
    localStorage.setItem("kora.quotes.supabaseWrite.enabled", "false");
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);
    fireEvent.click(screen.getByText("Aprovar"));

    expect(screen.queryByText("Aprovar orçamento")).not.toBeInTheDocument();
    expect(quotesRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("flag legada quotesSupabaseApproval não tem mais efeito — master flag OFF continua bloqueando mesmo com ela ligada", () => {
    localStorage.setItem("kora.quotes.supabaseWrite.enabled", "false");
    localStorage.setItem("kora.quotes.supabaseApproval.enabled", "true");
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);
    fireEvent.click(screen.getByText("Aprovar"));

    expect(screen.queryByText("Aprovar orçamento")).not.toBeInTheDocument();
  });
});

describe("SupabaseQuotesViewerCard · G19 — data de validade lia campo inexistente (quote.validUntil, sempre undefined)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    });
  });

  it("mostra a data de validade calculada (createdAt + validityDays) quando o orçamento tem prazo", () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ createdAt: "2024-01-01T00:00:00Z", validityDays: 15 })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);

    expect(screen.getByText(/Validade:/)).toBeInTheDocument();
  });

  it("não mostra 'Validade' quando o orçamento não tem validityDays definido", () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [baseQuote({ validityDays: 0 })],
      loading: false, error: null, refresh: vi.fn(),
    } as never);

    render(<SupabaseQuotesViewerCard />);

    expect(screen.queryByText(/Validade:/)).not.toBeInTheDocument();
  });
});