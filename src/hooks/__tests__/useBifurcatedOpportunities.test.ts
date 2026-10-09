// G92 — leitura bifurcada de oportunidades/leads pros consumidores FORA do
// CRM: mesma fonte do CRM (`workspace ? getCrmDataSource() : "local"`), com o
// MAPPER REAL (id = hash numérico estável do uuid — o id que o CRM usa em
// modo Supabase e que `?lead=` precisa carregar). Fixture com uuid real.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useBifurcatedOpportunities } from "@/hooks/useBifurcatedOpportunities";
import { useLeads } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { CRM_DATA_SOURCE_KEY } from "@/config/flags";
import { mapSupabaseOpportunityToLocalLead } from "@/services/crm/crmOpportunityMapper";

vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useSupabaseOpportunities", () => ({ useSupabaseOpportunities: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));

const OPP_UUID = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";
const CLIENT_UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

const cloudOpp = {
  id: OPP_UUID, workspace_id: "ws1", client_id: CLIENT_UUID, title: "Oportunidade da Nuvem",
  company: "Empresa Nuvem", stage: "lead", status: "open", is_demo: false, archived: false,
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
} as never;

const localLead = {
  id: 7, name: "Lead Local", company: "Empresa Local", email: "", phone: "", serviceType: "Geral",
  estimatedValue: 0, priority: "média", lastInteraction: "", stage: "lead", archived: false,
  description: "", history: [], notes: "", tags: [],
} as never;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useLeads).mockReturnValue({ leads: [localLead] } as never);
  vi.mocked(useSupabaseOpportunities).mockReturnValue({ opportunities: [cloudOpp] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
});

describe("useBifurcatedOpportunities (G92)", () => {
  it("workspace + fonte do CRM no default (pós-flip = supabase): devolve as oportunidades da NUVEM mapeadas — com o MESMO id que o CRM usa", () => {
    const { result } = renderHook(() => useBifurcatedOpportunities());

    expect(result.current).toHaveLength(1);
    const expected = mapSupabaseOpportunityToLocalLead(cloudOpp);
    expect(result.current[0].id).toBe(expected.id);
    expect(result.current[0].name).toBe("Oportunidade da Nuvem");
    // FK preservada como uuid (G67-ext): o consumidor casa por `clientId === client.id`
    expect(result.current[0].clientId).toBe(CLIENT_UUID);
    // o lead local NÃO aparece misturado
    expect(result.current.map((l) => l.name)).not.toContain("Lead Local");
  });

  it("busca com includeArchived: true — mesma chave de cache do CRM (sem fetch duplicado)", () => {
    renderHook(() => useBifurcatedOpportunities());
    expect(useSupabaseOpportunities).toHaveBeenCalledWith({ includeArchived: true });
  });

  it("fonte do CRM em 'local' explícito: devolve os leads locais (modo local intocado)", () => {
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");

    const { result } = renderHook(() => useBifurcatedOpportunities());

    expect(result.current).toEqual([localLead]);
  });

  it("sem workspace: devolve os leads locais, mesmo com a fonte em supabase (igual ao CRM)", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);

    const { result } = renderHook(() => useBifurcatedOpportunities());

    expect(result.current).toEqual([localLead]);
  });

  it("nuvem vazia ⇒ lista vazia (não cai nos leads locais — mesmo comportamento do CRM)", () => {
    vi.mocked(useSupabaseOpportunities).mockReturnValue({ opportunities: [] } as never);

    const { result } = renderHook(() => useBifurcatedOpportunities());

    expect(result.current).toEqual([]);
  });
});
