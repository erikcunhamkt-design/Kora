// G84 — o componente <ClientTechnicalSheetDialog> (nunca montado) foi removido; o
// teste que o cobria (src/components/clients/__tests__/ClientTechnicalSheetDialog.test.tsx)
// exercitava, na prática, a lógica COMPARTILHADA e ainda viva: o <OverviewGrid>
// (usado pela página da ficha) + statusOf (status por seção) + a invariante G63
// de que a senha nunca é renderizada. Convertido pra testar o OverviewGrid direto.
// (A leitura bifurcada por cliente tem cobertura própria: useBifurcatedTechnicalSheet.test.ts,
// technicalSheet.consumers.uuid.test.tsx e ClientTechnicalSheet.uuid.test.tsx.)
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { OverviewGrid } from "@/components/clients/ClientTechnicalSheetDialog";
import type { ClientTechnicalSheet } from "@/types/domain";

function renderOverview(sheet: ClientTechnicalSheet) {
  return render(<OverviewGrid sheet={sheet} onOpen={vi.fn()} />);
}

describe("OverviewGrid — status por seção (lógica compartilhada com a página da ficha)", () => {
  it("branding com slogan/tom de voz aparece como 'Parcial'", () => {
    renderOverview({ branding: { slogan: "Sua marca, em todo lugar", voiceTone: "Confiante" } });

    const brandingCard = screen.getByText("Branding").closest("button");
    expect(brandingCard).not.toBeNull();
    expect(brandingCard!.textContent).toContain("Parcial");
  });

  it("regressão: ficha vazia mostra 'Vazio' em branding", () => {
    renderOverview({});

    const brandingCard = screen.getByText("Branding").closest("button");
    expect(brandingCard!.textContent).toContain("Vazio");
  });

  it("[invariante G63] accesses com password: a seção conta como 'Parcial', mas o texto da senha nunca é renderizado", () => {
    renderOverview({
      accesses: [{ id: "ac-1", platform: "WordPress", login: "admin", password: "s3nh4-secreta" }],
    } as never);

    expect(screen.queryByText("s3nh4-secreta")).not.toBeInTheDocument();
    const accessesCard = screen.getByText("Acessos").closest("button");
    expect(accessesCard!.textContent).toContain("Parcial");
  });

  it("[G83] concorrentes preenchidos contam como seção preenchida (agora voltam da nuvem)", () => {
    renderOverview({ competitors: [{ id: "c1", name: "Rival A" }] });

    const card = screen.getByText("Concorrentes").closest("button");
    expect(card!.textContent).not.toContain("Vazio");
  });
});
