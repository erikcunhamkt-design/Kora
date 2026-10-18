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
// Nada aqui ATRIBUI automaticamente: a atribuição automática ao último atendente
// é uma rodada futura (depende da coluna E da sessão do operador). Este módulo só
// deixa pronto o que a protege de nascer errada: o gate que não pode calar o robô
// por causa de uma atribuição automática esquecida, e a devolução que só desfaz
// o que o próprio handover fez.

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
