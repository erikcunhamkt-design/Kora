import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LinkedQuotesSection } from "@/components/crm/LinkedQuotesSection";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseOpportunityQuotes } from "@/hooks/useSupabaseOpportunityQuotes";
import { quotesRepository } from "@/repositories/quotesRepository";
import { QUOTES_SUPABASE_WRITE_FLAG_KEY } from "@/hooks/useSupabaseQuotesWriteFlag";
import { BOOLEAN_FLAG_KEYS } from "@/config/flags";
import type { Quote } from "@/hooks/useQuotes";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Etapa 5 · Fatia 10 (item 7) — CORREÇÃO: as quotes que useSupabaseOpportunityQuotes
// devolve já passam por mapSupabaseQuoteToLocalQuote (Fatia 9) — carregam o status
// TRADUZIDO pro português ("rascunho"/"aprovado"/"recusado"), nunca o literal cru da
// nuvem ("draft"/"approved"/"rejected"). O teste anterior fixava "draft" (assumindo
// o contrário) — assumia um cenário que a leitura real nunca produz desde a Fatia 9,
// e mascarava o bug real corrigido neste item (comparações contra literais em inglês
// que nunca batiam).
vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseOpportunityQuotes");
vi.mock("@/repositories/quotesRepository");

const mockWorkspace = {
  id: "ws-1",
  name: "QA Workspace",
  slug: "qa-workspace",
  owner_id: "owner-1",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  currency: "BRL",
  locale: "pt-BR",
  timezone: null,
};

function baseQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "q-1",
    title: "Proposal Alpha",
    clientName: "John Doe",
    clientEmail: "john@example.com",
    clientWhatsapp: "",
    description: "",
    total: 3500.0,
    status: "rascunho",
    items: [],
    subtotal: 3500,
    discount: 0,
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 0,
    createdAt: "2026-06-01T00:00:00Z",
    ...overrides,
  } as Quote;
}

describe("LinkedQuotesSection - QA Scenarios", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    });
  });

  it("renders empty state correctly", () => {
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(screen.getByText("Nenhum orçamento vinculado a esta oportunidade ainda.")).toBeInTheDocument();
  });

  it("renders list of linked quotes in read-only mode, com o status já traduzido pro PT", () => {
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [baseQuote()], loading: false, error: null, refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(screen.getByText("Proposal Alpha")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 3\.500,00/)).toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("rascunho")).toBeInTheDocument();
  });
});

describe("LinkedQuotesSection · item 7 (Fatia 10) — comparação de status corrigida", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    });
  });

  it("status 'rascunho' mostra os botões Aprovar/Rejeitar", () => {
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })], loading: false, error: null, refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(screen.getByText("Aprovar")).toBeInTheDocument();
    expect(screen.getByText("Rejeitar")).toBeInTheDocument();
  });

  it("status 'aprovado' mostra Gerar recebível/Gerar projeto, não Aprovar/Rejeitar", () => {
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "aprovado" })], loading: false, error: null, refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(screen.queryByText("Aprovar")).not.toBeInTheDocument();
    expect(screen.queryByText("Rejeitar")).not.toBeInTheDocument();
    expect(screen.getByText("Gerar recebível")).toBeInTheDocument();
    expect(screen.getByText("Gerar projeto")).toBeInTheDocument();
  });

  it("clicar Aprovar (flag reachable) chama quotesRepository.updateStatus('aprovado'), nunca approveQuote", async () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    const refresh = vi.fn();
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })], loading: false, error: null, refresh,
    });
    vi.mocked(quotesRepository.updateStatus).mockResolvedValue({} as never);

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);
    fireEvent.click(screen.getByText("Aprovar"));
    fireEvent.click(await screen.findByText("Aprovar orçamento"));

    await waitFor(() =>
      expect(quotesRepository.updateStatus).toHaveBeenCalledWith("ws-1", "q-1", "aprovado"),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("sem nenhuma das duas flags: clicar Aprovar não abre o diálogo de confirmação", () => {
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })], loading: false, error: null, refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);
    fireEvent.click(screen.getByText("Aprovar"));

    expect(screen.queryByText("Aprovar orçamento")).not.toBeInTheDocument();
    expect(quotesRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("flag legada quotesSupabaseApproval sozinha (coexistência §8.1) ainda alcança aprovar/rejeitar", async () => {
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "true");
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [baseQuote({ status: "rascunho" })], loading: false, error: null, refresh: vi.fn(),
    });
    vi.mocked(quotesRepository.updateStatus).mockResolvedValue({} as never);

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);
    fireEvent.click(screen.getByText("Aprovar"));

    expect(await screen.findByText("Aprovar orçamento")).toBeInTheDocument();
  });
});

describe("LinkedQuotesSection · incidente #4 (Fatia 10, Fase D, achado 400) — refresh de mount espera o workspace resolver", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("workspace ainda resolvendo (null) no mount: NÃO chama refresh (evita o 400 de workspace_id vazio)", () => {
    const refresh = vi.fn();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: true, error: null,
    });
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh,
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(refresh).not.toHaveBeenCalled();
  });

  it("workspace resolve depois do mount: refresh é chamado só então, nunca antes", () => {
    const refresh = vi.fn();
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: null, membership: null, loading: true, error: null,
    });
    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh,
    });

    const { rerender } = render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);
    expect(refresh).not.toHaveBeenCalled();

    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    });
    rerender(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
