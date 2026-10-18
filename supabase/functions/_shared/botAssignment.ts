// Etapa 9 · Item 4 — ATRIBUIÇÃO no handover (G48): origem da atribuição e o gate
// antigo `respond_all = false + assigned_to` (docs/architecture/etapa-9-handover-
// assigned-to-proposta.md §3.2/§3.3, decisões do revisor registradas lá). Pure
// logic — sem Deno.*, sem npm: imports — mesmo padrão de botHandover.ts.
//
// `whatsapp_conversations.assignment_origin` ('auto' | 'manual' | NULL) é uma
// coluna PROPOSTA (4ª migration do pacote §8-b, NÃO aplicada). TUDO aqui degrada
// pro comportamento de antes quando a coluna não existe: o campo chega
// `undefined` -> origem desconhecida -> tratada como atribuição HUMANA (a leitura
// conservadora: nunca desfaz nem ignora o que pode ter sido decisão de uma pessoa).
//
// Três peças, todas atrás da mesma degradação:
// 1. o gate do robô, que não pode calar por causa de uma atribuição AUTOMÁTICA
//    esquecida;
// 2. a devolução, que só desfaz o que o próprio handover fez (e diz à UI se o
//    robô ainda fica mudo — `computeReturnOutcome`);
// 3. a atribuição AUTOMÁTICA no handover (`autoAssignOnHandover`, D1 do revisor):
//    o último atendente humano que respondeu (por `whatsapp_messages.sender_id`)
//    vira o dono — e SÓ se a origem puder ser marcada na mesma escrita.

export const ASSIGNMENT_ORIGINS = ["auto", "manual"] as const;
export type AssignmentOrigin = (typeof ASSIGNMENT_ORIGINS)[number];

// Lê `assignment_origin`. `undefined` (coluna inexistente), `null` (atribuição
// anterior à coluna / sem atribuição) e qualquer lixo viram `null` = "origem
// desconhecida" — nunca lança.
export function parseAssignmentOrigin(raw: unknown): AssignmentOrigin | null {
  return typeof raw === "string" && (ASSIGNMENT_ORIGINS as readonly string[]).includes(raw)
    ? (raw as AssignmentOrigin)
    : null;
}

// ---------------------------------------------------------------------------
// Gate do robô: "atribuída a um humano + respond_all desligado => robô fora"
// ---------------------------------------------------------------------------

export interface AssigneeGateInput {
  /** `respond_all` efetivo (trigger habilitado ou coluna do bot; default true). */
  respondAll: boolean;
  assignedTo: string | null | undefined;
  assignmentOrigin: unknown;
  /** `handover_at` preenchido? (conversa entregue a humano). */
  handedOver: boolean;
}

/**
 * O robô deve se calar por causa da atribuição?
 *
 * Regra de ANTES (preservada integralmente quando a origem é desconhecida):
 * `!respondAll && assignedTo`.
 *
 * Ajuste: uma atribuição **automática** só existe enquanto o handover que a
 * criou está em vigor — e então o robô já está mudo por `handover_at`. Se a
 * origem é `auto` e a conversa NÃO está mais entregue, é uma sobra (a
 * desatribuição da devolução falhou, ou a corrida entre os dois UPDATEs da
 * devolução) e **não pode** calar o robô: era exatamente o "mudo depois de
 * Devolver ao robô". Atribuição manual (ou de origem desconhecida) continua
 * calando, como sempre foi — a devolução NÃO desfaz decisão humana.
 */
export function shouldBotYieldToAssignee(input: AssigneeGateInput): boolean {
  if (input.respondAll) return false;
  if (!input.assignedTo) return false;
  const staleAutoAssignment = parseAssignmentOrigin(input.assignmentOrigin) === "auto" && !input.handedOver;
  return !staleAutoAssignment;
}

// ---------------------------------------------------------------------------
// Devolução ao robô: desatribui SOMENTE o que foi automático
// ---------------------------------------------------------------------------

export interface AssignmentSnapshot {
  assignedTo: string | null;
  assignmentOrigin: AssignmentOrigin | null;
}

// A partir da linha crua `{ assigned_to, assignment_origin }`.
export function parseAssignmentSnapshot(row: unknown): AssignmentSnapshot {
  const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  return {
    assignedTo: typeof r.assigned_to === "string" && r.assigned_to.length > 0 ? r.assigned_to : null,
    assignmentOrigin: parseAssignmentOrigin(r.assignment_origin),
  };
}

/** A devolução deve desatribuir? Só se HÁ atribuição e ela foi AUTOMÁTICA. */
export function shouldUnassignOnReturn(snapshot: AssignmentSnapshot): boolean {
  return snapshot.assignedTo !== null && snapshot.assignmentOrigin === "auto";
}

export function buildReturnUnassignUpdate(nowIso: string): Record<string, unknown> {
  return { assigned_to: null, assignment_origin: null, updated_at: nowIso };
}

// Atribuição feita por uma PESSOA (assign_conversation): marca a origem como
// 'manual'; desatribuir (userId nulo) zera a origem. UPDATE SEPARADO do que
// grava `assigned_to` de propósito: coluna ausente => só este falha (warn), a
// atribuição em si continua funcionando como sempre.
export function buildManualAssignmentOriginUpdate(assignedUserId: string | null | undefined): Record<string, unknown> {
  return { assignment_origin: assignedUserId ? "manual" : null };
}

// ---------------------------------------------------------------------------
// Atribuição AUTOMÁTICA no handover (decisão D1 do revisor)
// ---------------------------------------------------------------------------

/**
 * Quem foi o último ATENDENTE HUMANO a responder nesta conversa?
 *
 * Só conta mensagem de SAÍDA com autor (`sender_id` string não-vazia):
 * - o robô não tem autor (`sendBotText` não grava `sender_id`) => ignorado;
 * - mensagem digitada no celular (`fromMe` via webhook) não tem autor => ignorada;
 * - mensagens antigas, de antes de `sender_id` ser gravado, não têm autor => ignoradas;
 * - entrada (`inbound`) é do cliente, mesmo que alguma linha traga `sender_id`.
 *
 * "Último" = maior `created_at` (independe da ordem em que as linhas chegam;
 * data ausente/inválida vale como a mais antiga). Sem candidata => `null`: a
 * conversa fica NÃO atribuída (o revisor decidiu: melhor "aguardando humano" do
 * que chutar um dono).
 */
export function pickLastHumanResponder(rows: unknown): string | null {
  if (!Array.isArray(rows)) return null;
  let best: { id: string; at: number } | null = null;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (r.direction !== "outbound") continue;
    if (typeof r.sender_id !== "string" || r.sender_id.length === 0) continue;
    const parsed = typeof r.created_at === "string" ? Date.parse(r.created_at) : Number.NaN;
    const at = Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
    if (best === null || at > best.at) best = { id: r.sender_id, at };
  }
  return best ? best.id : null;
}

// Papéis que ATENDEM (proposta §3.5): `viewer` só observa. O servidor deixa qualquer
// membro enviar, então um `viewer` pode aparecer como autor no histórico — mas não
// vira dono da conversa.
export const ASSIGNABLE_ROLES = ["owner", "admin", "member"] as const;

export function isAssignableRole(role: unknown): boolean {
  return typeof role === "string" && (ASSIGNABLE_ROLES as readonly string[]).includes(role);
}

/**
 * UM único UPDATE grava `assigned_to` E `assignment_origin = 'auto'`. De propósito:
 * se a coluna `assignment_origin` não existir (4ª migration do pacote §8-b
 * pendente) o PostgREST recusa o UPDATE INTEIRO e NADA é gravado — nunca existe
 * atribuição automática sem origem marcada (sem a origem a devolução ao robô não
 * saberia desfazê-la e o robô ficaria mudo). Dois UPDATEs deixariam uma janela
 * (e um estado) em que isso é possível.
 */
export function buildAutoAssignmentUpdate(userId: string, nowIso: string): Record<string, unknown> {
  return { assigned_to: userId, assignment_origin: "auto", updated_at: nowIso };
}

export type AutoAssignOutcome =
  /** Gravou: `assigned_to = userId`, `assignment_origin = 'auto'`. */
  | { kind: "assigned"; userId: string }
  /** A conversa JÁ tinha dono (humano ou não): nada é tocado. */
  | { kind: "already-assigned" }
  /** Ninguém (com autor) respondeu: fica não atribuída ("Aguardando humano"). */
  | { kind: "no-responder" }
  /** O último a responder já não é elegível (saiu do workspace ou virou `viewer`): não atribui a um fantasma. */
  | { kind: "responder-not-eligible"; userId: string }
  /** O UPDATE condicional não pegou nenhuma linha: alguém atribuiu no meio. */
  | { kind: "lost-race" }
  /** Algo falhou (leitura, checagem de elegibilidade ou a escrita — ex.: coluna ausente): só entrega. */
  | { kind: "unavailable"; step: "read-messages" | "check-eligibility" | "write"; detail: string };

/** Acesso a dados INJETADO (mesmo padrão de knowledgeLoader): a lógica não conhece o Supabase. */
export interface AutoAssignDeps {
  /** Mensagens de SAÍDA com autor da conversa (qualquer ordem; a regra é de `pickLastHumanResponder`). */
  fetchHumanOutbound(): Promise<{ rows: unknown; error: string | null }>;
  /** Membro do workspace COM papel que atende (`isAssignableRole`)? */
  isEligibleAssignee(userId: string): Promise<{ eligible: boolean; error: string | null }>;
  /** UPDATE ÚNICO e CONDICIONAL (`assigned_to IS NULL`); `applied` = pegou alguma linha. */
  writeAutoAssignment(userId: string): Promise<{ applied: boolean; error: string | null }>;
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * Atribui a conversa ao último atendente humano que respondeu — chamada UMA vez,
 * no instante em que o handover é persistido. Nunca lança: qualquer falha vira
 * `unavailable` e o handover (que já aconteceu) segue valendo, só sem dono.
 */
export async function autoAssignOnHandover(
  input: { currentAssignedTo: string | null | undefined },
  deps: AutoAssignDeps,
): Promise<AutoAssignOutcome> {
  if (input.currentAssignedTo) return { kind: "already-assigned" };

  let rows: unknown;
  try {
    const read = await deps.fetchHumanOutbound();
    if (read.error) return { kind: "unavailable", step: "read-messages", detail: read.error };
    rows = read.rows;
  } catch (e) {
    return { kind: "unavailable", step: "read-messages", detail: messageOf(e) };
  }

  const userId = pickLastHumanResponder(rows);
  if (!userId) return { kind: "no-responder" };

  try {
    const check = await deps.isEligibleAssignee(userId);
    if (check.error) return { kind: "unavailable", step: "check-eligibility", detail: check.error };
    if (!check.eligible) return { kind: "responder-not-eligible", userId };
  } catch (e) {
    return { kind: "unavailable", step: "check-eligibility", detail: messageOf(e) };
  }

  try {
    const write = await deps.writeAutoAssignment(userId);
    if (write.error) return { kind: "unavailable", step: "write", detail: write.error };
    return write.applied ? { kind: "assigned", userId } : { kind: "lost-race" };
  } catch (e) {
    return { kind: "unavailable", step: "write", detail: messageOf(e) };
  }
}

// ---------------------------------------------------------------------------
// `respond_all` EFETIVO — uma regra só, usada pelo robô e pelo aviso da devolução
// ---------------------------------------------------------------------------

interface TriggerLike {
  properties?: { respondAll?: unknown };
}

/**
 * Regra que o `whatsapp-bot-reply` sempre usou, agora num lugar só: o nó trigger
 * HABILITADO do fluxo manda (`properties.respondAll`); sem trigger vale a coluna
 * `whatsapp_bot_settings.respond_all`; ausente/nulo => `true` (irrestrito).
 */
export function effectiveRespondAll(trigger: TriggerLike | null | undefined, columnRespondAll: unknown): boolean {
  const raw = trigger ? trigger.properties?.respondAll : columnRespondAll;
  return raw === undefined || raw === null ? true : Boolean(raw);
}

/**
 * O mesmo, a partir da linha crua de `whatsapp_bot_settings` (`flow_data` pode vir
 * como JSON em texto ou já como array; ilegível => sem trigger, como no robô).
 * Sem linha de configuração => irrestrito.
 */
export function resolveRespondAllFromSettings(row: unknown): boolean {
  const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  let nodes: unknown = [];
  try {
    nodes = typeof r.flow_data === "string" ? JSON.parse(r.flow_data) : r.flow_data;
  } catch {
    nodes = [];
  }
  const trigger = Array.isArray(nodes)
    ? nodes.find(
        (n): n is TriggerLike & { type: string; enabled: boolean } =>
          !!n && typeof n === "object" && (n as { type?: unknown }).type === "trigger" && (n as { enabled?: unknown }).enabled === true,
      )
    : undefined;
  return effectiveRespondAll(trigger, r.respond_all);
}

// ---------------------------------------------------------------------------
// Resultado da devolução (contrato pra UI)
// ---------------------------------------------------------------------------

export interface ReturnOutcome {
  /** A devolução desfez uma atribuição AUTOMÁTICA. */
  unassigned: boolean;
  /**
   * Depois da devolução o robô AINDA fica mudo por causa da atribuição (o caso
   * residual do gate: atribuição manual + `respond_all` desligado). É o gate
   * REAL do robô (`shouldBotYieldToAssignee`) aplicado ao estado de depois da
   * devolução — o aviso da UI não adivinha, repete o que o robô vai fazer.
   */
  botStillMuted: boolean;
}

export function computeReturnOutcome(input: {
  snapshot: AssignmentSnapshot;
  unassigned: boolean;
  respondAll: boolean;
}): ReturnOutcome {
  const remainingAssignee = input.unassigned ? null : input.snapshot.assignedTo;
  return {
    unassigned: input.unassigned,
    botStillMuted: shouldBotYieldToAssignee({
      respondAll: input.respondAll,
      assignedTo: remainingAssignee,
      assignmentOrigin: input.snapshot.assignmentOrigin,
      handedOver: false,
    }),
  };
}
