// Etapa 5 · Fatia 8 (opportunities — cutover de escrita) — correção de O2/O3/O4.
// Prova, por bug, que: (1) modo Supabase + flag ligada grava na nuvem (nunca
// no local); (2) modo Local preserva o comportamento de sempre, inalterado;
// (3) modo Supabase + flag desligada NUNCA dispara toast de sucesso sem
// escrita real em lugar nenhum — nem local, nem nuvem.
//
// Antes desta correção: o ícone de excluir (O2) chamava deleteLead() local
// incondicionalmente (sem gate nenhum); handleUnarchiveClick (O3) chamava
// archiveLead() local mesmo com a flag ligada; EditTagsDialog.onSave (O4)
// chamava setLeadTags() local incondicionalmente. Os três eram no-ops
// silenciosos contra um lead de origem Supabase (id = hash, nunca bate com
// nada em orbyt.leads.v1), com toast de sucesso mesmo assim.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";

import CRM from "@/pages/CRM";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { usePipelines } from "@/hooks/usePipelines";
import { usePipelineAutomations } from "@/hooks/usePipelineAutomations";
import { useClients } from "@/hooks/useClients";
import { useClientsDataSource } from "@/hooks/useClientsDataSource";
import { useClientTypes } from "@/hooks/useClientTypes";
import { usePlan } from "@/contexts/plan-context-value";
import { useTranslation } from "@/contexts/language-context-value";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseCrmWriteFlag } from "@/hooks/useSupabaseCrmWriteFlag";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { crmOpportunitiesRepository, type SupabaseOpportunity } from "@/repositories/crmOpportunitiesRepository";
import { CRM_DATA_SOURCE_KEY } from "@/config/flags";

vi.mock("@/hooks/useLeads", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useLeads")>("@/hooks/useLeads");
  return { ...actual, useLeads: vi.fn() };
});
vi.mock("@/hooks/usePipelines", () => ({ usePipelines: vi.fn(), DEFAULT_PIPELINE_ID: "default" }));
vi.mock("@/hooks/usePipelineAutomations", () => ({ usePipelineAutomations: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientsDataSource", () => ({ useClientsDataSource: vi.fn() }));
vi.mock("@/hooks/useClientTypes", () => ({ useClientTypes: vi.fn() }));
vi.mock("@/contexts/plan-context-value", () => ({ usePlan: vi.fn() }));
vi.mock("@/contexts/language-context-value", () => ({ useTranslation: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useSupabaseCrmWriteFlag", () => ({ useSupabaseCrmWriteFlag: vi.fn() }));
vi.mock("@/hooks/useSupabaseOpportunities", () => ({ useSupabaseOpportunities: vi.fn() }));
vi.mock("@/repositories/crmOpportunitiesRepository", () => ({
  crmOpportunitiesRepository: {
    archiveOpportunity: vi.fn(),
    softDeleteOpportunity: vi.fn(),
    updateOpportunity: vi.fn(),
    deleteOpportunity: vi.fn(),
    createOpportunity: vi.fn(),
    restoreSoftDeletedOpportunity: vi.fn(),
    listOpportunities: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

// Radix DropdownMenu (v2) abre no `pointerdown`, não no `click` — e este jsdom
// não implementa `PointerEvent` (typeof window.PointerEvent === "undefined"),
// então fireEvent.pointerDown cairia num MouseEvent genérico sem os campos que
// o handler do Radix lê. Polyfill mínimo, só para os testes.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    public pointerId: number;
    public pointerType: string;
    public isPrimary: boolean;
    constructor(type: string, params: MouseEventInit & { pointerId?: number; pointerType?: string; isPrimary?: boolean } = {}) {
      super(type, params);
      this.pointerId = params.pointerId ?? 1;
      this.pointerType = params.pointerType ?? "mouse";
      this.isPrimary = params.isPrimary ?? true;
    }
  }
  // @ts-expect-error — polyfill de teste, jsdom não implementa PointerEvent.
  window.PointerEvent = PointerEventPolyfill;
}

// Radix DropdownMenu depende de duas APIs ausentes no jsdom padrão.
beforeEach(() => {
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false);
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {});
});

const PIPELINE = {
  id: "default",
  name: "Pipeline Principal",
  isDefault: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  stages: [
    { id: "lead", name: "Lead", color: "#888", order: 0, type: "open" as const },
    { id: "fechado", name: "Fechado", color: "#0a0", order: 1, type: "won" as const },
  ],
};

function makeLocalLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 42,
    name: "Lead Local",
    company: "Empresa Local",
    email: "local@teste.com",
    phone: "11988887777",
    serviceType: "Geral",
    estimatedValue: 500,
    priority: "média",
    lastInteraction: "2026-07-01",
    stage: "lead",
    pipelineId: "default",
    stageId: "lead",
    archived: false,
    description: "",
    history: [],
    notes: "",
    tags: [],
    ...overrides,
  };
}

function makeSupabaseOpportunity(overrides: Partial<SupabaseOpportunity> = {}): SupabaseOpportunity {
  return {
    id: "opp-uuid-homolog",
    workspace_id: "ws1",
    client_id: null,
    title: "Lead Nuvem",
    company: null,
    contact_name: null,
    email: null,
    phone: null,
    whatsapp: null,
    stage: "lead",
    status: "open",
    source: null,
    temperature: null,
    priority: null,
    potential_value: 800,
    probability: null,
    next_action: null,
    next_action_date: null,
    expected_close_date: null,
    notes: null,
    quote_id: null,
    quote_title: null,
    converted_client_id: null,
    won_at: null,
    lost_at: null,
    lost_reason: null,
    is_demo: false,
    archived: false,
    source_local_id: null,
    tags: null,
    history: null,
    created_at: "2026-07-01T00:00:00Z",
    updated_at: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

function setupCommonMocks() {
  vi.mocked(usePipelines).mockReturnValue({
    pipelines: [PIPELINE],
    activePipeline: PIPELINE,
    activePipelineId: "default",
    setActivePipelineId: vi.fn(),
    addPipeline: vi.fn(),
    updatePipeline: vi.fn(),
    deletePipeline: vi.fn(),
  } as never);
  vi.mocked(usePipelineAutomations).mockReturnValue({
    rules: [], addRule: vi.fn(), updateRule: vi.fn(), deleteRule: vi.fn(),
    getRulesForPipeline: () => [],
  } as never);
  vi.mocked(useClients).mockReturnValue({ addClient: vi.fn(), clients: [] } as never);
  vi.mocked(useClientsDataSource).mockReturnValue({ source: "local", addClient: vi.fn(), clients: [] } as never);
  vi.mocked(useClientTypes).mockReturnValue({ activeTypes: [] } as never);
  vi.mocked(usePlan).mockReturnValue({
    isPro: true, // bypassa UsageBadge (early return), sem precisar mockar usage/limits em detalhe
    plan: "pro", limits: {}, usage: { clients: 0, projects: 0, tasks: 0, leads: 0 },
    wouldExceed: () => false, showPaywall: vi.fn(), setUsage: vi.fn(),
    paywallOpen: false, paywallResource: null, closePaywall: vi.fn(),
  } as never);
  vi.mocked(useTranslation).mockReturnValue({ t: (k: string) => k } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
}

/** Abre o menu de ações (⋮) do card do lead pelo nome e devolve o container do menu. */
async function openLeadMenu(leadName: string) {
  const nameEl = await screen.findByText(leadName);
  const card = nameEl.closest(".orbit-card") as HTMLElement;
  const trigger = card.querySelector('button[aria-haspopup="menu"]') as HTMLElement;
  fireEvent.pointerDown(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.pointerUp(trigger, { button: 0, pointerId: 1, isPrimary: true });
  fireEvent.click(trigger);
  return screen.findByText("Excluir lead");
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  setupCommonMocks();
});

function renderCRM() {
  return render(
    <MemoryRouter>
      <CRM />
    </MemoryRouter>,
  );
}

describe("CRM · O2 (excluir) — lixeira sempre gateada, nunca no-op com toast de sucesso", () => {
  it("modo Supabase + flag ON: chama softDeleteOpportunity (nuvem), nunca deleteLead (local)", async () => {
    const localDeleteLead = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: localDeleteLead, setLeadTags: vi.fn(), markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [makeSupabaseOpportunity()], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(crmOpportunitiesRepository.softDeleteOpportunity).mockResolvedValue({} as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");

    renderCRM();
    await openLeadMenu("Lead Nuvem");
    fireEvent.click(screen.getByText("Excluir lead"));

    // Abre o AlertDialog de soft-delete (modo Supabase) — precisa marcar o
    // checkbox de ciência antes do botão de confirmar destravar.
    const ack = await screen.findByLabelText(/entendo que esta oportunidade/i);
    fireEvent.click(ack);
    fireEvent.click(screen.getByRole("button", { name: "Excluir oportunidade" }));

    await waitFor(() => expect(crmOpportunitiesRepository.softDeleteOpportunity).toHaveBeenCalledTimes(1));
    expect(crmOpportunitiesRepository.softDeleteOpportunity).toHaveBeenCalledWith("ws1", "opp-uuid-homolog", undefined);
    expect(localDeleteLead).not.toHaveBeenCalled();
  });

  it("modo Local: preserva o comportamento de sempre — deleteLead local, nunca o repository", async () => {
    const localDeleteLead = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [makeLocalLead()], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: localDeleteLead, setLeadTags: vi.fn(), markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderCRM();
    await openLeadMenu("Lead Local");
    fireEvent.click(screen.getByText("Excluir lead"));

    expect(localDeleteLead).toHaveBeenCalledWith(42);
    expect(crmOpportunitiesRepository.softDeleteOpportunity).not.toHaveBeenCalled();
  });

  it("modo Supabase + flag OFF: bloqueia — nenhuma escrita (local ou nuvem) e nenhum toast de sucesso", async () => {
    const localDeleteLead = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: localDeleteLead, setLeadTags: vi.fn(), markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: false, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [makeSupabaseOpportunity()], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");

    renderCRM();
    await openLeadMenu("Lead Nuvem");
    fireEvent.click(screen.getByText("Excluir lead"));

    expect(localDeleteLead).not.toHaveBeenCalled();
    expect(crmOpportunitiesRepository.softDeleteOpportunity).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("CRM · O3 (restaurar) — persistArchiveSupabase sob flag, nunca archiveLead local em modo nuvem", () => {
  async function renderWithArchivedOpportunity() {
    // CRM.tsx mostra um empty-state dedicado quando `leads.filter(!archived)`
    // é 0 — independente do toggle "mostrar arquivados". Por isso o cenário
    // precisa de uma 2ª oportunidade não-arquivada só pra manter o Kanban
    // visível; a interação do teste é sempre com "Lead Nuvem" (arquivada).
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [
        makeSupabaseOpportunity({ archived: true }),
        makeSupabaseOpportunity({ id: "opp-uuid-outra", title: "Outra Oportunidade" }),
      ],
      loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");
    renderCRM();
    // Precisa exibir arquivados para o card aparecer.
    fireEvent.click(screen.getByRole("button", { name: /arquivados/i }));
    return openLeadMenu("Lead Nuvem");
  }

  it("modo Supabase + flag ON: chama archiveOpportunity(..., false) (nuvem), nunca archiveLead local", async () => {
    const localArchiveLead = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: localArchiveLead,
      deleteLead: vi.fn(), setLeadTags: vi.fn(), markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(crmOpportunitiesRepository.archiveOpportunity).mockResolvedValue(makeSupabaseOpportunity({ archived: false }) as never);

    await renderWithArchivedOpportunity();
    fireEvent.click(screen.getByText("Restaurar"));

    await waitFor(() => expect(crmOpportunitiesRepository.archiveOpportunity).toHaveBeenCalledTimes(1));
    expect(crmOpportunitiesRepository.archiveOpportunity).toHaveBeenCalledWith("ws1", "opp-uuid-homolog", false);
    expect(localArchiveLead).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("restaurada"));
  });

  it("modo Local: preserva o comportamento de sempre — archiveLead(id, false) local", async () => {
    const localArchiveLead = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      // 2ª lead não-arquivada só pra não cair no empty-state dedicado
      // ("Seu pipeline ainda está vazio" — ver CRM.tsx:979-986).
      leads: [makeLocalLead({ archived: true }), makeLocalLead({ id: 43, name: "Outra Local" })],
      addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: localArchiveLead,
      deleteLead: vi.fn(), setLeadTags: vi.fn(), markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");

    renderCRM();
    fireEvent.click(screen.getByRole("button", { name: /arquivados/i }));
    await openLeadMenu("Lead Local");
    fireEvent.click(screen.getByText("Restaurar"));

    expect(localArchiveLead).toHaveBeenCalledWith(42, false);
    expect(crmOpportunitiesRepository.archiveOpportunity).not.toHaveBeenCalled();
  });

  it("modo Supabase + flag OFF: bloqueia — nenhuma escrita e nenhum toast de sucesso", async () => {
    const localArchiveLead = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: localArchiveLead,
      deleteLead: vi.fn(), setLeadTags: vi.fn(), markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: false, setEnabled: vi.fn(), toggle: vi.fn() });

    await renderWithArchivedOpportunity();
    fireEvent.click(screen.getByText("Restaurar"));

    expect(localArchiveLead).not.toHaveBeenCalled();
    expect(crmOpportunitiesRepository.archiveOpportunity).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("CRM · O4 (editar tags) — persistTagsSupabase sob flag, nunca setLeadTags local em modo nuvem", () => {
  it("modo Supabase + flag ON: chama updateOpportunity com tags (nuvem), nunca setLeadTags local", async () => {
    const localSetLeadTags = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: vi.fn(), setLeadTags: localSetLeadTags, markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [makeSupabaseOpportunity()], loading: false, error: null, refresh: vi.fn(),
    } as never);
    vi.mocked(crmOpportunitiesRepository.updateOpportunity).mockResolvedValue({} as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");

    renderCRM();
    await openLeadMenu("Lead Nuvem");
    fireEvent.click(screen.getByText("Editar tags"));

    const input = await screen.findByPlaceholderText("Digite e pressione Enter");
    fireEvent.change(input, { target: { value: "vip" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(crmOpportunitiesRepository.updateOpportunity).toHaveBeenCalledTimes(1));
    const [, , patch] = vi.mocked(crmOpportunitiesRepository.updateOpportunity).mock.calls[0];
    expect(patch).toEqual({ tags: ["vip"] });
    expect(localSetLeadTags).not.toHaveBeenCalled();
  });

  it("modo Local: preserva o comportamento de sempre — setLeadTags local", async () => {
    const localSetLeadTags = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [makeLocalLead()], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: vi.fn(), setLeadTags: localSetLeadTags, markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");

    renderCRM();
    await openLeadMenu("Lead Local");
    fireEvent.click(screen.getByText("Editar tags"));

    const input = await screen.findByPlaceholderText("Digite e pressione Enter");
    fireEvent.change(input, { target: { value: "vip" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    await waitFor(() => expect(localSetLeadTags).toHaveBeenCalledWith(42, ["vip"]));
    expect(crmOpportunitiesRepository.updateOpportunity).not.toHaveBeenCalled();
  });

  it("modo Supabase + flag OFF: bloqueia — nenhuma escrita e nenhum toast de sucesso", async () => {
    const localSetLeadTags = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: vi.fn(), setLeadTags: localSetLeadTags, markConverted: vi.fn(),
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: false, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [makeSupabaseOpportunity()], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");

    renderCRM();
    await openLeadMenu("Lead Nuvem");
    fireEvent.click(screen.getByText("Editar tags"));

    const input = await screen.findByPlaceholderText("Digite e pressione Enter");
    fireEvent.change(input, { target: { value: "vip" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: /salvar/i }));

    expect(localSetLeadTags).not.toHaveBeenCalled();
    expect(crmOpportunitiesRepository.updateOpportunity).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });
});

describe("CRM · G58/G59 (converter lead em cliente) — mesmo caminho de escrita de Clientes.tsx, gate fóssil removido", () => {
  it("G59 — modo Supabase + master flag OFF: conversão NÃO é mais bloqueada (antes: blockWriteAction() sem args travava sempre)", async () => {
    const supabaseAddClient = vi.fn().mockResolvedValue({ id: "new-uuid" });
    vi.mocked(useClientsDataSource).mockReturnValue({
      source: "supabase", addClient: supabaseAddClient, clients: [],
    } as never);
    const markConverted = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: vi.fn(), setLeadTags: vi.fn(), markConverted,
    } as never);
    // Master flag OFF — antes, isso não importava pra conversão porque o
    // gate bloqueava incondicionalmente em modo Supabase de qualquer jeito.
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: false, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [makeSupabaseOpportunity()], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");

    renderCRM();
    await openLeadMenu("Lead Nuvem");
    fireEvent.click(screen.getByText("Converter em cliente"));

    await waitFor(() => expect(supabaseAddClient).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith("Cliente criado a partir do lead");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("G58 — modo Supabase: chama addClient de useClientsDataSource (nuvem), nunca o addClient local", async () => {
    const localAddClient = vi.fn();
    const supabaseAddClient = vi.fn().mockResolvedValue({ id: "new-uuid" });
    vi.mocked(useClients).mockReturnValue({ addClient: localAddClient, clients: [] } as never);
    vi.mocked(useClientsDataSource).mockReturnValue({
      source: "supabase", addClient: supabaseAddClient, clients: [],
    } as never);
    const markConverted = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: vi.fn(), setLeadTags: vi.fn(), markConverted,
    } as never);
    vi.mocked(useSupabaseCrmWriteFlag).mockReturnValue({ enabled: true, setEnabled: vi.fn(), toggle: vi.fn() });
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [makeSupabaseOpportunity()], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "supabase");

    renderCRM();
    await openLeadMenu("Lead Nuvem");
    fireEvent.click(screen.getByText("Converter em cliente"));

    await waitFor(() => expect(supabaseAddClient).toHaveBeenCalledTimes(1));
    expect(supabaseAddClient).toHaveBeenCalledWith(expect.objectContaining({ name: "Lead Nuvem" }));
    expect(localAddClient).not.toHaveBeenCalled();
    await waitFor(() => expect(markConverted).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Cliente criado a partir do lead");
  });

  it("modo Local (useClientsDataSource source=local): preserva o comportamento de sempre — addClient local, nunca o de Supabase", async () => {
    const localAddClient = vi.fn();
    const supabaseAddClient = vi.fn();
    vi.mocked(useClients).mockReturnValue({ addClient: localAddClient, clients: [] } as never);
    vi.mocked(useClientsDataSource).mockReturnValue({
      source: "local", addClient: supabaseAddClient, clients: [],
    } as never);
    const markConverted = vi.fn();
    vi.mocked(useLeads).mockReturnValue({
      leads: [makeLocalLead()], addLead: vi.fn(), moveLead: vi.fn(), moveLeadToStage: vi.fn(),
      moveLeadToPipeline: vi.fn(), updateLead: vi.fn(), archiveLead: vi.fn(),
      deleteLead: vi.fn(), setLeadTags: vi.fn(), markConverted,
    } as never);
    vi.mocked(useSupabaseOpportunities).mockReturnValue({
      opportunities: [], loading: false, error: null, refresh: vi.fn(),
    } as never);
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");

    renderCRM();
    await openLeadMenu("Lead Local");
    fireEvent.click(screen.getByText("Converter em cliente"));

    await waitFor(() => expect(localAddClient).toHaveBeenCalledTimes(1));
    expect(localAddClient).toHaveBeenCalledWith(expect.objectContaining({ name: "Lead Local" }));
    expect(supabaseAddClient).not.toHaveBeenCalled();
    expect(markConverted).toHaveBeenCalledWith(42);
  });
});
