// Resgate do dashboard órfão (irmão do G16) — Fase C, rodada `dashboard-orfao-fase-c`.
// SupabaseOperationalDashboardCard era IMPORTADO em Configuracoes.tsx mas nunca
// RENDERIZADO na aba "Dados" — removido deliberadamente em 77f479c ("end-client
// safety", junto de um painel de workspace e um script SQL exposto), e seu toggle
// (SupabaseOperationalDashboardToggleCard) foi reintroduzido 4 dias depois (8d017f4)
// sem que o card em si voltasse — 3 toggles ao vivo controlando um painel inexistente
// desde então (achado da Fase A, docs/architecture/kora-hub-auditoria-e-plano.md).
//
// Mesma lição do G16/incidente #4: nenhuma combinação de flag resolve um problema de
// árvore de componentes — só um teste que renderiza a página de verdade prova que o
// card está montado.
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";

import Configuracoes from "@/pages/Configuracoes";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useAccessibility } from "@/contexts/AccessibilityContext";
import { useTranslation } from "@/contexts/LanguageContext";
import { useLocalClientsImport } from "@/hooks/useLocalClientsImport";
import { useLocalTechnicalSheetsImport } from "@/hooks/useLocalTechnicalSheetsImport";
import { useLocalOpportunitiesImport } from "@/hooks/useLocalOpportunitiesImport";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useSupabaseFinancialSummary } from "@/hooks/useSupabaseFinancialSummary";
import { useSupabaseProjectsSummary } from "@/hooks/useSupabaseProjectsSummary";

vi.mock("@/hooks/useAppSettings");
vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/contexts/OnboardingContext");
vi.mock("@/contexts/AccessibilityContext");
vi.mock("@/contexts/LanguageContext");
vi.mock("@/hooks/useLocalClientsImport");
vi.mock("@/hooks/useLocalTechnicalSheetsImport");
vi.mock("@/hooks/useLocalOpportunitiesImport");
vi.mock("@/hooks/useSupabaseQuotes");
vi.mock("@/hooks/useSupabaseOpportunities");
vi.mock("@/hooks/useSupabaseFinancialSummary");
vi.mock("@/hooks/useSupabaseProjectsSummary");

// Não são o alvo deste teste — stubs simples evitam mockar toda a árvore delas.
vi.mock("@/components/settings/LocalQuotesImportCard", () => ({ LocalQuotesImportCard: () => null }));
vi.mock("@/components/settings/LocalFinanceImportCard", () => ({ LocalFinanceImportCard: () => null }));
vi.mock("@/components/settings/LocalProjectsImportCard", () => ({ LocalProjectsImportCard: () => null }));
vi.mock("@/components/settings/LocalTasksImportCard", () => ({ LocalTasksImportCard: () => null }));
vi.mock("@/components/settings/CrmSupabaseOperationalToggleCard", () => ({ CrmSupabaseOperationalToggleCard: () => null }));
vi.mock("@/components/settings/CrmSupabaseCreateQuoteToggleCard", () => ({ CrmSupabaseCreateQuoteToggleCard: () => null }));
vi.mock("@/components/settings/QuotesSupabaseReceivableToggleCard", () => ({ QuotesSupabaseReceivableToggleCard: () => null }));
vi.mock("@/components/settings/QuotesSupabaseProjectToggleCard", () => ({ QuotesSupabaseProjectToggleCard: () => null }));
vi.mock("@/components/settings/QuotesSupabaseBaseTasksToggleCard", () => ({ QuotesSupabaseBaseTasksToggleCard: () => null }));
vi.mock("@/components/settings/QuotesSupabaseStatusTransitionToggleCard", () => ({ QuotesSupabaseStatusTransitionToggleCard: () => null }));
vi.mock("@/components/settings/QuotesSupabaseTechnicalSheetsAutoSaveToggleCard", () => ({ QuotesSupabaseTechnicalSheetsAutoSaveToggleCard: () => null }));
vi.mock("@/components/settings/SupabaseOperationalDashboardToggleCard", () => ({ SupabaseOperationalDashboardToggleCard: () => null }));
vi.mock("@/components/settings/SupabaseExperimentalToggleCard", () => ({ SupabaseExperimentalToggleCard: () => null }));
vi.mock("@/components/settings/SupabaseQuotesViewerCard", () => ({ SupabaseQuotesViewerCard: () => null }));

const mockWorkspace = {
  id: "ws-1", name: "QA Workspace", slug: "qa-workspace", owner_id: "owner-1",
  created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  currency: "BRL", locale: "pt-BR", timezone: null,
};

const FLAG_KEY = "kora.supabase.operationalDashboard.enabled";

function renderConfiguracoesOnDataTab() {
  return render(
    <MemoryRouter initialEntries={["/configuracoes?tab=data"]}>
      <Configuracoes />
    </MemoryRouter>,
  );
}

describe("Configuracoes · resgate do dashboard órfão — SupabaseOperationalDashboardCard montado na aba Dados", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    vi.mocked(useAppSettings).mockReturnValue({
      profile: { name: "QA", email: "qa@kora.com", phone: "", role: "" },
      company: { name: "Empresa QA" },
      notifications: {} as never,
      publicLinks: {},
      clientPortal: {},
      updateProfile: vi.fn(), updateCompany: vi.fn(), updatePublicLinks: vi.fn(),
      updateClientPortal: vi.fn(), resetClientPortal: vi.fn(), toggleNotification: vi.fn(),
    } as never);
    vi.mocked(useCurrentWorkspace).mockReturnValue({
      workspace: mockWorkspace, membership: null, loading: false, error: null,
    } as never);
    vi.mocked(useOnboarding).mockReturnValue({ resetOnboarding: vi.fn() } as never);
    vi.mocked(useAccessibility).mockReturnValue({
      settings: {} as never, updateSetting: vi.fn(),
    } as never);
    vi.mocked(useTranslation).mockReturnValue({
      t: (_key: string, fallback: string) => fallback, language: "pt-BR", setLanguage: vi.fn(),
    } as never);
    vi.mocked(useLocalClientsImport).mockReturnValue({
      candidates: [], importing: false, importSelected: vi.fn(), importedIds: [], metadata: null,
    } as never);
    vi.mocked(useLocalTechnicalSheetsImport).mockReturnValue({
      candidates: [], importing: false, importSelected: vi.fn(), importedIds: [], metadata: null,
    } as never);
    vi.mocked(useLocalOpportunitiesImport).mockReturnValue({
      candidates: [], importing: false, importSelected: vi.fn(), importedIds: [], metadata: null,
    } as never);
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh: vi.fn(),
      createQuoteWithItems: vi.fn(), updateQuote: vi.fn(), archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(), replaceQuoteItems: vi.fn(), updateStatus: vi.fn(),
    } as never);
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseFinancialSummary).mockReturnValue({
      receivables: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(useSupabaseProjectsSummary).mockReturnValue({
      projects: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
  });

  it("aba Dados monta o card real (título), independente da flag estar ligada ou não", async () => {
    renderConfiguracoesOnDataTab();

    expect(await screen.findByText("Visão Operacional Supabase")).toBeInTheDocument();
  });

  it("regressão do órfão: com a flag ligada, o painel de dados real aparece na página inteira, não só o placeholder", async () => {
    localStorage.setItem(FLAG_KEY, "true");

    renderConfiguracoesOnDataTab();

    expect(await screen.findByText("Relações do Fluxo Comercial")).toBeInTheDocument();
  });
});
