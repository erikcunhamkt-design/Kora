// Vitest test for SupabaseQuotesViewerCard component and logic
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupabaseQuotesViewerCard } from "@/components/settings/SupabaseQuotesViewerCard";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock hooks
vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useSupabaseQuotes");

describe("SupabaseQuotesViewerCard - QA Scenarios", () => {
  const mockRefresh = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("does not render if workspace is missing or experimental flag is false", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false });
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [],
      loading: false,
      error: null,
      refresh: mockRefresh,
      createQuote: vi.fn(),
      updateQuote: vi.fn(),
      archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(),
      replaceQuoteItems: vi.fn(),
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
      workspace: { id: "ws-1", name: "Test Workspace" },
      membership: null,
      loading: false,
    });

    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [
        {
          id: "supabase-uuid-123",
          title: "Orçamento de Teste",
          clientName: "Cliente QA",
          clientEmail: "qa@kora.com",
          total: 1500.50,
          status: "rascunho",
          items: [],
        } as unknown as Parameters<typeof SupabaseQuotesViewerCard>[0] // typecasted to bypass any type lint

      ],
      loading: false,
      error: null,
      refresh: mockRefresh,
      createQuote: vi.fn(),
      updateQuote: vi.fn(),
      archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(),
      replaceQuoteItems: vi.fn(),
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
