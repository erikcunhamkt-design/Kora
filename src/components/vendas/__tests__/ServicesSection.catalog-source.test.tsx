// G94 / CT4 — a tela de Catálogo em cada fonte. Prova o que o USUÁRIO vê: banner honesto por modo, "Serviço criado"
// SÓ quando gravou (G75), modal que não fecha em falha/bloqueio, schema pendente caindo no local, e que o padrão
// LOCAL não mostra banner nenhum. Repositórios simulados; hooks locais reais.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";

import { ServicesSection } from "@/components/vendas/ServicesSection";
import { CATALOG_DATA_SOURCE_KEY, CATALOG_WRITE_FLAG_KEY } from "@/config/flags";
import { CATALOG_WRITE_BLOCKED_MESSAGE } from "@/hooks/useBifurcatedCatalog";
import { serviceCategoriesRepository } from "@/repositories/serviceCategoriesRepository";
import { servicesRepository } from "@/repositories/servicesRepository";
import { productsRepository } from "@/repositories/productsRepository";
import { commercialPlansRepository } from "@/repositories/commercialPlansRepository";
import { CatalogUnavailableError, toCatalogError } from "@/repositories/catalogRepositoryShared";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import type { Quote } from "@/hooks/useQuotes";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/hooks/useSupabaseQuotes", () => ({ useSupabaseQuotes: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: () => ({ workspace: { id: "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9" } }) }));
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

const WS = "2dc45e1a-6170-4a37-8c95-e2a6bb83f5f9";
const SVC = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const SVC2 = "0a1b2c3d-1111-4222-8333-444455556666";
const T = "2026-10-18T00:00:00Z";
const base = { workspace_id: WS, source_local_id: "native:x", deleted_at: null, created_at: T, updated_at: T, is_demo: false };
const svcRow = (o = {}) => ({
  ...base, id: SVC, category_id: null, category: "", name: "Serviço da Nuvem", description: "", price: 1000, billing_type: "único",
  delivery_days: 7, active: true, tags: [], available_in_quotes: true, show_in_public_catalog: false, notes: null, ...o,
});

function renderCatalog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ServicesSection />
    </QueryClientProvider>,
  );
}

function fillAndSaveNewService(name = "Meu serviço") {
  fireEvent.click(screen.getAllByText("Novo serviço")[0]);
  fireEvent.change(screen.getByPlaceholderText("Ex: Landing Page"), { target: { value: name } });
  fireEvent.change(screen.getByPlaceholderText("1500"), { target: { value: "250" } });
  fireEvent.click(screen.getByText("Salvar serviço"));
}

const quoteWith = (id: string, items: Array<{ serviceId?: string; name: string }>): Quote => ({
  id, clientName: "C", clientEmail: "", clientWhatsapp: "", title: id, description: "",
  items: items.map((it, i) => ({ id: `it-${i}`, quantity: 1, unitPrice: 10, ...it })),
  subtotal: 10, discount: 0, total: 10, paymentCondition: "", deliveryDeadline: "", validityDays: 15,
  status: "rascunho", createdAt: new Date().toISOString().slice(0, 10),
});

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);
  vi.mocked(serviceCategoriesRepository.listCategories).mockResolvedValue([] as never);
  vi.mocked(servicesRepository.listServices).mockResolvedValue([svcRow()] as never);
  vi.mocked(productsRepository.listProducts).mockResolvedValue([] as never);
  vi.mocked(commercialPlansRepository.listPlans).mockResolvedValue([] as never);
});

describe("Catálogo · fonte LOCAL (padrão)", () => {
  it("nenhum banner, nenhuma request, e criar serviço grava no local com o toast de sempre", async () => {
    renderCatalog();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    fillAndSaveNewService();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Serviço criado"));
    expect(servicesRepository.listServices).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("orbyt.services.v1") ?? "[]").some((s: { name: string }) => s.name === "Meu serviço")).toBe(true);
    expect(screen.queryByText("Salvar serviço")).toBeNull(); // modal fechou
  });
});

describe("Catálogo · fonte NUVEM", () => {
  it("escrita DESLIGADA: banner diz que é só leitura; criar é BLOQUEADO — sem 'Serviço criado', modal aberto, nada gravado", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    renderCatalog();

    await screen.findByText("Serviço da Nuvem");
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Catálogo lido da nuvem (Supabase)");
    expect(banner).toHaveTextContent(/gravação na nuvem está DESLIGADA/);
    expect(banner).toHaveTextContent(/nada é salvo/);
    // o catálogo LOCAL (seeds) não aparece misturado
    expect(screen.queryByText("Identidade Visual")).toBeNull();

    fillAndSaveNewService();
    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith(CATALOG_WRITE_BLOCKED_MESSAGE));
    expect(toast.success).not.toHaveBeenCalled();
    expect(servicesRepository.importService).not.toHaveBeenCalled();
    expect(screen.getByText("Salvar serviço")).toBeInTheDocument(); // modal continua aberto (o usuário não perde o que digitou)
  });

  it("escrita LIGADA: grava na nuvem (uuid), mostra 'Serviço criado', fecha o modal e a lista ganha o item sem refetch", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(CATALOG_WRITE_FLAG_KEY, "true");
    vi.mocked(servicesRepository.importService).mockResolvedValue(svcRow({ id: SVC2, name: "Meu serviço" }) as never);
    renderCatalog();
    await screen.findByText("Serviço da Nuvem");
    expect(screen.getByRole("status")).toHaveTextContent(/gravação na nuvem está LIGADA/);

    fillAndSaveNewService();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Serviço criado"));
    expect(vi.mocked(servicesRepository.importService).mock.calls[0][2]).toMatchObject({ name: "Meu serviço", price: 250, billing_type: "único" });
    await screen.findByText("Meu serviço");
    expect(screen.queryByText("Salvar serviço")).toBeNull();
    expect(servicesRepository.listServices).toHaveBeenCalledTimes(1);
  });

  it("falha na gravação: erro legível, SEM 'Serviço criado', modal aberto", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(CATALOG_WRITE_FLAG_KEY, "true");
    vi.mocked(servicesRepository.importService).mockRejectedValue(new CatalogUnavailableError("42P01"));
    renderCatalog();
    await screen.findByText("Serviço da Nuvem");

    fillAndSaveNewService();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText("Salvar serviço")).toBeInTheDocument();
  });

  it("G95: o toast de falha diz a ação e a CAUSA real (CHECK), não um genérico", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(CATALOG_WRITE_FLAG_KEY, "true");
    vi.mocked(servicesRepository.importService).mockRejectedValue(
      toCatalogError({ code: "23514", message: 'new row for relation "services" violates check constraint "services_price_nonneg_chk"' }),
    );
    renderCatalog();
    await screen.findByText("Serviço da Nuvem");

    fillAndSaveNewService();
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const msg = String(vi.mocked(toast.error).mock.calls[0][0]);
    expect(msg).toMatch(/^Erro ao criar o serviço no catálogo \(Supabase\): /);
    expect(msg).toContain("services_price_nonneg_chk");
  });

  it("G95: erro de LEITURA (RLS) aparece no banner com a causa, e a tela segue em modo nuvem", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    vi.mocked(servicesRepository.listServices).mockRejectedValue(
      toCatalogError({ code: "42501", message: 'permission denied for table services' }),
    );
    renderCatalog();
    const banner = await screen.findByText(/Não foi possível carregar o catálogo da nuvem/);
    expect(banner).toHaveTextContent("permission denied for table services");
  });

  it("schema pendente (tabela ausente): alerta 'Schema pendente (pacote §8-b)' + tabelas, e a tela exibe/grava o catálogo LOCAL", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem(CATALOG_WRITE_FLAG_KEY, "true");
    vi.mocked(servicesRepository.listServices).mockRejectedValue(new CatalogUnavailableError("42P01"));
    vi.mocked(commercialPlansRepository.listPlans).mockRejectedValue(new CatalogUnavailableError("PGRST205"));
    renderCatalog();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/schema pendente \(pacote §8-b\)/i);
    expect(alert).toHaveTextContent("services, commercial_plans");
    expect(alert).toHaveTextContent(/catálogo local/);
    expect(screen.getByText("Identidade Visual")).toBeInTheDocument(); // seed local visível, não lista vazia

    fillAndSaveNewService("Local por degradação");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Serviço criado"));
    expect(servicesRepository.importService).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem("orbyt.services.v1") ?? "[]").some((s: { name: string }) => s.name === "Local por degradação")).toBe(true);
  });

  it("'Verificar de novo' reconsulta e, com o schema aplicado, sai do aviso e mostra a nuvem", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    vi.mocked(servicesRepository.listServices).mockRejectedValueOnce(new CatalogUnavailableError("42P01"));
    renderCatalog();
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Verificar de novo" }));
    await screen.findByText("Serviço da Nuvem");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("banner sem frases fósseis: 'Mais usado' e o seletor do wizard JÁ leem a nuvem; só o Checkout segue local (dito)", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    renderCatalog();
    await screen.findByText("Serviço da Nuvem");
    const banner = screen.getByRole("status");
    expect(banner).not.toHaveTextContent(/ainda não lê a nuvem/);
    expect(banner).not.toHaveTextContent(/seletor de serviços dos orçamentos ainda usa o catálogo local/);
    fireEvent.click(screen.getByText("Checkout"));
    expect(screen.getByRole("status")).toHaveTextContent(/Checkout continua local/);
  });

  // (c)/G98 — "Mais usado em orçamentos" em modo nuvem: conta orçamentos DA NUVEM por serviceId (uuid real)
  it("'Mais usado em orçamentos': conta por serviceId (uuid) nos orçamentos da nuvem e mostra o contador no card", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    vi.mocked(servicesRepository.listServices).mockResolvedValue([
      svcRow({ id: SVC, name: "Serviço da Nuvem" }),
      svcRow({ id: SVC2, name: "Outro Serviço" }),
    ] as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [
        quoteWith("q1", [{ serviceId: SVC, name: "a" }, { serviceId: SVC2, name: "b" }]),
        quoteWith("q2", [{ serviceId: SVC, name: "a" }, { name: "item manual (sem serviceId)" }]),
      ],
      loading: false, error: null,
    } as never);
    renderCatalog();
    await screen.findByText("Outro Serviço");

    const metric = screen.getByText("Mais usado em orçamentos").parentElement as HTMLElement;
    expect(metric).toHaveTextContent("Serviço da Nuvem");
    expect(screen.getByText("2× em orçamentos")).toBeInTheDocument(); // SVC em 2 itens
    expect(screen.getByText("1× em orçamentos")).toBeInTheDocument(); // SVC2 em 1
  });

  it("modo nuvem NÃO conta orçamentos LOCAIS (ids de serviço locais não casam com uuid) — a fonte é a de orçamentos", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem("orbyt.quotes.v1", JSON.stringify([quoteWith("ql", [{ serviceId: SVC, name: "local apontando pro uuid" }])]));
    vi.mocked(useSupabaseQuotes).mockReturnValue({ quotes: [], loading: false, error: null } as never);
    renderCatalog();
    await screen.findByText("Serviço da Nuvem");
    expect(screen.queryByText(/× em orçamentos/)).toBeNull();
    expect(screen.getByText("Mais usado em orçamentos").parentElement).toHaveTextContent("—");
  });

  it("regressão LOCAL: o catálogo local conta os orçamentos locais por id local, sem tocar nos orçamentos da nuvem", async () => {
    localStorage.setItem("orbyt.quotes.v1", JSON.stringify([quoteWith("ql", [{ serviceId: "svc-demo-1", name: "x" }, { serviceId: "svc-demo-1", name: "y" }])]));
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [quoteWith("qc", [{ serviceId: "svc-demo-2", name: "nuvem" }])], loading: false, error: null,
    } as never);
    renderCatalog();
    expect(screen.getByText("Mais usado em orçamentos").parentElement).toHaveTextContent("Identidade Visual");
    expect(screen.getByText("2× em orçamentos")).toBeInTheDocument();
    expect(screen.queryByText("1× em orçamentos")).toBeNull();
    expect(useSupabaseQuotes).not.toHaveBeenCalled(); // nenhum hook de nuvem no modo local
  });

  it("schema pendente (cai no local): a métrica volta a contar os orçamentos LOCAIS", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    localStorage.setItem("orbyt.quotes.v1", JSON.stringify([quoteWith("ql", [{ serviceId: "svc-demo-3", name: "x" }])]));
    vi.mocked(servicesRepository.listServices).mockRejectedValue(new CatalogUnavailableError("42P01"));
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [quoteWith("qc", [{ serviceId: "svc-demo-1", name: "nuvem" }])], loading: false, error: null,
    } as never);
    renderCatalog();
    await screen.findByRole("alert");
    expect(screen.getByText("Mais usado em orçamentos").parentElement).toHaveTextContent("Landing Page");
  });

  // showInPublicCatalog — decisão (a): rótulo honesto
  it("toggle do serviço: 'Selo interno “Portfólio” — não publica nada' (sem prometer catálogo público); badge com title", async () => {
    renderCatalog();
    fireEvent.click(screen.getAllByText("Novo serviço")[0]);
    expect(screen.getByText("Selo interno “Portfólio” — não publica nada")).toBeInTheDocument();
    expect(screen.queryByText(/Mostrar no catálogo público/)).toBeNull();
    expect(screen.queryByText(/\(em breve\)/)).toBeNull();
  });

  it("badge 'Portfólio' do card explica que é um selo interno", () => {
    localStorage.setItem("orbyt.services.v1", JSON.stringify([
      { id: "svc-x", name: "Com selo", description: "", category: "", price: 10, billingType: "único", deliveryDays: 1, active: true, availableInQuotes: true, showInPublicCatalog: true },
    ]));
    renderCatalog();
    expect(screen.getByText("Portfólio")).toHaveAttribute("title", "Selo interno — não publica nada");
  });
});
