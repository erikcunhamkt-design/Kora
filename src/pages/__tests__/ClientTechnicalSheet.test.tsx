// G63 (16/ago/2026) — o payload de escrita da ficha nunca carrega
// accesses[].password. F4 (flip): defaults pós-flip (nuvem + autosave LIGADO),
// rollback por override e usuário 100% local, sempre com essa invariante. Ver docs/architecture/kora-hub-auditoria-e-plano.md
// (G63) e docs/qa/etapa-5-flip-fichas-pacote.md (achado original).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import ClientTechnicalSheetPage from "@/pages/ClientTechnicalSheet";
import { useClients } from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import { toast } from "sonner";
import {
  TECHNICAL_SHEETS_EXPERIMENTAL_KEY,
  TECHNICAL_SHEETS_AUTOSAVE_KEY,
  TECHNICAL_SHEETS_DATA_SOURCE_KEY,
} from "@/config/flags";

vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
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
  // G82: o cliente existe TAMBÉM no storage local (id numérico) — é o cenário
  // "ficha local/legada" que estes testes do G63 cobrem. O cenário cliente
  // só-nuvem (uuid) tem arquivo próprio: ClientTechnicalSheet.uuid.test.tsx.
  vi.mocked(useClients).mockReturnValue({
    updateClient: vi.fn(),
    clients: [makeClientWithAccesses()],
  } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({
    clients: [makeClientWithAccesses()],
  } as never);
  vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
    supabaseClientId: "uuid-cliente-1",
    sheet: null,
    loading: false,
    error: null,
    refresh: vi.fn(),
  } as never);
});

// F4 (flip de Fichas): estes describes cobriam o domínio "fechado por padrão"
// do G63 (defaults desligados). Reescritos pra os defaults pós-flip — fonte =
// nuvem (só "local" explícito escolhe local), autosave LIGADO (só "false"
// desliga) — com a invariante do G63 intacta: o payload do autosave NUNCA leva
// accesses/password, e os acessos são só-locais.
const SENHA = "SENHA-ULTRASSECRETA";

async function openBriefingAndSave(text: string) {
  const nav = await screen.findAllByRole("button", { name: /Briefing & Notas/i });
  fireEvent.click(nav[0]);
  fireEvent.change(await screen.findByPlaceholderText(/Histórico, objetivos/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /Salvar seção/i }));
}

describe("ClientTechnicalSheet · F4 — defaults pós-flip (fonte nuvem + autosave LIGADO)", () => {
  it("sem nenhuma flag/override: a fonte ativa é a nuvem (botão 'Supabase (nuvem)' marcado) e o seletor aparece", async () => {
    renderPage();
    await screen.findByText("Ficha técnica");

    const cloudButton = screen.getByRole("button", { name: /Supabase \(nuvem\)/ });
    expect(cloudButton.className).toMatch(/bg-primary/);
    expect(screen.getByRole("button", { name: "Local" })).toBeInTheDocument();
  });

  it("autosave LIGADO por default: salvar uma seção grava na nuvem direto (sem clicar em 'Salvar versão atual')", async () => {
    vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mockResolvedValue({ id: "sheet-1" } as never);
    renderPage();
    await screen.findByText("Ficha técnica");

    await openBriefingAndSave("briefing F4");

    await waitFor(() => expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).toHaveBeenCalledTimes(1));
    const [ws, clientUuid, payload] = vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mock.calls[0];
    expect(ws).toBe("ws1");
    expect(clientUuid).toBe("uuid-cliente-1");
    expect((payload as { briefing?: { generalBriefing?: string } }).briefing?.generalBriefing).toBe("briefing F4");
  });

  it("[G63 — teste explícito do autosave] o payload do autosave NÃO tem accesses nem a senha, mesmo com acessos na ficha local", async () => {
    vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mockResolvedValue({ id: "sheet-1" } as never);
    renderPage();
    await screen.findByText("Ficha técnica");

    await openBriefingAndSave("outro texto");

    await waitFor(() => expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).toHaveBeenCalledTimes(1));
    const [, , payload] = vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mock.calls[0];
    const raw = (payload as { raw_payload?: Record<string, unknown> }).raw_payload ?? {};
    expect(raw).not.toHaveProperty("accesses");
    expect(JSON.stringify(payload)).not.toContain(SENHA);
    expect(JSON.stringify(payload)).not.toContain("accesses");
  });

  it("a ficha legada local (com acessos) ainda NÃO enviada à nuvem: a página avisa e aponta o import/fonte Local", async () => {
    renderPage();

    expect(await screen.findByText(/ficha salva só neste dispositivo que ainda não foi enviada/i)).toBeInTheDocument();
    expect(screen.getByText(/Importar Fichas Técnicas/)).toBeInTheDocument();
  });
});

describe("ClientTechnicalSheet · F4 — rollback nível 1 (overrides no localStorage)", () => {
  it("experimental = \"false\": fonte local, seletor some, salvar grava só local (updateClient) e NUNCA chama a nuvem", async () => {
    localStorage.setItem(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, "false");
    const updateClient = vi.fn();
    vi.mocked(useClients).mockReturnValue({ updateClient, clients: [makeClientWithAccesses()] } as never);

    renderPage();
    await screen.findByText("Ficha técnica");
    expect(screen.queryByRole("button", { name: /Supabase \(nuvem\)/ })).not.toBeInTheDocument();

    await openBriefingAndSave("rollback");

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    expect(updateClient.mock.calls[0][0]).toBe(CLIENT_ID);
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
  });

  it("seletor do cliente em \"local\" explícito (mapa por cliente): grava só local", async () => {
    localStorage.setItem(TECHNICAL_SHEETS_DATA_SOURCE_KEY, JSON.stringify({ [String(CLIENT_ID)]: "local" }));
    const updateClient = vi.fn();
    vi.mocked(useClients).mockReturnValue({ updateClient, clients: [makeClientWithAccesses()] } as never);

    renderPage();
    await screen.findByText("Ficha técnica");
    await openBriefingAndSave("por cliente");

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
  });

  it("autosave = \"false\": fonte nuvem mas SEM gravação por seção; o botão 'Salvar versão atual' envia a cópia sem accesses/password", async () => {
    localStorage.setItem(TECHNICAL_SHEETS_AUTOSAVE_KEY, "false");
    vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mockResolvedValue({ id: "sheet-1" } as never);

    renderPage();
    await screen.findByText("Ficha técnica");
    await openBriefingAndSave("sem autosave");
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();

    // o botão manual (AlertDialog de 2 passos)
    fireEvent.click(await screen.findByText(/Salvar versão atual no Supabase/i));
    fireEvent.click(await screen.findByRole("button", { name: "Salvar no Supabase" }));

    await waitFor(() => expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).toHaveBeenCalledTimes(1));
    const [, , payload] = vi.mocked(clientTechnicalSheetsRepository.upsertTechnicalSheet).mock.calls[0];
    expect(JSON.stringify(payload)).not.toContain(SENHA);
    expect(payload as object).not.toHaveProperty("accesses");
  });
});

describe("ClientTechnicalSheet · F4 — usuário 100% local não é afetado pelo flip (nuvem inalcançável)", () => {
  it("sem vínculo com o Supabase: a fonte efetiva é LOCAL, salvar grava local (updateClient) e não dá erro de 'Vínculo ausente'", async () => {
    vi.mocked(useSupabaseTechnicalSheet).mockReturnValue({
      supabaseClientId: null, sheet: null, loading: false, error: null, refresh: vi.fn(),
    } as never);
    const updateClient = vi.fn();
    vi.mocked(useClients).mockReturnValue({ updateClient, clients: [makeClientWithAccesses()] } as never);

    renderPage();
    await screen.findByText("Ficha técnica");
    await openBriefingAndSave("100% local");

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
    expect(vi.mocked(toast.error)).not.toHaveBeenCalled();
  });

  it("sem workspace: idem — grava local", async () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null, membership: null, loading: false, error: null } as never);
    const updateClient = vi.fn();
    vi.mocked(useClients).mockReturnValue({ updateClient, clients: [makeClientWithAccesses()] } as never);

    renderPage();
    await screen.findByText("Ficha técnica");
    await openBriefingAndSave("sem workspace");

    await waitFor(() => expect(updateClient).toHaveBeenCalledTimes(1));
    expect(clientTechnicalSheetsRepository.upsertTechnicalSheet).not.toHaveBeenCalled();
  });
});

// Rodada 2b-fichas (etapa-5-flip-clientes-pacote.md §2.3, consumidor 3/3) —
// a página buscava o cliente via useClients() (sempre local), então um
// cliente só-nuvem (Clientes.tsx já Supabase-first desde a Fatia 4) nunca
// era encontrado aqui, mesmo tendo ficha técnica própria. Fix: a busca usa
// useClientsDataSource() (bifurcado) — updateClient (escrita, gateada por
// activeDataSource==="local" dentro de persist()) continua vindo de
// useClients(), intocado.
describe("ClientTechnicalSheet · G6x (rodada 2b-fichas) — busca de cliente usa useClientsDataSource(), não useClients() local", () => {
  it("cliente presente SÓ em useClientsDataSource() (ausente de useClients()) é encontrado e a página renderiza normalmente", async () => {
    vi.mocked(useClients).mockReturnValue({ updateClient: vi.fn() } as never);
    vi.mocked(useClientsDataSource).mockReturnValue({
      clients: [makeClientWithAccesses()],
    } as never);

    renderPage();

    expect(await screen.findByText("Ficha técnica")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    expect(screen.queryByText("Cliente não encontrado.")).not.toBeInTheDocument();
  });

  it("cliente ausente de useClientsDataSource(): 'Cliente não encontrado.' — não quebra (regressão)", async () => {
    vi.mocked(useClients).mockReturnValue({ updateClient: vi.fn() } as never);
    vi.mocked(useClientsDataSource).mockReturnValue({ clients: [] } as never);

    renderPage();

    expect(await screen.findByText("Cliente não encontrado.")).toBeInTheDocument();
  });
});
