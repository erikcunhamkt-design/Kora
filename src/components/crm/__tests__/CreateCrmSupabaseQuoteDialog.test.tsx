import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCrmSupabaseQuoteDialog } from "@/components/crm/CreateCrmSupabaseQuoteDialog";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/repositories/quotesRepository");

const mockLead = {
  id: 123,
  name: "Cliente Teste QA",
  company: "Empresa QA",
  email: "qa@kora.com",
  phone: "11999999999",
  serviceType: "Design Digital",
  estimatedValue: 2500,
  stage: "proposta" as const,
  stageId: "proposta",
  pipelineId: "default",
  tags: [],
  history: [],
  notes: "Nota inicial",
  supabaseId: "opportunity-uuid-456",
  clientId: 999,
};

describe("CreateCrmSupabaseQuoteDialog - QA & Rollback", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("handles client mapping correctly and pre-fills form fields", () => {
    // Set client map in localStorage
    const clientMap = {
      importedMap: {
        "999": "client-uuid-789",
      },
    };
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify(clientMap));

    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: { id: "ws-1", name: "QA Workspace" },
      membership: null,
      loading: false,
    });

    render(
      <CreateCrmSupabaseQuoteDialog
        open={true}
        onOpenChange={vi.fn()}
        lead={mockLead}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Orçamento - Cliente Teste QA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Cliente Teste QA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Empresa QA")).toBeInTheDocument();
    expect(screen.getByDisplayValue("qa@kora.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("11999999999")).toBeInTheDocument();
  });

  it("triggers logical rollback (softDeleteQuote) if quote items creation fails", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: { id: "ws-1", name: "QA Workspace" },
      membership: null,
      loading: false,
    });

    // Mock createQuote success but items replacement failure
    vi.mocked(quotesRepository.createQuote).mockResolvedValue({ id: "quote-created-uuid-1" } as unknown as Parameters<typeof CreateCrmSupabaseQuoteDialog>[0]["lead"]);

    vi.mocked(quotesRepository.replaceQuoteItems).mockRejectedValue(new Error("Database write error"));

    render(
      <CreateCrmSupabaseQuoteDialog
        open={true}
        onOpenChange={vi.fn()}
        lead={mockLead}
        onSuccess={vi.fn()}
      />
    );

    const createButton = screen.getByText("Criar Orçamento");
    fireEvent.click(createButton);

    await waitFor(() => {
      // Expect rollback to have been triggered
      expect(quotesRepository.softDeleteQuote).toHaveBeenCalledWith(
        "ws-1",
        "quote-created-uuid-1",
        "Rollback: Falha ao inserir itens do orçamento durante criação a partir do CRM"
      );
    });

    // Ensure log is NOT created on failure
    const log = localStorage.getItem("kora.crm.supabaseCreatedQuotes.v1");
    expect(log).toBeNull();
  });
});
