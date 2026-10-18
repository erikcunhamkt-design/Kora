// G94 / CT5 — ponte catálogo ↔ orçamento no WIZARD ("+ Adicionar serviço do catálogo" e o item resultante).
// Em modo NUVEM do catálogo o select lista os serviços da nuvem (ativos && availableInQuotes, mesmo filtro da lane B)
// e o item recebe `serviceId` = uuid (passthrough G67) pra o mapper gravar `quote_items.service_id` (G98).
// Em modo LOCAL (padrão): intocado. Preço/nome são COPIADOS na seleção (o orçamento não muda se o serviço mudar depois).
// Arquivo próprio (não toca o QuotesSection.test.tsx da lane B); mesmos mocks de fronteira de lá.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { QuotesSection } from "@/components/vendas/QuotesSection";
import { useQuotes } from "@/hooks/useQuotes";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useClients } from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useSupabaseProjects } from "@/hooks/useSupabaseProjects";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { useLeads } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { CATALOG_DATA_SOURCE_KEY } from "@/config/flags";
import { mapLocalQuoteItemToSupabaseItem } from "@/services/quotes/quoteMapper";
import { serviceCategoriesRepository } from "@/repositories/serviceCategoriesRepository";
import { servicesRepository } from "@/repositories/servicesRepository";
import { productsRepository } from "@/repositories/productsRepository";
import { commercialPlansRepository } from "@/repositories/commercialPlansRepository";
import { CatalogUnavailableError } from "@/repositories/catalogRepositoryShared";

vi.mock("@/hooks/useQuotes", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useQuotes")>("@/hooks/useQuotes");
  return { ...actual, useQuotes: vi.fn() };
});
vi.mock("@/hooks/useSupabaseQuotes", () => ({ useSupabaseQuotes: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useSupabaseOpportunities", () => ({ useSupabaseOpportunities: vi.fn() }));
vi.mock("@/repositories/crmOpportunitiesRepository", () => ({ crmOpportunitiesRepository: { updateOpportunity: vi.fn() } }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useSupabaseProjects", () => ({ useSupabaseProjects: vi.fn() }));
vi.mock("@/hooks/useSupabaseTasksAll", () => ({ useSupabaseTasksAll: vi.fn() }));
vi.mock("@/repositories/financeRepository", () => ({ financeRepository: { createReceivableFromQuote: vi.fn() } }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));
vi.mock("@/repositories/serviceCategoriesRepository", () => ({
  serviceCategoriesRepository: { listCategories: vi.fn(), importCategory: vi.fn(), updateCategory: vi.fn(), softDeleteCategory: vi.fn() },
}));
vi.mock("@/repositories/servicesRepository", () => ({
  servicesRepository: { listServices: vi.fn(), importService: vi.fn(), updateService: vi.fn(), softDeleteService: vi.fn() },
}));
vi.mock("@/repositories/productsRepository", () => ({
  productsRepository: { listProducts: vi.fn(), importProduct: vi.fn(), updateProduct: vi.fn(), softDeleteProduct: vi.fn() },
}));
vi.mock("@/repositories/commercialPlansRepository", () => ({
  commercialPlansRepository: { listPlans: vi.fn(), importPlan: vi.fn(), updatePlan: vi.fn(), softDeletePlan: vi.fn() },
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

const WS = "ws1";
const SVC_OK = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const SVC_HIDDEN = "0a1b2c3d-1111-4222-8333-444455556666";
const SVC_OFF = "11111111-2222-4333-8444-555555555555";
const T = "2026-10-18T00:00:00Z";
const base = { workspace_id: WS, source_local_id: "native:x", deleted_at: null, created_at: T, updated_at: T, is_demo: false };
const svcRow = (o = {}) => ({
  ...base, id: SVC_OK, category_id: null, category: "", name: "Serviço Nuvem", description: "", price: 100, billing_type: "único",
  delivery_days: 7, active: true, tags: [], available_in_quotes: true, show_in_public_catalog: false, notes: null, ...o,
});

const createQuoteWithItems = vi.fn();
let queryClient: QueryClient;

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("kora.crm.dataSource.v1", "local");
  vi.clearAllMocks();
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});

  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [], source: "local" } as never);
  vi.mocked(useLeads).mockReturnValue({ leads: [], updateLead: vi.fn() } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: WS } } as never);
  vi.mocked(useSupabaseOpportunities).mockReturnValue({ opportunities: [], refresh: vi.fn() } as never);
  vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
  vi.mocked(useSupabaseProjects).mockReturnValue({ createProject: vi.fn() } as never);
  vi.mocked(useSupabaseTasksAll).mockReturnValue({ createTask: vi.fn() } as never);

  createQuoteWithItems.mockResolvedValue({
    id: "q-new", clientName: "Cliente CT5", clientEmail: "", clientWhatsapp: "", title: "Orçamento CT5", description: "", items: [],
    subtotal: 0, discount: 0, total: 0, paymentCondition: "", deliveryDeadline: "", validityDays: 15, status: "rascunho",
    createdAt: new Date().toISOString().slice(0, 10),
  });
  vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null, createQuoteWithItems, refresh: vi.fn() } as never);

  vi.mocked(serviceCategoriesRepository.listCategories).mockResolvedValue([] as never);
  vi.mocked(servicesRepository.listServices).mockResolvedValue([
    svcRow(),
    svcRow({ id: SVC_HIDDEN, name: "Serviço Escondido", available_in_quotes: false }),
    svcRow({ id: SVC_OFF, name: "Serviço Inativo", active: false }),
  ] as never);
  vi.mocked(productsRepository.listProducts).mockResolvedValue([] as never);
  vi.mocked(commercialPlansRepository.listPlans).mockResolvedValue([] as never);

  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

const baseService = { description: "", category: "Geral", price: 100, billingType: "único", deliveryDays: 1 };

function renderQuotes({ withQueryClient }: { withQueryClient: boolean }) {
  const tree = (
    <MemoryRouter>
      <QuotesSection />
    </MemoryRouter>
  );
  return render(withQueryClient ? <QueryClientProvider client={queryClient}>{tree}</QueryClientProvider> : tree);
}

function mockQuotes() {
  vi.mocked(useQuotes).mockReturnValue({
    quotes: [], addQuote: vi.fn(), updateStatus: vi.fn(), updateQuote: vi.fn(), duplicateQuote: vi.fn(), deleteQuote: vi.fn(),
  } as never);
}

async function openStep2() {
  fireEvent.click(screen.getByText("Novo orçamento"));
  fireEvent.change(screen.getByPlaceholderText("Nome do cliente"), { target: { value: "Cliente CT5" } });
  fireEvent.change(screen.getByPlaceholderText("Ex: Rebranding 2026"), { target: { value: "Orçamento CT5" } });
  fireEvent.click(screen.getByText("Continuar"));
  await screen.findByText("+ Item manual");
}

function pick(value: string) {
  const select = screen.getByRole("option", { name: "+ Adicionar serviço do catálogo" }).closest("select") as HTMLSelectElement;
  fireEvent.change(select, { target: { value } });
}

async function saveWizard() {
  fireEvent.click(screen.getByText("Continuar")); // passo 2 -> 3
  fireEvent.click(screen.getByText("Continuar")); // passo 3 -> 4
  const save = await screen.findByText("Salvar orçamento");
  fireEvent.click(save);
}

describe("Wizard · catálogo em modo LOCAL (padrão) — intocado", () => {
  it("lista os serviços locais, grava serviceId LOCAL, copia nome/preço — e nenhum hook de nuvem do catálogo existe (nem QueryClient)", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "local");
    localStorage.setItem("kora.quotes.dataSource.v1", "supabase");
    localStorage.setItem("orbyt.services.v1", JSON.stringify([
      { ...baseService, id: "svc-a", name: "Serviço Local A", price: 250, active: true, availableInQuotes: true },
    ]));
    mockQuotes();
    renderQuotes({ withQueryClient: false }); // sem QueryClientProvider: prova que o modo local não monta hooks de nuvem do catálogo

    await openStep2();
    expect(screen.getByRole("option", { name: /Serviço Local A/ })).toBeInTheDocument();
    expect(screen.queryByText(/Catálogo lido da nuvem/)).toBeNull();
    pick("svc-a");
    await saveWizard();

    await waitFor(() => expect(createQuoteWithItems).toHaveBeenCalledTimes(1));
    const item = createQuoteWithItems.mock.calls[0][0].items[0];
    expect(item).toMatchObject({ serviceId: "svc-a", name: "Serviço Local A", unitPrice: 250, quantity: 1 });
    expect(servicesRepository.listServices).not.toHaveBeenCalled();
  });
});

describe("Wizard · catálogo em modo NUVEM (CT5)", () => {
  beforeEach(() => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem("kora.quotes.dataSource.v1", "supabase");
    // catálogo LOCAL com um serviço que NÃO pode aparecer em modo nuvem
    localStorage.setItem("orbyt.services.v1", JSON.stringify([
      { ...baseService, id: "svc-local", name: "Serviço Só Local", price: 1, active: true, availableInQuotes: true },
    ]));
    mockQuotes();
  });

  it("lista SÓ serviços da nuvem ativos && availableInQuotes (mesmo filtro da lane B); não mistura o catálogo local; ajuda diz a fonte", async () => {
    renderQuotes({ withQueryClient: true });
    await openStep2();

    await screen.findByRole("option", { name: /Serviço Nuvem/ });
    expect(screen.queryByRole("option", { name: /Serviço Escondido/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Serviço Inativo/ })).toBeNull();
    expect(screen.queryByRole("option", { name: /Serviço Só Local/ })).toBeNull();
    expect(screen.getByText(/só lista serviços ativos e marcados como/i)).toHaveTextContent("Catálogo lido da nuvem (Supabase).");
  });

  it("o item recebe serviceId = UUID do serviço; o orçamento vai pra nuvem com ele, e o mapper da lane B grava service_id = uuid (passthrough, nunca id local)", async () => {
    renderQuotes({ withQueryClient: true });
    await openStep2();
    await screen.findByRole("option", { name: /Serviço Nuvem/ });

    pick(SVC_OK);
    await saveWizard();

    await waitFor(() => expect(createQuoteWithItems).toHaveBeenCalledTimes(1));
    const item = createQuoteWithItems.mock.calls[0][0].items[0];
    expect(item).toMatchObject({ serviceId: SVC_OK, name: "Serviço Nuvem", unitPrice: 100, quantity: 1 });
    expect(mapLocalQuoteItemToSupabaseItem(item).service_id).toBe(SVC_OK);
  });

  it("nome/preço são COPIADOS na seleção: mudar o serviço depois NÃO muda o item do orçamento", async () => {
    renderQuotes({ withQueryClient: true });
    await openStep2();
    await screen.findByRole("option", { name: /Serviço Nuvem/ });

    pick(SVC_OK);
    // o serviço muda na nuvem DEPOIS de escolhido (cache do hook nativo é atualizado, como numa edição no Catálogo)
    queryClient.setQueryData(["supabase-services", WS], [svcRow({ name: "Serviço Renomeado", price: 999 })]);
    await waitFor(() => expect(servicesRepository.listServices).toHaveBeenCalled());
    await saveWizard();

    await waitFor(() => expect(createQuoteWithItems).toHaveBeenCalledTimes(1));
    const item = createQuoteWithItems.mock.calls[0][0].items[0];
    expect(item).toMatchObject({ serviceId: SVC_OK, name: "Serviço Nuvem", unitPrice: 100 }); // não 999 / "Renomeado"
  });

  it("schema pendente (tabelas ausentes): o wizard cai no catálogo LOCAL (serviceId local), sem o texto de nuvem", async () => {
    vi.mocked(servicesRepository.listServices).mockRejectedValue(new CatalogUnavailableError("42P01"));
    renderQuotes({ withQueryClient: true });
    await openStep2();

    await screen.findByRole("option", { name: /Serviço Só Local/ });
    expect(screen.queryByRole("option", { name: /Serviço Nuvem/ })).toBeNull();
    expect(screen.getByText(/só lista serviços ativos e marcados como/i)).not.toHaveTextContent("Catálogo lido da nuvem");
    pick("svc-local");
    await saveWizard();
    await waitFor(() => expect(createQuoteWithItems).toHaveBeenCalledTimes(1));
    expect(createQuoteWithItems.mock.calls[0][0].items[0]).toMatchObject({ serviceId: "svc-local", name: "Serviço Só Local" });
  });
});
