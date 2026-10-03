// G82 — consumidores vivos da ficha técnica (G74/F3) com hooks REAIS
// (useBifurcatedTechnicalSheet → useSupabaseTechnicalSheet → resolução do
// vínculo) e cliente só-nuvem com id uuid REAL. Os testes dos consumidores
// em ClientTechnicalSheetSnapshot.test.tsx / ClientProfileDrawer.technicalSheet.test.tsx
// mockam o hook inteiro, então nunca pegariam a classe G67 (id uuid que o
// mapa local→uuid não resolve). Só repository e workspace são mockados.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { ClientTechnicalSheetSnapshot } from "@/components/clients/ClientTechnicalSheetSnapshot";
import { ClientProfileDrawer } from "@/components/clients/ClientProfileDrawer";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientTechnicalSheetsRepository", () => ({
  clientTechnicalSheetsRepository: { getTechnicalSheet: vi.fn() },
}));

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

// Cliente como o mapper cloud o entrega: id uuid, SEM technicalSheet local.
function cloudClient(): Client {
  return {
    id: UUID as unknown as number, name: "Cliente Nuvem", company: "", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", status: "Ativo",
    potentialValue: 0, lastProject: "—", lastInteraction: "—",
    observations: "", projects: [], tasks: [],
  } as Client;
}

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
  vi.mocked(clientTechnicalSheetsRepository.getTechnicalSheet).mockResolvedValue({
    id: "sheet-1", workspace_id: "ws1", client_id: UUID, created_at: "", updated_at: "",
    branding: { colors: ["#ff0000"], slogan: "Slogan da nuvem" },
    persona: { name: "Camila, 32" },
    social_links: { instagram: "https://instagram.com/cliente-nuvem" },
    materials: [],
    raw_payload: { assets: [{ id: "a-1", title: "Manual da nuvem", type: "briefing", url: "https://x/manual", accessStatus: "liberado" }] },
  } as never);
});

describe("consumidores da ficha — cliente só-nuvem (id uuid), hooks reais", () => {
  it("ClientTechnicalSheetSnapshot mostra as cores do branding vindas da nuvem (antes: vazio)", async () => {
    render(<ClientTechnicalSheetSnapshot client={cloudClient()} defaultOpen />, { wrapper: Providers });

    expect(await screen.findByText("#ff0000")).toBeInTheDocument();
    expect(clientTechnicalSheetsRepository.getTechnicalSheet).toHaveBeenCalledWith("ws1", UUID);
  });

  it("ClientProfileDrawer · aba Materiais lista material e rede social da ficha da nuvem", async () => {
    render(
      <ClientProfileDrawer client={cloudClient()} onClose={vi.fn()} onEdit={vi.fn()} onWhats={vi.fn()} initialTab="materials" />,
      { wrapper: Providers },
    );

    expect(await screen.findByText("Manual da nuvem")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("ClientProfileDrawer · aba Ficha Técnica conta as seções preenchidas da nuvem (branding + persona + redes + materiais)", async () => {
    render(
      <ClientProfileDrawer client={cloudClient()} onClose={vi.fn()} onEdit={vi.fn()} onWhats={vi.fn()} initialTab="sheet" />,
      { wrapper: Providers },
    );

    expect(await screen.findByText(/4 \/ 7 seções/)).toBeInTheDocument();
  });
});
