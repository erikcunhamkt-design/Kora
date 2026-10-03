// G82 (5º consumidor da ficha, mesma família do G74) — o passo "Preencher
// Ficha Técnica" do onboarding lia só `client.technicalSheet` do storage local
// e nunca completava para cliente só-nuvem. Hook de leitura da nuvem REAL;
// só repository, workspace e os demais hooks de dado são mockados.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { KoraOnboarding } from "@/components/dashboard/KoraOnboarding";
import { useClients } from "@/hooks/useClients";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";

vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: () => ({ leads: [] }) }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: () => ({ quotes: [] }) }));
vi.mock("@/hooks/useFinance", () => ({ useFinance: () => ({ transactions: [] }) }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ projects: [] }) }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientTechnicalSheetsRepository", () => ({
  clientTechnicalSheetsRepository: { listTechnicalSheets: vi.fn() },
}));

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

function Providers({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  // Cliente só-nuvem: nenhum cliente local, nenhuma ficha local.
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
});

describe("KoraOnboarding · passo 'Preencher Ficha Técnica' — G82", () => {
  it("ficha preenchida SÓ na nuvem (cliente uuid, sem cliente local) completa o passo", async () => {
    vi.mocked(clientTechnicalSheetsRepository.listTechnicalSheets).mockResolvedValue([
      { id: "sheet-1", workspace_id: "ws1", client_id: UUID, created_at: "", updated_at: "", branding: { slogan: "Slogan da nuvem" } },
    ] as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    expect(await screen.findByText(/1 de 6 concluídos/)).toBeInTheDocument();
    expect(clientTechnicalSheetsRepository.listTechnicalSheets).toHaveBeenCalledWith("ws1");
  });

  it("regressão: sem ficha em lugar nenhum, o passo continua pendente", async () => {
    vi.mocked(clientTechnicalSheetsRepository.listTechnicalSheets).mockResolvedValue([] as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    expect(await screen.findByText(/0 de 6 concluídos/)).toBeInTheDocument();
  });

  it("regressão: ficha local de cliente não-demo continua completando o passo (fonte local intacta)", async () => {
    vi.mocked(clientTechnicalSheetsRepository.listTechnicalSheets).mockResolvedValue([] as never);
    vi.mocked(useClients).mockReturnValue({
      clients: [{ id: 1, name: "Local", isDemo: false, technicalSheet: { persona: { name: "Camila" } } }],
    } as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    // step1 (cliente não-demo) + step2 (ficha local) = 2
    expect(await screen.findByText(/2 de 6 concluídos/)).toBeInTheDocument();
  });
});
