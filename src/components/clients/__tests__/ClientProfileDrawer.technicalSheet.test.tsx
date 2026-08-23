// G74 (etapa-5-flip-fichas-pacote.md §11, fatia F3) — MaterialsTab e SheetTab
// (sub-componentes internos de ClientProfileDrawer.tsx) passam a ler a ficha
// técnica via useBifurcatedTechnicalSheet(client.id), não mais
// client.technicalSheet direto. Renderiza a drawer inteira com `initialTab`
// fixo — Radix Tabs.Content só monta o painel ativo, então só o
// sub-componente sob teste (e suas dependências) precisa de mock.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { ClientProfileDrawer } from "@/components/clients/ClientProfileDrawer";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
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
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
});

function renderDrawer(client: Client, initialTab: string) {
  return render(
    <MemoryRouter>
      <ClientProfileDrawer
        client={client}
        onClose={vi.fn()}
        onEdit={vi.fn()}
        onWhats={vi.fn()}
        initialTab={initialTab}
      />
    </MemoryRouter>,
  );
}

describe("ClientProfileDrawer · MaterialsTab — G74", () => {
  it("materiais e redes sociais de uma ficha só-nuvem aparecem (client.technicalSheet vazio/undefined)", () => {
    const client = makeClient({ technicalSheet: undefined });
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      assets: [{ id: "a-1", title: "Manual da marca", type: "briefing", url: "https://x", accessStatus: "liberado" }],
      socialLinks: { instagram: "https://instagram.com/cliente-x" },
    } as never);

    renderDrawer(client, "materials");

    expect(screen.getByText("Manual da marca")).toBeInTheDocument();
    expect(screen.getByText("Instagram")).toBeInTheDocument();
  });

  it("regressão: sem dado na ficha (hook devolve objeto vazio), mostra os estados vazios de sempre", () => {
    const client = makeClient();
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);

    renderDrawer(client, "materials");

    expect(screen.getByText("Nenhum material cadastrado na ficha técnica.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum link de rede cadastrado.")).toBeInTheDocument();
  });
});

describe("ClientProfileDrawer · SheetTab — G74 + invariante G63", () => {
  it("branding/persona de uma ficha só-nuvem contam no preenchimento", () => {
    const client = makeClient({ technicalSheet: undefined });
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      branding: { slogan: "Sua marca, em todo lugar", voiceTone: "Confiante" },
      persona: { name: "Camila, 32" },
    } as never);

    renderDrawer(client, "sheet");

    // branding (1) + persona (1) = 2 das 7 seções — cada seção conta 1x,
    // independente de quantos campos internos ela tem preenchidos.
    expect(screen.getByText(/2 \/ 7 seções/)).toBeInTheDocument();
  });

  it("[invariante G63] mesmo se o hook devolvesse accesses com password, o texto da senha nunca aparece na tela", () => {
    const client = makeClient();
    vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({
      accesses: [{ id: "ac-1", platform: "WordPress", login: "admin", password: "s3nh4-secreta" }],
    } as never);

    renderDrawer(client, "sheet");

    expect(screen.queryByText("s3nh4-secreta")).not.toBeInTheDocument();
    // "Acessos" conta como preenchido (1 seção), mas nunca expõe o valor da senha.
    expect(screen.getByText(/1 \/ 7 seções/)).toBeInTheDocument();
  });
});
