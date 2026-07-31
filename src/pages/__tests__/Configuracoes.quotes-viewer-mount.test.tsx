// Etapa 5 · Fatia 10 · Fase D (incidente #4, achado 5a) — SupabaseQuotesViewerCard
// era IMPORTADO em Configuracoes.tsx mas nunca RENDERIZADO na aba "Dados"
// (removido em 79bb252, junto de ~20 outros cards, quando a página foi
// reorganizada — o import ficou órfão, sem lint que pegasse `no-unused-vars`
// desligado). Nenhuma combinação de flags resolvia isso, porque o problema
// não era de flag — era de árvore de componentes. Este teste trava o
// contrato: a aba "Dados" precisa montar o card.
//
// Pacote do Flip (Fase C) — `quotesSupabaseExperimental` foi retirada (o
// card renderiza incondicionalmente com workspace, ver
// docs/qa/etapa-5-flip-quotes.md §2.2); os testes abaixo não setam mais
// essa flag (era um no-op desde a retirada, deixado de propósito fora
// pra não sugerir que ainda importa).
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

vi.mock("@/hooks/useAppSettings");
vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/contexts/OnboardingContext");
vi.mock("@/contexts/AccessibilityContext");
vi.mock("@/contexts/LanguageContext");
vi.mock("@/hooks/useLocalClientsImport");
vi.mock("@/hooks/useLocalTechnicalSheetsImport");
vi.mock("@/hooks/useLocalOpportunitiesImport");
vi.mock("@/hooks/useSupabaseQuotes");

// Estas telas não são o alvo deste teste (mounting da aba Dados) — stubs
// simples evitam ter que mockar toda a árvore de dependências delas.
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
vi.mock("@/components/settings/SupabaseOperationalDashboardCard", () => ({ SupabaseOperationalDashboardCard: () => null }));
vi.mock("@/components/settings/SupabaseExperimentalToggleCard", () => ({ SupabaseExperimentalToggleCard: () => null }));

const mockWorkspace = {
  id: "ws-1", name: "QA Workspace", slug: "qa-workspace", owner_id: "owner-1",
  created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z",
  currency: "BRL", locale: "pt-BR", timezone: null,
};

function renderConfiguracoesOnDataTab() {
  return render(
    <MemoryRouter initialEntries={["/configuracoes?tab=data"]}>
      <Configuracoes />
    </MemoryRouter>,
  );
}

describe("Configuracoes · incidente #4 (Fatia 10) — SupabaseQuotesViewerCard montado na aba Dados", () => {
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
  });

  it("aba Dados renderiza o card do viewer (título real), incondicionalmente com workspace", async () => {
    renderConfiguracoesOnDataTab();

    expect(await screen.findByText("Orçamentos no Supabase (Experimental)")).toBeInTheDocument();
  });

  it("regressão: sem a correção do incidente #4 o card nunca aparecia — aqui aparece, sem depender de nenhuma flag", async () => {
    vi.mocked(useSupabaseQuotes).mockReturnValue({
      quotes: [], loading: false, error: null, refresh: vi.fn(),
      createQuoteWithItems: vi.fn(), updateQuote: vi.fn(), archiveQuote: vi.fn(),
      softDeleteQuote: vi.fn(), replaceQuoteItems: vi.fn(), updateStatus: vi.fn(),
    } as never);

    renderConfiguracoesOnDataTab();

    expect(await screen.findByText("Nenhum orçamento encontrado no Supabase para este workspace.")).toBeInTheDocument();
  });
});
