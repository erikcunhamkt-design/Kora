// G92 — a Central do Dia lia leads de `useLeads()` (localStorage) enquanto o CRM
// em modo Supabase lista as oportunidades da nuvem: o evento "Ver oportunidade"
// de um lead da nuvem nunca existia, e um lead local gerava `/crm?lead=<id>`
// que a lista da nuvem não reconhecia. Aqui: hooks REAIS (useDayCenterData →
// useBifurcatedOpportunities → mapper real); só as demais fontes são mockadas.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import { useDayCenterData } from "@/hooks/useDayCenterData";
import { useLeads } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
import { useClients } from "@/hooks/useClients";
import { useAllClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { CRM_DATA_SOURCE_KEY } from "@/config/flags";
import { mapSupabaseOpportunityToLocalLead } from "@/services/crm/crmOpportunityMapper";

vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useSupabaseOpportunities", () => ({ useSupabaseOpportunities: vi.fn() }));
vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useBifurcatedTasks", () => ({ useBifurcatedTasks: vi.fn() }));
vi.mock("@/hooks/useQuotes", () => ({ useQuotes: vi.fn() }));
vi.mock("@/hooks/useBifurcatedProjects", () => ({ useBifurcatedProjects: vi.fn() }));
vi.mock("@/hooks/useBifurcatedFinance", () => ({ useBifurcatedFinance: vi.fn() }));
vi.mock("@/hooks/useClients", () => ({ useClients: vi.fn() }));
vi.mock("@/hooks/useClientActivityLogs", () => ({ useAllClientActivityLogs: vi.fn() }));

const OPP_UUID = "5d3f1f0a-6c2b-4c1e-9a77-0b7a2f4d8e11";
// G72: data relativa a "hoje", nunca fixa.
const today = new Date().toISOString().slice(0, 10);

const cloudOpp = {
  id: OPP_UUID, workspace_id: "ws1", client_id: null, title: "HOMOLOG-OPP-nuvem",
  company: "Empresa Nuvem", stage: "lead", status: "open", is_demo: false, archived: false,
  next_action: "Ligar para o cliente", next_action_date: today,
  created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-01T00:00:00Z",
} as never;

const localLead = {
  id: 7, name: "Lead Local", company: "Empresa Local", email: "", phone: "", serviceType: "Geral",
  estimatedValue: 0, priority: "média", lastInteraction: "", stage: "lead", archived: false,
  nextAction: "Retornar", nextActionDate: today, description: "", history: [], notes: "", tags: [],
} as never;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useBifurcatedTasks).mockReturnValue([] as never);
  vi.mocked(useQuotes).mockReturnValue({ quotes: [] } as never);
  vi.mocked(useBifurcatedProjects).mockReturnValue([] as never);
  vi.mocked(useBifurcatedFinance).mockReturnValue([] as never);
  vi.mocked(useClients).mockReturnValue({ clients: [] } as never);
  vi.mocked(useAllClientActivityLogs).mockReturnValue([] as never);
  vi.mocked(useLeads).mockReturnValue({ leads: [localLead] } as never);
  vi.mocked(useSupabaseOpportunities).mockReturnValue({ opportunities: [cloudOpp] } as never);
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" } } as never);
});

describe("useDayCenterData · oportunidades pela fonte do CRM (G92)", () => {
  it("modo nuvem (default pós-flip): a oportunidade da nuvem vira evento da Central do Dia e o link ?lead= abre ELA na lista do CRM", () => {
    const { result } = renderHook(() => useDayCenterData());

    const leadItems = result.current.items.filter((i) => i.relatedType === "lead");
    expect(leadItems).toHaveLength(1);
    const item = leadItems[0];
    expect(item.description).toContain("HOMOLOG-OPP-nuvem");

    // O lado do CRM: a lista que a tela mostra em modo Supabase (mapper real) e a
    // comparação por string do deep link (G87) — o link tem que achar ESTE lead.
    const crmList = [mapSupabaseOpportunityToLocalLead(cloudOpp)];
    const param = new URL(item.route!, "http://x").searchParams.get("lead")!;
    expect(crmList.find((l) => String(l.id) === param)?.name).toBe("HOMOLOG-OPP-nuvem");
  });

  it("modo nuvem: o lead LOCAL deixa de gerar evento (antes: link que a lista da nuvem não reconhecia)", () => {
    const { result } = renderHook(() => useDayCenterData());

    expect(result.current.items.some((i) => i.relatedType === "lead" && i.relatedId === 7)).toBe(false);
  });

  it("regressão — fonte local explícita: o lead local gera o evento com o id local, como sempre", () => {
    localStorage.setItem(CRM_DATA_SOURCE_KEY, "local");

    const { result } = renderHook(() => useDayCenterData());

    const item = result.current.items.find((i) => i.relatedType === "lead");
    expect(item?.route).toBe("/crm?lead=7");
  });

  it("regressão — sem workspace: leads locais", () => {
    vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: null } as never);

    const { result } = renderHook(() => useDayCenterData());

    expect(result.current.items.find((i) => i.relatedType === "lead")?.route).toBe("/crm?lead=7");
  });
});
