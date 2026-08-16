// Etapa 5 · G57 (Design C, revisor aprovado) — idempotência real do reimport
// de oportunidades. O mapper (`crmOpportunityMapper.ts`) recalcula won_at/
// lost_at do zero a cada chamada (`new Date().toISOString()` sempre que o
// stage bate) — reimportar o MESMO lead sem o stage ter mudado gerava um
// timestamp novo a cada vez (achado do revisor na revisão do G57,
// `kora-hub-auditoria-e-plano.md`). Fix: `useLocalOpportunitiesImport.ts`
// acha a linha existente por `source_local_id` na lista JÁ EM MEMÓRIA
// (`supabaseOpportunities`, sem SELECT novo) e, se o stage não mudou desde a
// última importação, reusa won_at/lost_at já gravados em vez de deixar o
// mapper recalcular.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useLocalOpportunitiesImport } from "@/hooks/useLocalOpportunitiesImport";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { crmOpportunitiesRepository, type SupabaseOpportunity } from "@/repositories/crmOpportunitiesRepository";
import { getInstallId, buildSourceLocalId } from "@/lib/installId";

vi.mock("@/hooks/useCurrentWorkspace", () => ({ useCurrentWorkspace: vi.fn() }));
vi.mock("@/hooks/useLeads", () => ({ useLeads: vi.fn() }));
vi.mock("@/hooks/useSupabaseOpportunities", () => ({ useSupabaseOpportunities: vi.fn() }));
vi.mock("@/repositories/crmOpportunitiesRepository", () => ({
  crmOpportunitiesRepository: { upsertImportedOpportunity: vi.fn() },
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 1, name: "Lead Fechado", company: "Acme", email: "lead@acme.com", phone: "11999999999",
    serviceType: "Branding", estimatedValue: 5000, priority: "média", lastInteraction: "2026-08-01",
    stage: "fechado", description: "", history: [], notes: "",
    ...overrides,
  };
}

function makeCloudOpportunity(overrides: Partial<SupabaseOpportunity> = {}): SupabaseOpportunity {
  return {
    id: "cloud-opp-1", workspace_id: "ws1", client_id: null, title: "Lead Fechado", company: "Acme",
    contact_name: "Lead Fechado", email: "lead@acme.com", phone: "11999999999", whatsapp: "11999999999",
    stage: "fechado", status: "won", source: null, temperature: null, priority: "média",
    potential_value: 5000, probability: 100, next_action: null, next_action_date: null,
    expected_close_date: null, notes: null, quote_id: null, quote_title: null, converted_client_id: null,
    won_at: null, lost_at: null, lost_reason: null, is_demo: false, archived: false,
    source_local_id: null, tags: null, history: [],
    created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(useCurrentWorkspace).mockReturnValue({ workspace: { id: "ws1" }, membership: null, loading: false, error: null } as never);
  vi.mocked(crmOpportunitiesRepository.upsertImportedOpportunity).mockResolvedValue(makeCloudOpportunity() as never);
});

afterEach(() => {
  vi.useRealTimers();
});

async function importLead(lead: Lead, cloudOpportunities: SupabaseOpportunity[]) {
  vi.mocked(useLeads).mockReturnValue({ leads: [lead], addLead: vi.fn() } as never);
  vi.mocked(useSupabaseOpportunities).mockReturnValue({
    opportunities: cloudOpportunities, refresh: vi.fn().mockResolvedValue(undefined),
  } as never);

  const { result } = renderHook(() => useLocalOpportunitiesImport());
  await act(async () => { await result.current.importSelected([lead.id]); });

  return vi.mocked(crmOpportunitiesRepository.upsertImportedOpportunity).mock.calls[0]?.[1];
}

describe("useLocalOpportunitiesImport · G57 Design C — idempotência de won_at/lost_at no reimport", () => {
  // Nota (§3.3.2 do achado original, "exposição real, não hipotética"): o
  // cenário só chega em `importSelected` de verdade quando o lead local NÃO
  // bate mais por email/telefone/título contra a linha já existente na
  // nuvem (senão `matchStatus` vira "duplicate", que o A2 do próprio hook já
  // recusa reimportar) — o `existing` de cada teste usa contato/título
  // deliberadamente DIFERENTES do `lead`, com o MESMO `source_local_id`
  // (é essa combinação que reproduz a janela real, não um cenário
  // artificial).
  it("a) reimport do mesmo lead FECHADO, stage igual → won_at preservado (não recalculado)", async () => {
    const installId = getInstallId();
    const sourceLocalId = buildSourceLocalId(installId, 1);
    const staleWonAt = "2026-08-01T10:00:00.000Z";
    const lead = makeLead({ id: 1, stage: "fechado" });
    const existing = makeCloudOpportunity({
      source_local_id: sourceLocalId, stage: "fechado", won_at: staleWonAt,
      email: "outro@dominio.com", phone: "11000000000", whatsapp: "11000000000", title: "Título Diferente", company: "Outra Empresa",
    });

    const input = await importLead(lead, [existing]);

    expect(input.won_at).toBe(staleWonAt);
    expect(input.lost_at).toBeNull();
  });

  it("b) reimport do mesmo lead PERDIDO, stage igual → lost_at preservado (não recalculado)", async () => {
    const installId = getInstallId();
    const sourceLocalId = buildSourceLocalId(installId, 1);
    const staleLostAt = "2026-08-01T10:00:00.000Z";
    const lead = makeLead({ id: 1, stage: "perdido" });
    const existing = makeCloudOpportunity({
      source_local_id: sourceLocalId, stage: "perdido", lost_at: staleLostAt, won_at: null,
      email: "outro@dominio.com", phone: "11000000000", whatsapp: "11000000000", title: "Título Diferente", company: "Outra Empresa",
    });

    const input = await importLead(lead, [existing]);

    expect(input.lost_at).toBe(staleLostAt);
    expect(input.won_at).toBeNull();
  });

  it("c) stage mudou desde a última importação (fechado→perdido) → timestamps RECALCULADOS, guarda não se aplica", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00.000Z"));
    const installId = getInstallId();
    const sourceLocalId = buildSourceLocalId(installId, 1);
    const staleWonAt = "2026-08-01T10:00:00.000Z";
    // Lead local já mudou de estágio (agora "perdido"); a linha na nuvem
    // ainda reflete o estágio ANTERIOR ("fechado") — cenário real de reimport
    // depois de uma mudança de stage que não passou pelo caminho primário.
    const lead = makeLead({ id: 1, stage: "perdido" });
    const existing = makeCloudOpportunity({
      source_local_id: sourceLocalId, stage: "fechado", won_at: staleWonAt,
      email: "outro@dominio.com", phone: "11000000000", whatsapp: "11000000000", title: "Título Diferente", company: "Outra Empresa",
    });

    const input = await importLead(lead, [existing]);

    // Guarda não se aplica (stage != existing.stage) — mapper recalcula
    // normalmente: lost_at novo (agora), won_at limpo (stage != "fechado").
    expect(input.won_at).toBeNull();
    expect(input.lost_at).toBe("2026-08-16T12:00:00.000Z");
    expect(input.lost_at).not.toBe(staleWonAt);
  });

  it("d) linha não encontrada em memória (metadata perdida / lista vazia) → comportamento atual preservado, sem quebrar", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-16T12:00:00.000Z"));
    const lead = makeLead({ id: 1, stage: "fechado" });

    const input = await importLead(lead, []); // supabaseOpportunities vazio — nenhuma linha existente em memória

    // Sem `existing`, o fluxo cai no comportamento de sempre: mapper calcula
    // um won_at novo (não há nada com o que preservar) — não quebra, não
    // lança, segue o import normalmente.
    expect(input.won_at).toBe("2026-08-16T12:00:00.000Z");
    expect(input.lost_at).toBeNull();
    expect(crmOpportunitiesRepository.upsertImportedOpportunity).toHaveBeenCalledTimes(1);
  });
});
