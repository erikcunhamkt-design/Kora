// @ts-nocheck
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LinkedQuotesSection } from "@/components/crm/LinkedQuotesSection";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseOpportunityQuotes } from "@/hooks/useSupabaseOpportunityQuotes";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseOpportunityQuotes");

describe("LinkedQuotesSection - QA Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state correctly", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: { id: "ws-1", name: "QA Workspace" },
      membership: null,
      loading: false,
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
      workspace: { id: "ws-1", name: "QA Workspace" },
      membership: null,
      loading: false,
    });

    vi.mocked(useSupabaseOpportunityQuotes).mockReturnValue({
      quotes: [
        {
          id: "q-1",
          title: "Proposal Alpha",
          clientName: "John Doe",
          clientEmail: "john@example.com",
          total: 3500.00,
          status: "draft",
          items: [],
          subtotal: 3500,
          discount: 0,
          createdAt: "2026-06-01T00:00:00Z",
        } as unknown as Parameters<typeof LinkedQuotesSection>[0] // typed to satisfy no-explicit-any linter rules

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