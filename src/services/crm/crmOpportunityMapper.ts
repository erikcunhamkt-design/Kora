import type { Lead, StageKey, Priority, LeadTemperature } from "@/hooks/useLeads";
import type { SupabaseOpportunity, SupabaseOpportunityInput } from "@/repositories/crmOpportunitiesRepository";

function stableNumericIdFromUuid(uuid: string): number {
  const clean = uuid.replace(/-/g, "");
  const slice = clean.slice(0, 12) || "0";
  const parsed = Number.parseInt(slice, 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function mapLocalLeadToSupabaseOpportunity(lead: Lead): SupabaseOpportunityInput {
  return {
    client_id: lead.clientId ? String(lead.clientId) : null,
    title: lead.name, // O campo 'name' do Lead local serve como o title da Opportunity
    company: lead.company || null,
    contact_name: lead.name || null,
    email: lead.email || null,
    phone: lead.phone || null,
    whatsapp: lead.phone || null, // No lead local, phone costuma guardar o whatsapp/contato principal
    stage: lead.stage || "lead",
    status: lead.stage === "fechado" ? "won" : lead.stage === "perdido" ? "lost" : "open",
    source: lead.source || lead.origin || null,
    temperature: lead.temperature || null,
    priority: lead.priority || "média",
    potential_value: lead.estimatedValue || 0,
    probability: lead.stage === "fechado" ? 100 : lead.stage === "perdido" ? 0 : null,
    next_action: lead.nextAction || null,
    next_action_date: lead.nextActionDate || null,
    expected_close_date: lead.expectedCloseDate || null,
    notes: lead.notes || lead.description || null,
    quote_id: lead.quoteId || null,
    quote_title: lead.quoteTitle || null,
    converted_client_id: lead.convertedClientId ? String(lead.convertedClientId) : null,
    won_at: lead.wonAt || (lead.stage === "fechado" ? new Date().toISOString() : null),
    lost_at: lead.stage === "perdido" ? new Date().toISOString() : null,
    lost_reason: lead.lostReason || null,
    is_demo: lead.isDemo || false,
    archived: lead.archived || false,
  };
}

export function mapSupabaseOpportunityToLocalLead(opportunity: SupabaseOpportunity): Lead {
  const stage = (opportunity.stage as StageKey) || "lead";

  return {
    id: stableNumericIdFromUuid(opportunity.id),
    name: opportunity.title || opportunity.contact_name || "Oportunidade Sem Nome",
    company: opportunity.company || "",
    email: opportunity.email || "",
    phone: opportunity.whatsapp || opportunity.phone || "",
    serviceType: "Geral", // Campo legado exigido pelo Lead, default geral
    origin: opportunity.source || "",
    source: opportunity.source || "",
    estimatedValue: Number(opportunity.potential_value || 0),
    priority: (opportunity.priority as Priority) || "média",
    lastInteraction: opportunity.updated_at ? new Date(opportunity.updated_at).toLocaleDateString() : new Date().toLocaleDateString(),
    stage,
    pipelineId: "default",
    stageId: stage,
    archived: opportunity.archived || false,
    converted: opportunity.stage === "fechado",
    nextAction: opportunity.next_action || "",
    description: opportunity.notes || "",
    notes: opportunity.notes || "",
    history: [],
    isDemo: opportunity.is_demo || false,
    clientId: opportunity.client_id ? Number(opportunity.client_id) || undefined : undefined,
    temperature: (opportunity.temperature as LeadTemperature) || undefined,
    nextActionDate: opportunity.next_action_date || undefined,
    expectedCloseDate: opportunity.expected_close_date || undefined,
    wonAt: opportunity.won_at || undefined,
    lostReason: opportunity.lost_reason || undefined,
    convertedClientId: opportunity.converted_client_id ? Number(opportunity.converted_client_id) || undefined : undefined,
    createdAt: opportunity.created_at || undefined,
    updatedAt: opportunity.updated_at || undefined,
    quoteId: opportunity.quote_id || undefined,
    quoteTitle: opportunity.quote_title || undefined,
    supabaseId: opportunity.id || undefined,
  };
}
