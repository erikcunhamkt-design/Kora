// G74 (etapa-5-flip-fichas-pacote.md §11, fatia F3) — ClientTechnicalSheetDialog
// passa a seedar o draft inicial via useBifurcatedTechnicalSheet(client.id),
// não mais client.technicalSheet. Só a leitura INICIAL bifurca — a gravação
// do diálogo (onSave) continua no caminho local existente, fora de escopo.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { ClientTechnicalSheetDialog } from "@/components/clients/ClientTechnicalSheetDialog";
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useBifurcatedTechnicalSheet", () => ({ useBifurcatedTechnicalSheet: vi.fn() }));

function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: 1, name: "Cliente X", company: "", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", status: "Ativo",
    potentialValue: 0, lastProject: "—", lastInteraction: "—",
    observations: "", projects: [], tasks: [],
    ...overrides,
  } as Client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ClientTechnicalSheetDialog — G74 (draft inicial bifurcado)", () => {
  it("branding de uma ficha só-nuvem aparece como 'Parcial' no overview (client.technicalSheet vazio/undefined)", () => {
    const client = makeClient({ technicalSheet: undefined });
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      branding: { slogan: "Sua marca, em todo lugar", voiceTone: "Confiante" },
    } as never);

    render(
      <ClientTechnicalSheetDialog
        open
        onOpenChange={vi.fn()}
        client={client}
        onSave={vi.fn()}
      />,
    );

    const brandingCard = screen.getByText("Branding").closest("button");
    expect(brandingCard).not.toBeNull();
    expect(brandingCard!.textContent).toContain("Parcial");
  });

  it("regressão: sem dado na ficha (hook devolve objeto vazio), overview mostra 'Vazio' em todas as seções", () => {
    const client = makeClient();
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);

    render(
      <ClientTechnicalSheetDialog
        open
        onOpenChange={vi.fn()}
        client={client}
        onSave={vi.fn()}
      />,
    );

    const brandingCard = screen.getByText("Branding").closest("button");
    expect(brandingCard!.textContent).toContain("Vazio");
  });

  it("[invariante G63] mesmo se o hook devolvesse accesses com password, o texto da senha nunca aparece no overview", () => {
    const client = makeClient();
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      accesses: [{ id: "ac-1", platform: "WordPress", login: "admin", password: "s3nh4-secreta" }],
    } as never);

    render(
      <ClientTechnicalSheetDialog
        open
        onOpenChange={vi.fn()}
        client={client}
        onSave={vi.fn()}
      />,
    );

    expect(screen.queryByText("s3nh4-secreta")).not.toBeInTheDocument();
    const accessesCard = screen.getByText("Acessos").closest("button");
    expect(accessesCard!.textContent).toContain("Parcial");
  });
});
