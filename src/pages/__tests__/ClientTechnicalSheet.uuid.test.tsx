// G82 (docs/architecture/kora-hub-auditoria-e-plano.md) — a página da ficha
// recebe o id da lista de Clientes em NUVEM (uuid). Hooks REAIS
// (useSupabaseTechnicalSheet resolve o vínculo de verdade), fixtures com uuid
// REAL — só o repository, o workspace e a lista de clientes são mockados.
// ClientTechnicalSheet.test.tsx (G63) mocka useSupabaseTechnicalSheet e usa
// id numérico: nunca exercitou a classe G67 (Number(uuid)=NaN, chave de mapa
// local que não casa com uuid, updateClient(uuid) sem alvo).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ClientTechnicalSheetPage from "@/pages/ClientTechnicalSheet";
import { useClients } from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import { clientAssetsStorage } from "@/services/storage/clientAssetsStorage";
import { toast } from "sonner";

vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientTechnicalSheetsRepository", () => ({
  clientTechnicalSheetsRepository: { getTechnicalSheet: vi.fn(), upsertTechnicalSheet: vi.fn() },
}));
vi.mock("@/services/storage/clientAssetsStorage", () => ({
  clientAssetsStorage: {
    validateFile: vi.fn(() => ({ valid: true })),
    validateMaterialFile: vi.fn(() => ({ valid: true })),
    uploadClientLogo: vi.fn(),
    uploadClientMaterial: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

function cloudClient() {
  // Cliente como o mapper cloud o entrega: id uuid, SEM technicalSheet.
  return {
    id: UUID as unknown as number, name: "Cliente Nuvem", company: "Nuvem Ltda", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", status: "Ativo" as const, potentialValue: 0,
    lastProject: "", lastInteraction: "", observations: "", projects: [], tasks: [],
  };
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/clientes/${UUID}/ficha-tecnica`]}>
        <Routes>
          <Route path="/clientes/:clientId/ficha-tecnica" element={<ClientTechnicalSheetPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const updateClient = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  // Cliente só-nuvem: ausente do storage local.
  vi.mocked(useClients).mockReturnValue({ updateClient, clients: [] } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ clients: [cloudClient()] } as never);
  vi.mocked(clientTechnicalSheetsRepository.getTechnicalSheet).mockResolvedValue(null as never);
  vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mockResolvedValue({ id: "sheet-1" } as never);
});

async function openSection(label: string) {
  // Menu lateral da página: botões com o label da seção.
  const buttons = await screen.findAllByRole("button", { name: new RegExp(label, "i") });
  fireEvent.click(buttons[0]);
}

describe("ClientTechnicalSheet — G82 (cliente só-nuvem, id uuid)", () => {
  it("vínculo resolvido pelo próprio uuid: busca a ficha na nuvem e NÃO mostra 'não está vinculado ao Supabase'", async () => {
    renderPage();
    await screen.findByText("Ficha técnica");

    await waitFor(() =>
      expect(clientTechnicalSheetsRepository.getTechnicalSheet).toHaveBeenCalledWith("ws1", UUID),
    );
    expect(screen.queryByText(/ainda não está vinculado ao Supabase/i)).not.toBeInTheDocument();
  });

  it("salvar uma seção grava NA NUVEM pelo caminho nativo (upsert com o uuid) e NUNCA chama updateClient local — sem nenhum flag setado", async () => {
    renderPage();
    await screen.findByText("Ficha técnica");
    await openSection("Briefing & Notas");

    fireEvent.change(await screen.findByPlaceholderText(/Histórico, objetivos/i), {
      target: { value: "briefing de teste G82" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Salvar seção/i }));

    await waitFor(() => expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).toHaveBeenCalledTimes(1));
    const [ws, clientUuid, payload] = vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mock.calls[0];
    expect(ws).toBe("ws1");
    expect(clientUuid).toBe(UUID);
    expect((payload as { briefing?: { generalBriefing?: string } }).briefing?.generalBriefing).toBe("briefing de teste G82");
    expect(updateClient).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("[G75] editar Concorrentes numa ficha da nuvem avisa que o campo não persiste (sem caminho nativo) — não finge sucesso silencioso", async () => {
    renderPage();
    await screen.findByText("Ficha técnica");
    await openSection("Concorrentes");

    fireEvent.click(await screen.findByRole("button", { name: /Novo concorrente/i }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "Rival S.A." } });
    fireEvent.click(within(dialog).getByRole("button", { name: /^Salvar$/ }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalledTimes(1));
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toMatch(/Concorrentes ainda não é salvo/);
  });

  it("upload de logo resolve o vínculo (antes: Number(uuid)=NaN ⇒ 'Vínculo Supabase ou workspace ativo ausente.')", async () => {
    vi.mocked(clientAssetsStorage.uploadClientLogo).mockResolvedValue({ path: "p", url: "https://x/p" } as never);
    renderPage();
    await screen.findByText("Ficha técnica");
    await openSection("Branding");

    await screen.findByText(/Selecionar e Enviar/i);
    const input = document.querySelector('input[type="file"][accept="image/png,image/jpeg,image/webp"]') as HTMLInputElement;
    const file = new File(["x"], "logo.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(clientAssetsStorage.uploadClientLogo).toHaveBeenCalledWith("ws1", UUID, file));
    expect(toast.error).not.toHaveBeenCalledWith("Vínculo Supabase ou workspace ativo ausente.");
  });
});

describe("ClientTechnicalSheet — G82 (cliente legado importado: local id 7 ↔ uuid no mapa)", () => {
  beforeEach(() => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "7": UUID } }));
    vi.mocked(useClients).mockReturnValue({
      updateClient,
      clients: [{ ...cloudClient(), id: 7, technicalSheet: { briefing: { generalBriefing: "local legado" } } }],
    } as never);
  });

  it("modo local (flags no default): a ficha local do cliente 7 é carregada e salvar chama updateClient(7), nunca o upsert da nuvem", async () => {
    renderPage();
    await screen.findByText("Ficha técnica");
    await openSection("Briefing & Notas");

    const textarea = await screen.findByPlaceholderText(/Histórico, objetivos/i);
    await waitFor(() => expect((textarea as HTMLTextAreaElement).value).toBe("local legado"));
    fireEvent.change(textarea, { target: { value: "editado" } });
    fireEvent.click(screen.getByRole("button", { name: /Salvar seção/i }));

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    expect(updateClient.mock.calls[0][0]).toBe(7);
    expect(updateClient.mock.calls[0][1].technicalSheet.briefing.generalBriefing).toBe("editado");
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
  });
});
