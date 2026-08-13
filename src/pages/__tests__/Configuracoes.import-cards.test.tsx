// O5 (Fatia 8) — os importadores de clients/opportunities travavam o botão que abre
// o diálogo quando não havia nenhum candidato "new" (eligibleCandidates.length === 0),
// mesmo o diálogo já sabendo renderizar "Já Importado"/"Duplicado" perfeitamente.
// quotes/projects/tasks já abrem sempre (LocalQuotesImportCard/LocalProjectsImportCard/
// LocalTasksImportCard usam um Card inteiro como DialogTrigger, sem disabled). Estes
// testes cobrem só a regressão: o diálogo abre mesmo com todos os candidatos "imported".
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { LocalClientsImportCard, LocalOpportunitiesImportCard, LocalTechnicalSheetsImportCard } from "@/pages/Configuracoes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useLocalClientsImport } from "@/hooks/useLocalClientsImport";
import { useLocalOpportunitiesImport } from "@/hooks/useLocalOpportunitiesImport";
import { useLocalTechnicalSheetsImport } from "@/hooks/useLocalTechnicalSheetsImport";
import { setCrmDataSource, CRM_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useLocalClientsImport");
vi.mock("@/hooks/useLocalOpportunitiesImport");
vi.mock("@/hooks/useLocalTechnicalSheetsImport");

const mockWorkspace = {
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
};

describe("Configuracoes import cards — O5 (dialog opens with zero eligible candidates)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue(mockWorkspace);
  });

  it("LocalClientsImportCard: trigger is not disabled and opens the dialog when every candidate is already imported", () => {
    vi.mocked(useLocalClientsImport).mockReturnValue({
      candidates: [
        {
          id: 1,
          name: "Cliente Já Importado",
          company: "Empresa QA",
          email: "qa@kora.com",
          phone: "11999999999",
          status: "",
          archived: false,
          matchStatus: "imported",
          matchedId: "supabase-uuid-1",
          raw: {} as never,
        },
      ],
      importing: false,
      importSelected: vi.fn(),
      importedIds: [1],
      metadata: { lastImportedAt: "2024-01-01T00:00:00Z", importedLocalIds: [1], skippedLocalIds: [], importedMap: { "1": "supabase-uuid-1" } },
    });

    render(<LocalClientsImportCard />);

    const trigger = screen.getByRole("button", { name: "Analisar importação" });
    expect(trigger).not.toBeDisabled();

    fireEvent.click(trigger);

    expect(screen.getByText("Análise de Importação de Clientes")).toBeInTheDocument();
    expect(screen.getByText("Já Importado")).toBeInTheDocument();
  });

  it("LocalOpportunitiesImportCard: trigger is not disabled and opens the dialog when every candidate is already imported", () => {
    vi.mocked(useLocalOpportunitiesImport).mockReturnValue({
      candidates: [
        {
          id: 1,
          name: "Oportunidade Já Importada",
          company: "Empresa QA",
          email: "qa@kora.com",
          phone: "11999999999",
          stage: "proposta",
          archived: false,
          matchStatus: "imported",
          matchedId: "supabase-uuid-1",
          clientOrphan: false,
          raw: {} as never,
        },
      ],
      importing: false,
      importSelected: vi.fn(),
      importedIds: [1],
      metadata: { lastImportedAt: "2024-01-01T00:00:00Z", importedLocalIds: [1], skippedLocalIds: [], importedMap: { "1": "supabase-uuid-1" } },
    });

    render(<LocalOpportunitiesImportCard />);

    const trigger = screen.getByRole("button", { name: "Analisar importação" });
    expect(trigger).not.toBeDisabled();

    fireEvent.click(trigger);

    expect(screen.getByText("Análise de Importação de Oportunidades")).toBeInTheDocument();
    expect(screen.getByText("Já Importada")).toBeInTheDocument();
  });
});

describe("Configuracoes import cards — O6 (LocalTechnicalSheetsImportCard, same trigger regression as O5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue(mockWorkspace);
  });

  it("LocalTechnicalSheetsImportCard: trigger is not disabled and opens the dialog when every candidate already exists in Supabase", () => {
    vi.mocked(useLocalTechnicalSheetsImport).mockReturnValue({
      candidates: [
        {
          localClientId: 1,
          name: "Cliente Já Importado",
          company: "Empresa QA",
          status: "existe",
          statusText: "Já existe no Supabase",
          supabaseClientId: "supabase-uuid-1",
          supabaseTechnicalSheetId: "supabase-sheet-1",
          rawLocalSheet: {},
        },
      ],
      importing: false,
      importSelected: vi.fn(),
      metadata: { lastImportedAt: "2024-01-01T00:00:00Z", importedLocalClientIds: [1], importedMap: { "1": "supabase-sheet-1" } },
      refresh: vi.fn(),
      loading: false,
    });

    render(<LocalTechnicalSheetsImportCard />);

    const trigger = screen.getByRole("button", { name: "Analisar importação" });
    expect(trigger).not.toBeDisabled();

    fireEvent.click(trigger);

    expect(screen.getByText("Análise de Importação de Fichas Técnicas")).toBeInTheDocument();
    expect(screen.getByText("Já Importada")).toBeInTheDocument();
  });
});

// G23 — os avisos híbridos eram string fixa (obsoleta desde jul/2026, sempre dizendo
// "ainda usa dados locais" mesmo com o default já em Supabase). Onde a fonte é uma
// flag simples (getCrmDataSource — CRM), o texto agora deriva do valor real, testado
// nos 2 estados pra provar que acompanha a flag em vez de reapodrecer sozinho.
describe("Configuracoes import cards — G23 (aviso híbrido deriva do estado real da flag)", () => {
  const emptyOpportunitiesMock = {
    candidates: [],
    importing: false,
    importSelected: vi.fn(),
    importedIds: [],
    metadata: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCurrentWorkspace).mockReturnValue(mockWorkspace);
    localStorage.removeItem(CRM_DATA_SOURCE_KEY);
  });

  it("LocalOpportunitiesImportCard: default (sem flag salva) mostra o texto de Supabase", () => {
    vi.mocked(useLocalOpportunitiesImport).mockReturnValue(emptyOpportunitiesMock as never);

    render(<LocalOpportunitiesImportCard />);

    expect(
      screen.getByText(/tela principal de CRM já lê do Supabase por padrão/),
    ).toBeInTheDocument();
  });

  it("LocalOpportunitiesImportCard: com getCrmDataSource() === 'local' mostra o texto de dados locais", () => {
    vi.mocked(useLocalOpportunitiesImport).mockReturnValue(emptyOpportunitiesMock as never);
    setCrmDataSource("local");

    render(<LocalOpportunitiesImportCard />);

    expect(
      screen.getByText(/tela principal de CRM está configurada para usar dados locais/),
    ).toBeInTheDocument();
  });

  it("LocalClientsImportCard: texto reflete que a tela Clientes já lê do Supabase por padrão", () => {
    vi.mocked(useLocalClientsImport).mockReturnValue({
      candidates: [],
      importing: false,
      importSelected: vi.fn(),
      importedIds: [],
      metadata: null,
    } as never);

    render(<LocalClientsImportCard />);

    expect(
      screen.getByText(/tela Clientes já lê do Supabase por padrão/),
    ).toBeInTheDocument();
  });

  it("LocalTechnicalSheetsImportCard: texto não afirma mais que a página principal usa localStorage", () => {
    vi.mocked(useLocalTechnicalSheetsImport).mockReturnValue({
      candidates: [],
      importing: false,
      importSelected: vi.fn(),
      metadata: null,
      refresh: vi.fn(),
      loading: false,
    } as never);

    render(<LocalTechnicalSheetsImportCard />);

    expect(
      screen.getByText(/página Ficha Técnica já lê do Supabase por padrão para cada cliente/),
    ).toBeInTheDocument();
  });
});
