import type { Lead, StageKey, Priority, LeadTemperature } from "@/hooks/useLeads";
import type { SupabaseOpportunity, SupabaseOpportunityInput } from "@/repositories/crmOpportunitiesRepository";
import { formatDate as intlDate } from "@/lib/format";

function stableNumericIdFromUuid(uuid: string): number {
  const clean = uuid.replace(/-/g, "");
  const slice = clean.slice(0, 12) || "0";
  const parsed = Number.parseInt(slice, 16);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Import-maps local→Supabase usados para resolver as FKs de uma oportunidade.
 * Chaves = `String(idLocal)`; valores = UUID do Supabase.
 *   - clients: `kora.clients.supabaseImport.v1` (idLocal do cliente → uuid)
 *   - quotes:  `kora.quotes.supabaseImport.v1`  (idLocal do orçamento → uuid)
 */
export interface OpportunityImportMaps {
  clients: Record<string, string>;
  quotes: Record<string, string>;
}

const EMPTY_IMPORT_MAPS: OpportunityImportMaps = { clients: {}, quotes: {} };

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map (A1).
 * Regra de segurança: mapeado → UUID; ausente/não-mapeado → `null`.
 * NUNCA devolve o id local cru — evita `invalid input syntax for type uuid`
 * ao inserir em colunas `uuid` (client_id / quote_id / converted_client_id).
 */
function resolveUuid(localId: string | number | null | undefined, map: Record<string, string>): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  return map[String(localId)] ?? null;
}

export function mapLocalLeadToSupabaseOpportunity(
  lead: Lead,
  maps: OpportunityImportMaps = EMPTY_IMPORT_MAPS,
): SupabaseOpportunityInput {
  return {
    client_id: resolveUuid(lead.clientId, maps.clients),
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
    // A1: FKs remapeadas para UUID (ou null); NUNCA id local cru em coluna uuid.
    quote_id: resolveUuid(lead.quoteId, maps.quotes),
    quote_title: lead.quoteTitle || null,
    converted_client_id: resolveUuid(lead.convertedClientId, maps.clients),
    // G57 — antes, `lead.wonAt || (...)` preservava um wonAt local já
    // truthy mesmo fora de "fechado" (nunca limpava), diferente do caminho
    // PRIMÁRIO de mudança de stage (crmOpportunitiesRepository.ts,
    // moveOpportunityStage), que zera won_at/lost_at/lost_reason nas 3
    // direções. Fix: o `||` só entra DENTRO do ramo "fechado" — preserva um
    // wonAt já existente (idempotência do import — não empurra o timestamp
    // pra "agora" a cada reimportação), mas qualquer stage != "fechado"
    // sempre limpa, igual ao caminho primário.
    won_at: lead.stage === "fechado" ? (lead.wonAt || new Date().toISOString()) : null,
    lost_at: lead.stage === "perdido" ? new Date().toISOString() : null,
    lost_reason: lead.lostReason || null,
    is_demo: lead.isDemo || false,
    archived: lead.archived || false,
    // Etapa 5 · Fatia 8 (O1): tags/history agora têm coluna correspondente
    // (migration 20260723000100) — sem isso, ux ficava só decorativo (tags
    // sumiam, história zerava na releitura). Ver crm-cutover.md §6.2.
    tags: lead.tags && lead.tags.length > 0 ? lead.tags : null,
    history: lead.history ?? [],
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
    lastInteraction: opportunity.updated_at ? intlDate(opportunity.updated_at) : intlDate(new Date()),
    stage,
    pipelineId: "default",
    stageId: stage,
    archived: opportunity.archived || false,
    converted: opportunity.stage === "fechado",
    nextAction: opportunity.next_action || "",
    description: opportunity.notes || "",
    notes: opportunity.notes || "",
    // Etapa 5 · Fatia 8 (O1): antes desta fatia, era hardcoded [] — zerava o
    // histórico de qualquer lead lido da nuvem mesmo que a coluna existisse.
    // Agora lê de volta o que foi gravado (ou [] para linhas pré-migration).
    history: opportunity.history || [],
    tags: opportunity.tags && opportunity.tags.length > 0 ? opportunity.tags : undefined,
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
