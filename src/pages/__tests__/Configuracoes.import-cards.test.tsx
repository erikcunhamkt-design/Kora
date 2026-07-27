// O5 (Fatia 8) — os importadores de clients/opportunities travavam o botão que abre
// o diálogo quando não havia nenhum candidato "new" (eligibleCandidates.length === 0),
// mesmo o diálogo já sabendo renderizar "Já Importado"/"Duplicado" perfeitamente.
// quotes/projects/tasks já abrem sempre (LocalQuotesImportCard/LocalProjectsImportCard/
// LocalTasksImportCard usam um Card inteiro como DialogTrigger, sem disabled). Estes
// testes cobrem só a regressão: o diálogo abre mesmo com todos os candidatos "imported".
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { LocalClientsImportCard, LocalOpportunitiesImportCard } from "@/pages/Configuracoes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useLocalClientsImport } from "@/hooks/useLocalClientsImport";
import { useLocalOpportunitiesImport } from "@/hooks/useLocalOpportunitiesImport";

vi.mock("@/hooks/useCurrentWorkspace");
vi.mock("@/hooks/useLocalClientsImport");
vi.mock("@/hooks/useLocalOpportunitiesImport");

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
