// G74 (etapa-5-flip-fichas-pacote.md §11, fatia F3) — ClientTechnicalSheetSnapshot
// (usado dentro de ProjectDetailDrawer.tsx) passa a ler a ficha técnica via
// useBifurcatedTechnicalSheet(client.id), não mais client.technicalSheet.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ClientTechnicalSheetSnapshot } from "@/components/clients/ClientTechnicalSheetSnapshot";
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

describe("ClientTechnicalSheetSnapshot — G74", () => {
  it("cores de branding de uma ficha só-nuvem aparecem (client.technicalSheet vazio/undefined)", () => {
    const client = makeClient({ technicalSheet: undefined });
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      branding: { colors: ["#ff0000"] },
    } as never);

    render(
      <MemoryRouter>
        <ClientTechnicalSheetSnapshot client={client} defaultOpen />
      </MemoryRouter>,
    );

    expect(screen.getByText("#ff0000")).toBeInTheDocument();
  });

  it("regressão: sem dado na ficha (hook devolve objeto vazio), mostra o estado 'ainda não preenchida'", () => {
    const client = makeClient();
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);

    render(
      <MemoryRouter>
        <ClientTechnicalSheetSnapshot client={client} defaultOpen />
      </MemoryRouter>,
    );

    expect(screen.getByText("Ficha técnica ainda não preenchida.")).toBeInTheDocument();
  });
});
