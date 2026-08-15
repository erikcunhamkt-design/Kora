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
import type { Task, TaskPriority, TaskSource, TaskStatus } from "@/hooks/useTasks";
import type { SupabaseTask } from "@/repositories/tasksRepository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 *
 * G53 (fundações de Fase B, `etapa-5-flip-tarefas-pacote.md` §3.2) — mesmo
 * molde literal de `resolveProjectFk`/`resolveFinanceFk` pós-G37: nem todo
 * `localId` que chega aqui é de fato um id LOCAL precisando de tradução via
 * import-map — se `quoteId`/`clientId`/`projectId` já chegar como um uuid
 * real (ex.: uma quote/projeto já lidos da nuvem, não de import), procurar
 * esse uuid no import-map (que só mapeia id LOCAL → uuid) nunca bate, e a FK
 * vira `null` silenciosamente. Passa direto quando já é um uuid válido —
 * nunca procura no import-map nesse caso.
 */
export function resolveTaskFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  const key = String(localId);
  if (UUID_RE.test(key)) return key;
  return map[key] ?? null;
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

// ─────────────────────────────────────────────────────────────────────────
// G49 (docs/architecture/kora-hub-auditoria-e-plano.md) — mesmo defeito do
// R1 acima, agora em `priority`: `CreateProjectBaseTasksDialog.tsx` gravava
// "medium"/"high"/"low" (inglês) direto em `public.tasks.priority`, enquanto
// o vocabulário oficial (o que `importTask`/`mapLocalTaskToSupabase` acima
// já grava, verbatim, desde que este mapper existe) sempre foi o local
// (`TaskPriority`, useTasks.ts: alta/média/baixa, português). Fix: o
// diálogo passou a gravar o vocabulário local diretamente — não uma
// tradução nova, alinhamento ao contrato que este arquivo já documentava.
// `normalizeCloudTaskPriority` existe pela mesma razão que
// `normalizeCloudTaskStatus`: proteger a leitura (`SupabaseOperationalDashboardCard.tsx`)
// caso uma linha já tenha os 3 valores legados em inglês gravados (o gerador
// de tarefas-base rodou antes deste fix) — nunca inventa, nunca mascara um
// valor desconhecido.

export type CloudTaskPriority = "alta" | "média" | "baixa";

const LEGACY_CLOUD_TASK_PRIORITY: Readonly<Record<string, CloudTaskPriority>> = {
  high: "alta",
  medium: "média",
  low: "baixa",
};

/** Normaliza uma `priority` bruta de `public.tasks` pro vocabulário local —
 * trata os 3 valores legados em inglês (só possíveis numa linha gravada
 * antes do fix do G49) como alias dos 3 valores reais; qualquer outro valor
 * passa intocado (nunca mascara). */
export function normalizeCloudTaskPriority(priority: string): CloudTaskPriority | string {
  return LEGACY_CLOUD_TASK_PRIORITY[priority] ?? priority;
}

// G53 (fundações de Fase B, independentes da decisão de convivência com
// `public.tasks` — `etapa-5-flip-tarefas-pacote.md` §3.4) — direção nuvem ->
// local (leitura). Mesmo molde de `mapSupabaseTransactionToLocal`
// (financeMapper.ts) e `mapSupabaseProjectToLocal` (projectsMapper.ts):
// payload completo desde o dia 1 (G37, "achado do financeMapper" — nunca
// nasce esquecendo um campo que já tem coluna, pra não reencontrar o mesmo
// buraco que `deliverables` deixou em projects por meses).
//
// Vocabulário de `source`: mesma disciplina de `KNOWN_LOCAL_SOURCE`
// (financeMapper.ts) — o comentário do topo deste arquivo já documenta que
// local ("manual"/"projeto"/"orçamento") e nuvem ("project_template", G49)
// são vocabulários DISJUNTOS por construção, não uma tradução 1:1. Uma linha
// `project_template` (ou qualquer valor futuro desconhecido) cai no fallback
// neutro "manual" — nunca inventa "projeto"/"orçamento" pra um vínculo que
// não existe da mesma forma no local.
const KNOWN_LOCAL_TASK_SOURCE: ReadonlySet<string> = new Set<TaskSource>(["manual", "projeto", "orçamento"]);

/**
 * Converte um `SupabaseTask` pro formato `Task` local.
 *
 * Tratamento campo a campo dos campos SEM contraparte cloud (7 gaps da
 * triagem do pacote, §1 — nenhuma migration deste pacote foi aplicada, então
 * NENHUM desses tem coluna hoje, incluindo os 4 que a triagem propõe como
 * bloqueantes):
 *   - `scope`/`recurrence` (enum) → membro NEUTRO (`"work"`/`"none"`), mesmo
 *     tratamento que `recurrence: "none"` já recebe em
 *     `mapSupabaseTransactionToLocal`.
 *   - `tags`/`subtasks`/`comments` (coleção) → array vazio (`[]`), mesmo
 *     espírito do membro neutro, aplicado a uma coleção em vez de um enum.
 *   - `taskProjectId`/`milestoneId` (FK-shaped, apontam pra entidades sem
 *     representação cloud — `TaskProject`/`Milestone`) → `undefined`, mesmo
 *     tratamento de `supplierId`/`cashAccountId` em `mapSupabaseTransactionToLocal`.
 *   - `reminderAt`/`reminderSentAt` (string opcional, sem sentido semântico
 *     de "rótulo" como `category`) → `undefined`, mesmo tratamento de
 *     `notes` em `mapSupabaseTransactionToLocal` (nem todo gap de string
 *     vira um placeholder rotulado — só os que são campo de classificação
 *     exibido, como `category` era antes de ganhar coluna).
 *   - `reminderEnabled` (boolean) → `false`, o default neutro/seguro já
 *     usado em `useTaskReminders.ts:109` pro mesmo campo quando ausente.
 *   - Nenhum gap desta rodada é uma string livre "tipo `category`" (o único
 *     candidato a placeholder rotulado — não há um campo de classificação
 *     textual sem coluna em Tarefas hoje), por isso a categoria "placeholder
 *     rotulado p/ string" do padrão do financeMapper não se aplica a nenhum
 *     campo aqui; registrado explicitamente, não por omissão.
 *
 * Campos DERIVADOS (têm coluna cloud, mas sem denormalização pronta —
 * diferente de gap estrutural):
 *   - `client`/`project` (strings de exibição, REQUERIDAS no tipo local,
 *     diferente de `clientName`/`quoteTitle` opcionais em Transaction) →
 *     resolvidos via `clientNameById` (mesmo padrão de
 *     `mapSupabaseProjectToLocal`) ou `""` quando não resolvível — `""` já é
 *     um valor de tarefa solta legítimo hoje (`makeTask()` do teste usa o
 *     mesmo default). `project` fica sempre `""` nesta rodada — resolver o
 *     nome do projeto exigiria um join que este mapper não faz (mesmo gap
 *     não resolvido do `quoteTitle` em `mapSupabaseTransactionToLocal`,
 *     fora de escopo desta fundação).
 *   - `deadline` (display legado, "mantido por compatibilidade" segundo o
 *     próprio comentário do tipo) → `""`, nunca fabricado: a UI real
 *     (`Tarefas.tsx:806,1009`) já prefere `dueDate` e só cai pra `deadline`
 *     quando `dueDate` também está ausente — `""` cai corretamente no
 *     fallback "Sem prazo"/"—" do próprio componente, sem regressão.
 *
 * `id`/`clientId`: uuid da nuvem smuggled como `number` via cast — mesmo
 * precedente de `mapSupabaseProjectToLocal`/`mapSupabaseTransactionToLocal`
 * (`as unknown as number`, nunca usado aritmeticamente, só como chave de
 * lookup/comparação). Diferente dos outros dois domínios, aqui até o
 * `id` da própria linha precisa do cast — `Task.id` é `number`
 * (`useTasks.ts:16`), não `string` como `Project.id`/`Transaction.id`.
 *
 * `status`: usa `normalizeCloudTaskStatus` (G40) — nunca mascara um valor
 * desconhecido, mas como `Task.status` é tipado estritamente (união de 4
 * valores, sem um campo irmão tipo `cloudStatusRaw` pra guardar um valor
 * fora do vocabulário), o cast final é `as TaskStatus` — aceito porque G40
 * já fechou o único caminho de escrita real com esse gap (`updateTaskStatus`).
 *
 * `priority`: usa `normalizeCloudTaskPriority` (G49, mesmo molde de
 * `normalizeCloudTaskStatus`/G40 acima) — G49 fechou exatamente o gap que
 * esta fundação (G53) tinha deixado aberto de propósito (ver commit do G53:
 * "priority fica passagem direta, sem normalizar — gap conhecido, ligado ao
 * G49, em correção no lado da escrita"). Resolução da colisão semântica
 * §18.3: a decisão da Lane B vence — o mapper de leitura passa a consumir
 * `normalizeCloudTaskPriority` em vez do passthrough cru. Mesmo cast final
 * `as TaskPriority` do `status` acima (`Task.priority` também não tem um
 * campo irmão tipo `cloudPriorityRaw`).
 */
export function mapSupabaseTaskToLocal(
  st: SupabaseTask,
  clientNameById: Record<string, string> = {},
): Task {
  const source = KNOWN_LOCAL_TASK_SOURCE.has(st.source) ? (st.source as TaskSource) : "manual";

  return {
    // uuid da nuvem smuggled como number — ver nota acima (id).
    id: st.id as unknown as number,
    title: st.title,
    description: st.description ?? "",
    client: st.client_id ? (clientNameById[st.client_id] ?? "") : "",
    project: "",
    projectId: st.project_id ?? undefined,
    // Gaps sem coluna cloud (§1 da triagem) — membro neutro / coleção vazia / undefined.
    taskProjectId: undefined,
    scope: "work",
    priority: normalizeCloudTaskPriority(st.priority) as TaskPriority,
    deadline: "",
    dueDate: st.due_date ?? undefined,
    status: normalizeCloudTaskStatus(st.status) as TaskStatus,
    createdAt: st.created_at,
    updatedAt: st.updated_at ?? undefined,
    tags: [],
    subtasks: [],
    comments: [],
    recurrence: "none",
    archived: st.archived,
    isDemo: st.is_demo ?? false,
    reminderAt: undefined,
    reminderEnabled: false,
    reminderSentAt: undefined,
    clientId: st.client_id ? (st.client_id as unknown as number) : undefined,
    quoteId: st.quote_id ?? undefined,
    milestoneId: undefined,
    source,
  };
}
