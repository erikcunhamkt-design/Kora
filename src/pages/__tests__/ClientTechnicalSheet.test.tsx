// G63 (16/ago/2026) — prova de que o domínio de Fichas Técnicas voltou a ser
// governado (opt-in, default OFF) e que o payload de escrita nunca carrega
// accesses[].password. Ver docs/architecture/kora-hub-auditoria-e-plano.md
// (G63) e docs/qa/etapa-5-flip-fichas-pacote.md (achado original).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import ClientTechnicalSheetPage from "@/pages/ClientTechnicalSheet";
import { useClients } from "@/hooks/useClients";
import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import {
  TECHNICAL_SHEETS_EXPERIMENTAL_KEY,
  TECHNICAL_SHEETS_AUTOSAVE_KEY,
  TECHNICAL_SHEETS_DATA_SOURCE_KEY,
} from "@/config/flags";

vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useSupabaseTechnicalSheet", () => ({ useSupabaseTechnicalSheet: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/repositories/clientTechnicalSheetsRepository", () => ({
  clientTechnicalSheetsRepository: { upsertTechnicalSheet: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

const CLIENT_ID = 1;

// Cliente local com uma ficha técnica preenchida, incluindo accesses[] com
// senha — o vetor de vazamento do G63.
function makeClientWithAccesses() {
  return {
    id: CLIENT_ID, name: "Acme", company: "Acme Corp", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", status: "Ativo" as const, potentialValue: 0,
    lastProject: "", lastInteraction: "", observations: "", projects: [], tasks: [],
    technicalSheet: {
      branding: { slogan: "Sempre adiante" },
      accesses: [
        { id: "ac1", platform: "Instagram", login: "acme@x.com", password: "SENHA-ULTRASSECRETA", notes: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
      ],
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/clientes/${CLIENT_ID}/ficha-tecnica`]}>
      <Routes>
        <Route path="/clientes/:clientId/ficha-tecnica" element={<ClientTechnicalSheetPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({
    workspace: { id: "ws1", name: "W", slug: "w", owner_id: "o", created_at: "", updated_at: "", currency: "BRL", locale: "pt-BR", timezone: null },
    membership: null, loading: false, error: null,
  } as never);
  vi.mocked(useClients).mockReturnValue({
    clients: [makeClientWithAccesses()],
    updateClient: vi.fn(),
  } as never);
  vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
    supabaseClientId: "uuid-cliente-1",
    sheet: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  } as never);
});

describe("ClientTechnicalSheet · G63 item 2 — defaults intocados fecham o domínio", () => {
  it("sem nenhuma flag setada: seletor de fonte e botão 'Salvar no Supabase' NÃO aparecem — nenhum caminho de escrita cloud alcançável pela UI", async () => {
    renderPage();
    await screen.findByText("Ficha técnica");

    expect(screen.queryByText("Supabase experimental")).not.toBeInTheDocument();
    expect(screen.queryByText(/Salvar versão atual no Supabase/i)).not.toBeInTheDocument();
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
  });
});

describe("ClientTechnicalSheet · G63 item 1+3 — opt-in explícito liga a escrita, sanitizada", () => {
  it("com experimental=true, botão 'Salvar no Supabase' aparece; ao clicar, upsertTechnicalSheet é chamado SEM accesses/password", async () => {
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "true");
    vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mockResolvedValue({ id: "sheet-1" } as never);

    renderPage();
    await screen.findByText("Ficha técnica");

    // Botão abre um AlertDialog de confirmação — a escrita só dispara ao
    // confirmar dentro do diálogo (2 passos, não 1 clique direto).
    const trigger = await screen.findByText(/Salvar versão atual no Supabase/i);
    fireEvent.click(trigger);
    const confirmButton = await screen.findByRole("button", { name: "Salvar no Supabase" });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).toHaveBeenCalledTimes(1));

    const [, , payload] = vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mock.calls[0];
    const rawPayload = (payload as { raw_payload?: Record<string, unknown> }).raw_payload ?? {};
    expect(rawPayload).not.toHaveProperty("accesses");
    expect(JSON.stringify(rawPayload)).not.toContain("SENHA-ULTRASSECRETA");
  });

  it("com experimental=false (default) mesmo que autosave=true isolado: botão/seletor seguem ausentes — as 2 flags juntas é que abrem o domínio, não uma isolada", async () => {
    localStorage.setItem(TECHNICAL_SHEETS_AUTOSAVE_KEY, "true");
    renderPage();
    await screen.findByText("Ficha técnica");

    expect(screen.queryByText(/Salvar versão atual no Supabase/i)).not.toBeInTheDocument();
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
  });
});

describe("ClientTechnicalSheet · G63 — seletor de fonte por-cliente também é opt-in agora", () => {
  it("getTechnicalSheetDataSource sem entrada no mapa resolve 'local' — confirmado indiretamente via ausência do badge 'Supabase experimental' mesmo com experimental=true", async () => {
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "true");
    renderPage();
    await screen.findByText("Ficha técnica");

    // Seletor aparece (experimental ON), mas a fonte ATIVA é local — o botão
    // "Local" deve estar marcado como selecionado (variant "default"), não o
    // "Supabase experimental".
    const localButton = screen.getByRole("button", { name: "Local" });
    expect(localButton.className).toMatch(/bg-primary/);
  });
});
