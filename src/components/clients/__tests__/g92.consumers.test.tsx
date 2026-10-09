// G92 — consumidores de oportunidades FORA do CRM (timeline do cliente e aba
// Comercial do drawer) com a fonte do CRM em modo Supabase, hooks REAIS
// (useBifurcatedOpportunities + mapper real), fixture com uuid real. Antes:
// liam useLeads() (localStorage) e não viam nenhuma oportunidade da nuvem.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import { ClientActivitiesTab } from "@/components/clients/ClientActivitiesTab";
import { ClientProfileDrawer } from "@/components/clients/ClientProfileDrawer";
import { useLeads } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import { useClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { mapSupabaseOpportunityToLocalLead } from "@/services/crm/crmOpportunityMapper";
import type { Client } from "@/types/domain";

vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useSupabaseOpportunities", () => ({ useSupabaseOpportunities: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useBifurcatedProjects", () => ({ useBifurcatedProjects: vi.fn() }));
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
vi.mock("@/hooks/useBifurcatedTechnicalSheet", () => ({ useBifurcatedTechnicalSheet: vi.fn() }));
vi.mock("@/hooks/useClientActivityLogs", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useClientActivityLogs")>("@/hooks/useClientActivityLogs");
  return { ...actual, useClientActivityLogs: vi.fn() };
});

const CLIENT_UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const OPP_UUID = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";

function cloudClient(): Client {
  return {
    id: CLIENT_UUID as unknown as number, name: "Cliente Nuvem", company: "", email: "", phone: "", whatsapp: "",
    instagram: "", site: "", serviceType: "", status: "Ativo", potentialValue: 0, lastProject: "—",
    lastInteraction: "—", observations: "", projects: [], tasks: [], createdAt: "2026-01-01T00:00:00.000Z",
  } as Client;
}

const cloudOpp = {
  id: OPP_UUID, workspace_id: "ws1", client_id: CLIENT_UUID, title: "HOMOLOG-OPP-nuvem", company: "Empresa",
  stage: "lead", status: "open", is_demo: false, archived: false, potential_value: 1000,
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
} as never;

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname + loc.search}</div>;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  // lead LOCAL de outro cliente — nunca deve aparecer em modo nuvem
  vi.mocked(useLeads).mockReturnValue({ leads: [{ id: 7, name: "Lead Local Fantasma", company: "", clientId: CLIENT_UUID, stage: "lead" }] } as never);
  vi.mocked(useSupabaseOpportunities).mockReturnValue({ opportunities: [cloudOpp] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
  vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
  vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
  vi.mocked(useBifurcatedProjects).mockReturnValue([] as never);
  vi.mocked(useBifurcatedTasks).mockReturnValue([] as never);
  vi.mocked(useBifurcatedTechnicalSheet).mockReturnValue({} as never);
  vi.mocked(useClientActivityLogs).mockReturnValue({ logs: [], addLog: vi.fn(), updateLog: vi.fn(), deleteLog: vi.fn() } as never);
});

describe("Histórico de Relacionamento · oportunidades da nuvem (G92)", () => {
  it("a oportunidade da nuvem do cliente (client_id uuid) aparece, e 'Ver no CRM' navega com o id que o CRM reconhece (mapper real)", async () => {
    render(
      <MemoryRouter>
        <ClientActivitiesTab client={cloudClient()} onClose={() => {}} />
        <LocationProbe />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Oportunidade criada")).toBeInTheDocument();
    expect(screen.queryByText("Lead Local Fantasma")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Ver no CRM"));
    const expectedId = mapSupabaseOpportunityToLocalLead(cloudOpp).id;
    await waitFor(() => expect(screen.getByTestId("loc").textContent).toBe(`/crm?lead=${expectedId}`));
  });
});

describe("Drawer do cliente · aba Comercial · oportunidades da nuvem (G92)", () => {
  it("lista a oportunidade da nuvem do cliente (e não o lead local)", async () => {
    render(
      <MemoryRouter>
        <ClientProfileDrawer client={cloudClient()} onClose={vi.fn()} onEdit={vi.fn()} onWhats={vi.fn()} initialTab="commercial" />
      </MemoryRouter>,
    );

    expect(await screen.findByText("HOMOLOG-OPP-nuvem")).toBeInTheDocument();
    expect(screen.queryByText("Lead Local Fantasma")).not.toBeInTheDocument();
  });
});
