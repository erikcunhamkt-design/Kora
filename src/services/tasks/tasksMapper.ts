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

// ─────────────────────────────────────────────────────────────────────────
// R1 (docs/qa/tarefas-r2-auditoria.md §2.2) — vocabulário de status em
// public.tasks.status.
// ─────────────────────────────────────────────────────────────────────────
//
// O comentário no topo deste arquivo já documenta a decisão: status é
// "passagem direta" — SEM tradução de vocabulário (diferente de `source` em
// projects, §7.2 daquela fatia). Ou seja, o vocabulário oficial de
// public.tasks.status SEMPRE foi o local (TaskStatus, useTasks.ts:
// a_fazer/em_andamento/revisao/concluido, português) — é o que `importTask`
// (o único caminho de escrita sem flag, ativo hoje) já grava, verbatim,
// desde que este mapper existe.
//
// `tasksRepository.updateTaskStatus` nunca seguiu esse contrato: sua
// assinatura só aceitava "todo" | "in_progress" | "done" (3 valores, inglês)
// — um 2º dialeto pra mesma coluna, e sem "revisão" nenhuma forma de
// representar (R1). Como as 2 flags que gateiam esse caminho
// (`supabaseOperationalDashboard` + `tasksSupabaseStatusTransition`) são
// default OFF, o risco está ARMADO, não disparando (nenhuma linha real
// deveria ter os 3 valores em inglês hoje) — mas a assinatura permanecia
// incorreta pra quem ligasse as flags.
//
// Fix: `updateTaskStatus` passou a aceitar os mesmos 4 valores locais — não
// uma tradução nova, só alinhamento ao contrato que este arquivo já
// documentava. `normalizeCloudTaskStatus` abaixo existe só de proteção pra
// UI de leitura (`SupabaseOperationalDashboardCard.tsx`), caso uma linha já
// tenha os 3 valores legados em inglês gravados (alguém ligou as flags antes
// deste fix) — nunca inventa um valor, nunca mascara um status desconhecido
// como "concluído" (mesma disciplina de `cloudStatusRaw` em quotes/projects).

export type CloudTaskStatus = "a_fazer" | "em_andamento" | "revisao" | "concluido";

const LEGACY_CLOUD_TASK_STATUS: Readonly<Record<string, CloudTaskStatus>> = {
  todo: "a_fazer",
  in_progress: "em_andamento",
  done: "concluido",
};

/** Normaliza um `status` bruto de `public.tasks` pro vocabulário local — trata
 * os 3 valores legados em inglês (nunca escritos por código novo) como alias
 * dos 4 valores reais; qualquer outro valor passa intocado (nunca mascara). */
export function normalizeCloudTaskStatus(status: string): CloudTaskStatus | string {
  return LEGACY_CLOUD_TASK_STATUS[status] ?? status;
}
