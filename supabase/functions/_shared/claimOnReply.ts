// Etapa 9 · Item 4 (G102) — "ASSUMIR AO RESPONDER": quando um atendente humano responde
// numa conversa que o robô entregou a humano e que ainda não tem dono, ele a assume.
// (docs/architecture/etapa-9-handover-assigned-to-proposta.md §10.6; catálogo G102.)
// Pure logic com acesso a dados INJETADO — mesmo padrão de autoAssignOnHandover — sem
// Deno.*, sem npm: imports; testável via vitest sem banco.
//
// É a metade que faltava da D1: a atribuição do handover olha o histórico NO INSTANTE da
// entrega; uma conversa entregue antes de qualquer resposta humana ficava sem dono pra
// sempre, com o badge "Aguardando humano" mesmo com o atendente já conversando.
//
// Regras:
// - só conta resposta que SAIU (send ok): "Aguardando humano" significa "ninguém
//   respondeu ao cliente"; um envio que falhou não responde nada;
// - só em conversa ENTREGUE (`handover_at`) — fora de handover o robô/atendimento normal
//   segue como sempre e nada é atribuído;
// - NUNCA pisa em atribuição existente (qualquer origem);
// - o remetente precisa atender (owner/admin/member — §3.5): `viewer` pode ter enviado,
//   mas não vira dono;
// - origem 'auto' (assunção implícita): a devolução ao robô a desfaz, como a do handover;
// - UM update atômico e condicional (`assigned_to IS NULL` + `handover_at IS NOT NULL`):
//   coluna `assignment_origin` ausente => o PostgREST recusa tudo => nada é atribuído
//   (mesma degradação do handover; nunca fica atribuída sem origem).

import { buildAutoAssignmentUpdate, isAssignableRole } from "./botAssignment.ts";
import { isHandedOver } from "./botHandover.ts";

export type ClaimSkipReason = "send-failed" | "not-handed-over" | "already-assigned" | "sender-not-assignable";

export type ClaimDecision = { claim: true } | { claim: false; reason: ClaimSkipReason };

/**
 * Decide, só com o que já está em memória (a linha da conversa que o handler leu),
 * se esta resposta deve assumir a conversa. Linha parcial/sem as colunas novas =>
 * "não entregue" => nada acontece (comportamento de antes).
 */
export function decideClaimOnReply(input: {
  conversation: unknown;
  senderRole: unknown;
  sendOk: boolean;
}): ClaimDecision {
  if (!input.sendOk) return { claim: false, reason: "send-failed" };
  const row =
    input.conversation && typeof input.conversation === "object" ? (input.conversation as Record<string, unknown>) : {};
  if (!isHandedOver(row.handover_at)) return { claim: false, reason: "not-handed-over" };
  if (typeof row.assigned_to === "string" && row.assigned_to.length > 0) {
    return { claim: false, reason: "already-assigned" };
  }
  if (!isAssignableRole(input.senderRole)) return { claim: false, reason: "sender-not-assignable" };
  return { claim: true };
}

export type ClaimOutcome =
  /** Gravou: `assigned_to = userId`, `assignment_origin = 'auto'`. */
  | { kind: "claimed"; userId: string }
  | { kind: "skipped"; reason: ClaimSkipReason }
  /** O UPDATE condicional não pegou linha: alguém atribuiu (ou devolveu) no meio. */
  | { kind: "lost-race" }
  /** A escrita falhou (ex.: coluna `assignment_origin` ausente): nada foi atribuído. */
  | { kind: "unavailable"; detail: string };

export interface ClaimDeps {
  /**
   * UPDATE ÚNICO e CONDICIONAL (`assigned_to IS NULL` e `handover_at IS NOT NULL`)
   * com `buildAutoAssignmentUpdate`; `applied` = pegou alguma linha.
   */
  writeClaim(userId: string): Promise<{ applied: boolean; error: string | null }>;
}

/** Nunca lança: qualquer falha vira `unavailable` e a resposta do atendente segue intacta. */
export async function claimConversationOnReply(
  input: { conversation: unknown; senderId: string; senderRole: unknown; sendOk: boolean },
  deps: ClaimDeps,
): Promise<ClaimOutcome> {
  const decision = decideClaimOnReply(input);
  if (!decision.claim) return { kind: "skipped", reason: decision.reason };
  try {
    const write = await deps.writeClaim(input.senderId);
    if (write.error) return { kind: "unavailable", detail: write.error };
    return write.applied ? { kind: "claimed", userId: input.senderId } : { kind: "lost-race" };
  } catch (e) {
    return { kind: "unavailable", detail: e instanceof Error ? e.message : String(e) };
  }
}

/** O payload do claim é o mesmo da atribuição automática do handover (um update, origem junto). */
export const buildClaimUpdate = buildAutoAssignmentUpdate;
