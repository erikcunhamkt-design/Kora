import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateCrmSupabaseQuoteDialog } from "@/components/crm/CreateCrmSupabaseQuoteDialog";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository, type SupabaseQuote } from "@/repositories/quotesRepository";
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
  priority: "média" as const,
  lastInteraction: "2024-01-01T00:00:00Z",
  description: "",
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

  it("cria via RPC atômica (import_quote_with_items), com source_local_id sintético 'native:...'", async () => {
    localStorage.setItem(
      "kora.clients.supabaseImport.v1",
      JSON.stringify({ importedMap: { "999": "client-uuid-789" } }),
    );
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

    vi.mocked(quotesRepository.importQuoteWithItems).mockResolvedValue({
      id: "quote-created-uuid-1",
    } as unknown as SupabaseQuote);

    const onSuccess = vi.fn();
    render(
      <CreateCrmSupabaseQuoteDialog
        open={true}
        onOpenChange={vi.fn()}
        lead={mockLead}
        onSuccess={onSuccess}
      />
    );

    fireEvent.click(screen.getByText("Criar Orçamento"));

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("quote-created-uuid-1", 2500));

    // Etapa 5 · Fatia 10 (item 1) — nunca mais createQuote+replaceQuoteItems em
    // separado; sempre a RPC atômica, com um source_local_id sintético (prefixo
    // "native:", nunca o formato real de import "installId:localId").
    expect(quotesRepository.createQuote).not.toHaveBeenCalled();
    expect(quotesRepository.replaceQuoteItems).not.toHaveBeenCalled();
    expect(quotesRepository.importQuoteWithItems).toHaveBeenCalledTimes(1);
    const [workspaceIdArg, sourceLocalIdArg, payloadArg, itemsArg] =
      vi.mocked(quotesRepository.importQuoteWithItems).mock.calls[0];
    expect(workspaceIdArg).toBe("ws-1");
    expect(sourceLocalIdArg).toMatch(/^native:/);
    expect(payloadArg).toMatchObject({
      client_id: "client-uuid-789",
      opportunity_id: "opportunity-uuid-456",
      client_name: "Cliente Teste QA",
      client_email: "qa@kora.com",
      title: "Orçamento - Cliente Teste QA",
      status: "draft",
      archived: false,
    });
    expect(itemsArg).toEqual([{ name: "Serviço de Design", quantity: 1, unit_price: 2500 }]);

    const log = JSON.parse(localStorage.getItem("kora.crm.supabaseCreatedQuotes.v1") || "[]");
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ quoteId: "quote-created-uuid-1", total: 2500 });
  });

  it("nunca aciona rollback manual quando a RPC falha — a atomicidade é da própria RPC", async () => {
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

    vi.mocked(quotesRepository.importQuoteWithItems).mockRejectedValue(new Error("Database write error"));

    render(
      <CreateCrmSupabaseQuoteDialog
        open={true}
        onOpenChange={vi.fn()}
        lead={mockLead}
        onSuccess={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Criar Orçamento"));

    await waitFor(() => expect(quotesRepository.importQuoteWithItems).toHaveBeenCalledTimes(1));

    // Sem "rollback" manual — não existe mais softDeleteQuote de compensação
    // (a RPC é transacional; uma falha nela nunca cria uma quote "decapitada").
    expect(quotesRepository.softDeleteQuote).not.toHaveBeenCalled();

    // Ensure log is NOT created on failure
    const log = localStorage.getItem("kora.crm.supabaseCreatedQuotes.v1");
    expect(log).toBeNull();
  });
});