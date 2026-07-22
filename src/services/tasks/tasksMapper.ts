// Etapa 5 · Fatia 7 (projects/tasks) — mapper local Task -> Supabase tasks.
//
// Fan-out de client_id/quote_id/project_id via 3 import-maps (padrão Q4 — mapeado ->
// UUID; ausente -> null, nunca id local cru). `project_id` é o 4º import-map desta
// fatia (`kora.projects.supabaseImport.v1`, preenchido pela própria importação de
// projects) — garantia de ordem do §8.1: aqui só resolve (map) ou trata ausência
// como órfã (null); NUNCA inventa um project_id.
//
// `opportunity_id` é sempre `null` no import — Task local não tem NENHUM campo
// `opportunityId` (só Project tem). Isso não é uma órfã a reportar (não há vínculo
// local que falhou em resolver), é ausência estrutural do campo — a UI de
// candidatos deve distinguir os dois casos (§7.4 do doc da fatia).
//
// Diferente de `source` em projects (§7.2), aqui NÃO há tradução de vocabulário:
// Task.source local ("manual"|"projeto"|"orçamento") nunca produz o literal
// "project_template" (usado só pelo gerador de tarefas base, Etapa 3) — os dois
// vocabulários são disjuntos por construção (§7.3). status/priority também são
// passagem direta — colunas TEXT livres, sem CHECK constraint.
import type { Task } from "@/hooks/useTasks";
import type { SupabaseTask } from "@/repositories/tasksRepository";

/**
 * Import-maps local→Supabase usados para resolver as FKs de uma tarefa.
 * Chaves = `String(idLocal)`; valores = UUID do Supabase.
 *   - clients:  `kora.clients.supabaseImport.v1`   (idLocal do cliente → uuid)
 *   - quotes:   `kora.quotes.supabaseImport.v1`     (idLocal do orçamento → uuid)
 *   - projects: `kora.projects.supabaseImport.v1`   (idLocal do projeto → uuid) — NOVO nesta fatia
 */
export interface TaskImportMaps {
  clients: Record<string, string>;
  quotes: Record<string, string>;
  projects: Record<string, string>;
}

export const EMPTY_TASK_IMPORT_MAPS: TaskImportMaps = { clients: {}, quotes: {}, projects: {} };

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map.
 * Regra de segurança (padrão Q4): mapeado → UUID; ausente/não-mapeado → null. NUNCA id
 * local cru.
 */
export function resolveTaskFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  return map[String(localId)] ?? null;
}

/**
 * Payload de import de uma tarefa — inclui as FKs resolvidas (UUID ou null).
 * `source_local_id` é adicionado pelo chamador (hook), que conhece o id local e o
 * install id — não é responsabilidade do mapper. `opportunity_id` é sempre `null`
 * (Task local não tem esse campo, ver nota acima).
 */
export interface SupabaseTaskImportPayload extends Partial<SupabaseTask> {
  project_id: string | null;
  client_id: string | null;
  quote_id: string | null;
  opportunity_id: null;
  title: string;
  status: string;
  priority: string;
  source: string;
}

/** Converte uma Task local no payload de import (FKs resolvidas, passagem direta do resto). */
export function mapLocalTaskToSupabase(
  task: Task,
  maps: TaskImportMaps = EMPTY_TASK_IMPORT_MAPS,
): SupabaseTaskImportPayload {
  return {
    project_id: resolveTaskFk(task.projectId, maps.projects),
    client_id: resolveTaskFk(task.clientId, maps.clients),
    quote_id: resolveTaskFk(task.quoteId, maps.quotes),
    opportunity_id: null,
    title: task.title,
    description: task.description || null,
    status: task.status,
    priority: task.priority,
    due_date: task.dueDate || null,
    source: task.source ?? "manual",
    sort_order: 0,
    is_demo: false,
    archived: false,
  };
}
