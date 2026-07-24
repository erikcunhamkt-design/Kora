import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LinkedQuotesSection } from "@/components/crm/LinkedQuotesSection";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseOpportunityQuotes } from "@/hooks/useSupabaseOpportunityQuotes";
import type { Quote } from "@/hooks/useQuotes";
import { vi, describe, it, expect, beforeEach } from "vitest";

// LinkedQuotesSection.tsx itself does `(quote.status as string) === "approved"/
// "draft"/"rejected"` — the Supabase-backed quotes it renders actually carry
// the raw English Supabase status, not the local Quote.status: QuoteStatus
// (Portuguese) union. This type mirrors that reality for the fixture below.
type TestSupabaseBackedQuote = Omit<Quote, "status"> & { status: string };

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseOpportunityQuotes");

describe("LinkedQuotesSection - QA Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state correctly", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: {
        id: "ws-1",
        name: "QA Workspace",
        slug: "qa-workspace",
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

    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(screen.getByText("Nenhum orçamento vinculado a esta oportunidade ainda.")).toBeInTheDocument();
  });

  it("renders list of linked quotes in read-only mode", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: {
        id: "ws-1",
        name: "QA Workspace",
        slug: "qa-workspace",
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

    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [
        {
          id: "q-1",
          title: "Proposal Alpha",
          clientName: "John Doe",
          clientEmail: "john@example.com",
          clientWhatsapp: "",
          description: "",
          total: 3500.00,
          status: "draft",
          items: [],
          subtotal: 3500,
          discount: 0,
          paymentCondition: "",
          deliveryDeadline: "",
          validityDays: 0,
          createdAt: "2026-06-01T00:00:00Z",
        } as TestSupabaseBackedQuote as unknown as Quote,
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    });

    render(<LinkedQuotesSection opportunityId="opp-uuid-123" />);

    expect(screen.getByText("Proposal Alpha")).toBeInTheDocument();
    expect(screen.getByText(/R\$ 3\.500,00/)).toBeInTheDocument();
    expect(screen.getByText("Supabase")).toBeInTheDocument();
    expect(screen.getByText("draft")).toBeInTheDocument();
  });
});