// Etapa 5 · Fatia 7 (projects/tasks) — mapper local Project -> Supabase projects.
//
// Fan-out de client_id/quote_id/opportunity_id via os 3 import-maps já provados
// (Fatias 2-4/6) — mapeado -> UUID; ausente -> null. NUNCA id local cru numa coluna
// uuid (padrão Q4).
//
// Tradução de vocabulário do campo `source` (achado central do §7.2 do doc da fatia):
// diferente de finance (onde Transaction.source local já usa o literal "quote", o
// mesmo valor do predicado do índice parcial ux_ft_receivable_from_quote), o local
// Project.source só usa "manual" | "orçamento" — o literal "quote" NUNCA existe no
// dado local. Sem esta tradução, `ux_projects_from_quote` (WHERE source = 'quote')
// vira índice decorativo: um projeto quote-linked importado chegaria com
// source="orçamento", nunca bateria o predicado, e dois projetos vivos para a mesma
// quote coexistiriam sem o banco reclamar. Regra: local "orçamento" + quoteId
// resolvido -> cloud "quote"; qualquer outro caso -> "manual" (passagem direta).
//
// budget é quantizado com roundMoney só para evitar artefato de float (0.1+0.2) —
// SEM checagem de divergência tipo inspectFinanceMoney (decidida N/A na Fase A: é
// uma estimativa editável pelo usuário, não uma cópia fixa do total do orçamento).
import type { Project, ProjectSource } from "@/hooks/useProjects";
import type { SupabaseProject } from "@/repositories/projectsRepository";
import { roundMoney } from "@/services/quotes/quoteMoney";

/**
 * Import-maps local→Supabase usados para resolver as FKs de um projeto.
 * Chaves = `String(idLocal)`; valores = UUID do Supabase.
 *   - clients:       `kora.clients.supabaseImport.v1` (idLocal do cliente → uuid)
 *   - quotes:        `kora.quotes.supabaseImport.v1`   (idLocal do orçamento → uuid)
 *   - opportunities: `kora.crm.supabaseImport.v1`      (idLocal da oportunidade/lead → uuid)
 */
export interface ProjectImportMaps {
  clients: Record<string, string>;
  quotes: Record<string, string>;
  opportunities: Record<string, string>;
}

export const EMPTY_PROJECT_IMPORT_MAPS: ProjectImportMaps = { clients: {}, quotes: {}, opportunities: {} };

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map.
 * Regra de segurança (padrão Q4): mapeado → UUID; ausente/não-mapeado → null. NUNCA id
 * local cru.
 */
export function resolveProjectFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  return map[String(localId)] ?? null;
}

/**
 * Traduz o `source` local para o vocabulário da nuvem (§7.2). Só produz "quote"
 * quando o projeto é genuinamente quote-linked (source local "orçamento" E quote_id
 * já resolvido para um UUID) — um projeto "orçamento" com quoteId órfão (não
 * mapeado ainda) permanece "manual" na nuvem, porque sem quote_id resolvido não há
 * como o predicado `WHERE source = 'quote'` significar algo coerente (o índice é
 * `UNIQUE(quote_id) WHERE source='quote'` — precisa do quote_id de verdade).
 */
export function resolveCloudProjectSource(localSource: ProjectSource | undefined, resolvedQuoteId: string | null): string {
  if (localSource === "orçamento" && resolvedQuoteId) return "quote";
  return "manual";
}

/**
 * Payload de import de um projeto — inclui as FKs resolvidas (UUID ou null), o
 * `source` já traduzido e o `budget` já quantizado. `source_local_id` é adicionado
 * pelo chamador (hook), que conhece o id local e o install id — não é
 * responsabilidade do mapper.
 */
export interface SupabaseProjectImportPayload extends Partial<SupabaseProject> {
  client_id: string | null;
  quote_id: string | null;
  opportunity_id: string | null;
  title: string;
  status: string;
  source: string;
  budget: number;
}

/** Converte um Project local no payload de import (FKs resolvidas, source traduzido, budget quantizado). */
export function mapLocalProjectToSupabase(
  project: Project,
  maps: ProjectImportMaps = EMPTY_PROJECT_IMPORT_MAPS,
): SupabaseProjectImportPayload {
  const quote_id = resolveProjectFk(project.quoteId, maps.quotes);
  return {
    client_id: resolveProjectFk(project.clientId, maps.clients),
    quote_id,
    opportunity_id: resolveProjectFk(project.opportunityId, maps.opportunities),
    title: project.name,
    description: project.description ?? null,
    status: project.status,
    start_date: project.startDate || null,
    due_date: project.dueDate || null,
    budget: roundMoney(project.budget ?? 0),
    source: resolveCloudProjectSource(project.source, quote_id),
    is_demo: false,
    archived: false,
  };
}
