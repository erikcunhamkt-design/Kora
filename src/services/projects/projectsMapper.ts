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
import type { Project, ProjectSource, ProjectStatus } from "@/hooks/useProjects";
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

/**
 * Etapa 5 · Pacote do Flip — Fase B, item 1 (resolve O12). Traduz o `status`
 * local pro par (status, archived) da nuvem — mesmo mecanismo de
 * `translateLocalStatusToCloud` (quoteMapper.ts, Q9). Antes desta função,
 * `mapLocalProjectToSupabase` gravava `status` verbatim e `archived: false`
 * hardcoded — um projeto local "archived" produzia `status: "archived"`
 * (texto) + `archived: false` (boolean), os dois sinais divergindo na mesma
 * linha (achado O12). Daqui pra frente, escrita NOVA sai correta dos dois
 * lados; dado legado já gravado continua lido corretamente porque
 * `translateCloudProjectStatusToLocal` (abaixo) já cobre os dois formatos.
 *
 * `"archived"` local não preserva o status anterior ao arquivamento — vira
 * texto neutro (`"planning"`) + `archived: true`. Mesma perda de informação
 * já aceita em `quotes` (`"arquivado"` → `{ status: "draft", archived: true }`),
 * não é uma regressão nova.
 */
export function translateLocalProjectStatusToCloud(
  status: ProjectStatus,
): { status: string; archived: boolean } {
  if (status === "archived") return { status: "planning", archived: true };
  return { status, archived: false };
}

/** Converte um Project local no payload de import (FKs resolvidas, source traduzido, budget quantizado). */
export function mapLocalProjectToSupabase(
  project: Project,
  maps: ProjectImportMaps = EMPTY_PROJECT_IMPORT_MAPS,
): SupabaseProjectImportPayload {
  const quote_id = resolveProjectFk(project.quoteId, maps.quotes);
  const { status, archived } = translateLocalProjectStatusToCloud(project.status);
  return {
    client_id: resolveProjectFk(project.clientId, maps.clients),
    quote_id,
    opportunity_id: resolveProjectFk(project.opportunityId, maps.opportunities),
    title: project.name,
    description: project.description ?? null,
    status,
    start_date: project.startDate || null,
    due_date: project.dueDate || null,
    budget: roundMoney(project.budget ?? 0),
    source: resolveCloudProjectSource(project.source, quote_id),
    is_demo: false,
    archived,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Etapa 5 · Flip Projetos (item 3) — direção nuvem -> local (leitura).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Vocabulário canônico de `status` na nuvem, traduzido pro vocabulário local
 * (ProjectStatus, useProjects.ts). Mesmo mecanismo de CLOUD_TO_LOCAL_STATUS
 * (quoteMapper.ts, Q9): passthrough dos 7 valores locais (o import geral
 * grava verbatim) + tradução do alias legado.
 *
 * 'active' -> 'in_progress': ALIAS LEGADO. É o DEFAULT da própria coluna
 * (20260601030000_create_projects_schema.sql:12) e o valor gravado por
 * projectsRepository.createProjectFromQuote (:51) — nunca um valor que o
 * vocabulário local produz. Candidato a eliminação numa fatia futura (trocar
 * o DEFAULT da coluna + o write de createProjectFromQuote + o OR defensivo
 * de SupabaseOperationalDashboardCard.tsx:315-316 por um vocabulário único)
 * — registrado como dívida na O-série do plano mestre, não resolvido aqui.
 */
export const CLOUD_TO_LOCAL_PROJECT_STATUS: Readonly<Record<string, ProjectStatus>> = {
  planning: "planning",
  in_progress: "in_progress",
  review: "review",
  delivered: "delivered",
  paused: "paused",
  cancelled: "cancelled",
  archived: "archived",
  // alias legado (ver comentário acima) — nunca escrito por código novo.
  active: "in_progress",
};

/**
 * Traduz (status bruto, archived boolean) da nuvem pro `status` local.
 * `archived` (boolean) vence quando true — mesma regra de
 * translateCloudStatusToLocal (quoteMapper.ts, Q9). MAS, diferente de
 * quotes: o boolean `archived` de `projects` é campo morto na escrita atual
 * (mapLocalProjectToSupabase acima sempre grava `archived: false` —
 * nunca traduz status local "archived" pra esse boolean). Por isso o texto
 * `status === "archived"` TAMBÉM precisa vencer sozinho, sem depender do
 * boolean nunca virar true — é o único jeito real de "arquivado" chegar na
 * nuvem hoje (import geral, verbatim). O boolean fica coberto por segurança
 * (se um caminho de escrita futuro passar a setá-lo), não como caminho ativo.
 *
 * Terceiro caso (status desconhecido, nem no mapa nem "archived"): fallback
 * seguro `"planning"` (estado mais neutro/inicial, mesmo espírito do
 * fallback "rascunho" de quotes) + `cloudStatusRaw` com o valor bruto — UI
 * nunca mascara (mesmo padrão do §9a de quotes).
 */
export function translateCloudProjectStatusToLocal(
  cloudStatus: string | null | undefined,
  archived: boolean,
): { status: ProjectStatus; cloudStatusRaw?: string } {
  if (archived || cloudStatus === "archived") return { status: "archived" };
  const translated = cloudStatus ? CLOUD_TO_LOCAL_PROJECT_STATUS[cloudStatus] : undefined;
  if (translated) return { status: translated };
  return { status: "planning", cloudStatusRaw: cloudStatus ?? undefined };
}

/** Inverso de resolveCloudProjectSource: só "quote" vira "orçamento"; qualquer outro valor -> "manual". */
export function resolveLocalProjectSource(cloudSource: string | null | undefined): ProjectSource {
  return cloudSource === "quote" ? "orçamento" : "manual";
}

/**
 * Converte um SupabaseProject pro formato Project local, para a tela
 * principal renderizar sem saber a diferença. `clientNameById` resolve
 * `client_id` (uuid) -> nome de exibição — a nuvem não desnormaliza o nome
 * (diferente de quotes, que tem `client_name` na própria linha); o chamador
 * (ProjectsSection.tsx) monta esse mapa a partir de useClientsDataSource()
 * (clients já é 100% Supabase desde 2026-06-15, protocolo §10 — o `id`
 * devolvido já é o mesmo uuid usado como FK aqui, sem import-map).
 *
 * `deliverables`: lê `sp.deliverables ?? []` — hoje sempre `[]` (coluna
 * ainda não aplicada, migration 20260811000100 escrita e não aplicada,
 * ver item 3-a). `progress` é sempre DERIVADO daqui (não existe coluna
 * `progress` na nuvem, achado da Fase A) — mesmo cálculo de
 * ProjectDetailDrawer.tsx (`computedProgress`), pra lista principal e
 * drawer nunca divergirem.
 */
export function mapSupabaseProjectToLocal(
  sp: SupabaseProject,
  clientNameById: Record<string, string> = {},
): Project {
  const { status, cloudStatusRaw } = translateCloudProjectStatusToLocal(sp.status, sp.archived);
  const deliverables = sp.deliverables ?? [];
  const doneDeliverables = deliverables.filter((d) => d.status === "concluido").length;
  const progress = deliverables.length ? Math.round((doneDeliverables / deliverables.length) * 100) : 0;

  return {
    id: sp.id,
    name: sp.title,
    clientName: (sp.client_id && clientNameById[sp.client_id]) || "",
    description: sp.description ?? undefined,
    status,
    cloudStatusRaw,
    // Sem coluna na nuvem (achado Fase A §3) — default neutro, mesmo default
    // do form local (ProjectsSection.tsx:110) quando o campo fica em branco.
    priority: "medium",
    startDate: sp.start_date ?? undefined,
    dueDate: sp.due_date ?? undefined,
    budget: sp.budget !== undefined ? Number(sp.budget) : undefined,
    progress,
    tags: [],
    createdAt: sp.created_at?.slice(0, 10) ?? "",
    isDemo: sp.is_demo ?? false,
    // Precedente já estabelecido em useClientsDataSource.ts
    // (mapSupabaseClientToLocalClient): uuid da nuvem smuggled como number
    // via cast (as unknown as number), só pra bater com o tipo local
    // (Project.clientId: number) — nunca usado aritmeticamente, só como
    // chave de lookup/comparação (String(clientId)).
    clientId: sp.client_id ? (sp.client_id as unknown as number) : undefined,
    quoteId: sp.quote_id ?? undefined,
    opportunityId: sp.opportunity_id ? (sp.opportunity_id as unknown as number) : undefined,
    source: resolveLocalProjectSource(sp.source),
    deliverables,
    updatedAt: sp.updated_at ?? undefined,
  };
}
