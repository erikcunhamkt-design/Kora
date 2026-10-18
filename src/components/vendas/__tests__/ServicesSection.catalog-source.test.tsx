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

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() } }));
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
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

  it("aba Serviços avisa que 'Mais usado em orçamentos' ainda não lê a nuvem; aba Checkout avisa que segue local", async () => {
    localStorage.setItem(CATALOG_DATA_SOURCE_KEY, "supabase");
    renderCatalog();
    await screen.findByText("Serviço da Nuvem");
    expect(screen.getByRole("status")).toHaveTextContent(/Mais usado em orçamentos.*ainda não lê a nuvem/);
    expect(screen.getByRole("status")).toHaveTextContent(/seletor de serviços dos orçamentos ainda usa o catálogo local/);
    fireEvent.click(screen.getByText("Checkout"));
    expect(screen.getByRole("status")).toHaveTextContent(/Checkout continua local/);
  });
});
