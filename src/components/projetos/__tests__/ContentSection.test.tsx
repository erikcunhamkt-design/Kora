// G92/B4 (kora-hub-auditoria-e-plano.md, varredura de consumidores fora dos
// módulos principais) — o seletor de cliente do calendário editorial lia
// useClients() local direto, mesmo em modo Supabase (default pós-flip): um
// cliente só-nuvem (uuid, sem contraparte local) nunca aparecia no picker.
// Prova com uuid real (lição G67/G82: id numérico legado mascararia a
// classe) — este módulo nunca persiste um clientId, só o nome (`clientName`
// em `ContentItem`), então não há compat de id legado a preservar aqui.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ContentSection } from "@/components/projetos/ContentSection";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";

vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("ContentSection · seletor de cliente — cliente SÓ-NUVEM (G92/B4)", () => {
  it("cliente só-nuvem (uuid, ausente de useClients local) aparece no picker", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{
        id: "87ebd1d2-b17a-46f4-b0eb-70beac445221", name: "Cliente Nuvem", company: "", isDemo: false,
      }],
    } as never);

    render(<ContentSection />);

    expect(await screen.findByText("Cliente Nuvem")).toBeInTheDocument();
  });

  it("regressão: cliente local continua aparecendo normalmente", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [{ id: 1, name: "Cliente Local", company: "", isDemo: false }],
    } as never);

    render(<ContentSection />);

    expect(await screen.findByText("Cliente Local")).toBeInTheDocument();
  });

  it("sem cliente nenhum: tela inicial mostra o estado vazio, sem quebrar", async () => {
    vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);

    render(<ContentSection />);

    expect(await screen.findByText("Todos os conteúdos")).toBeInTheDocument();
  });
});
