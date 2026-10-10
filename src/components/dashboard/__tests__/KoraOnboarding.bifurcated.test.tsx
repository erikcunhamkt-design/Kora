// G92/B4 (kora-hub-auditoria-e-plano.md) — steps 1 (cliente), 4 (orçamento)
// e 5 (recebível/projeto) liam a fonte LOCAL de domínios já flipados, mesmo
// em modo Supabase. Prova com dados SÓ-NUVEM (sem contraparte local) —
// lição G82: fixture puramente local mascararia exatamente essa classe de
// bug, já que ela só aparece quando local e nuvem DIVERGEM.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { KoraOnboarding } from "@/components/dashboard/KoraOnboarding";
import { useClients } from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useBifurcatedQuotes } from "@/hooks/useBifurcatedQuotes";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";

vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: () => ({ leads: [] }) }));
vi.mock("@/hooks/useBifurcatedQuotes", () => ({ useBifurcatedQuotes: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useBifurcatedProjects", () => ({ useBifurcatedProjects: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientTechnicalSheetsRepository", () => ({
  clientTechnicalSheetsRepository: { listTechnicalSheets: vi.fn() },
}));

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
  vi.mocked(clientTechnicalSheetsRepository.listTechnicalSheets).mockResolvedValue([] as never);
  // Baseline: nada em lugar nenhum — todos os steps verificados aqui pendentes.
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);
  vi.mocked(useBifurcatedQuotes).mockReturnValue([] as never);
  vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
  vi.mocked(useBifurcatedProjects).mockReturnValue([] as never);
});

describe("KoraOnboarding · step1 (cliente) com cliente SÓ-NUVEM (G92/B4)", () => {
  it("cliente só-nuvem (ausente de useClients local) completa o passo 1", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{ id: "cloud-client-uuid", name: "Cliente Nuvem", isDemo: false }],
    } as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    expect(await screen.findByText(/1 de 6 concluídos/)).toBeInTheDocument();
  });
});

describe("KoraOnboarding · step4 (orçamento) com orçamento SÓ-NUVEM (G92/B4)", () => {
  it("orçamento só-nuvem (ausente de useQuotes local) completa o passo 4", async () => {
    vi.mocked(useBifurcatedQuotes).mockReturnValue([
      { id: "cloud-quote-uuid", title: "Orçamento Nuvem", isDemo: false, status: "enviado" },
    ] as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    expect(await screen.findByText(/1 de 6 concluídos/)).toBeInTheDocument();
  });
});

describe("KoraOnboarding · step5 (recebível/projeto) com dados SÓ-NUVEM (G92/B4)", () => {
  it("projeto só-nuvem (ausente de useProjects local) vinculado a orçamento completa o passo 5", async () => {
    vi.mocked(useBifurcatedProjects).mockReturnValue([
      { id: "cloud-project-uuid", name: "Projeto Nuvem", isDemo: false, quoteId: "q-1" },
    ] as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    expect(await screen.findByText(/1 de 6 concluídos/)).toBeInTheDocument();
  });

  it("transação só-nuvem (ausente de useFinance local) com source='quote' completa o passo 5", async () => {
    vi.mocked(useBifurcatedFinance).mockReturnValue([
      { id: "cloud-tx-uuid", title: "Recebível Nuvem", isDemo: false, source: "quote" },
    ] as never);

    render(<KoraOnboarding />, { wrapper: Providers });

    expect(await screen.findByText(/1 de 6 concluídos/)).toBeInTheDocument();
  });
});
