// Etapa 9 · Item 4 (G101) — controle de ATRIBUIÇÃO no painel de contato do WhatsApp
// (docs/architecture/etapa-9-handover-assigned-to-proposta.md §10.6; catálogo G101).
// Pure logic — sem React, sem supabase client importado: quem chama injeta o `invoke`,
// então tudo aqui é testável sem montar a página (mesmo padrão de handover.ts).
//
// Elegibilidade de quem pode ser ESCOLHIDO (§3.5: owner/admin/member, não `viewer`) vem
// da MESMA função que o servidor usa em `assign_conversation`, no claim e no handover —
// importada, não copiada, pra não divergir.
import { isAssignableRole } from "../../../supabase/functions/_shared/botAssignment";
import type { WorkspaceAttendant } from "../../../supabase/functions/_shared/workspaceAttendants";
import type { InvokeFn } from "./handover";

export { isAssignableRole };
export type { WorkspaceAttendant };

export type AssignmentOrigin = "auto" | "manual";

// `whatsapp_conversations.assignment_origin` é coluna PROPOSTA (4ª migration do pacote §8-b,
// não aplicada): `select("*")`/realtime só a trazem depois dela. Leitura por `unknown`, como
// `getHandoverAt`: ausente/null/lixo => `null` (origem desconhecida) — nunca lança.
export function getAssignmentOrigin(conversation: unknown): AssignmentOrigin | null {
  if (!conversation || typeof conversation !== "object") return null;
  const raw = (conversation as Record<string, unknown>).assignment_origin;
  return raw === "auto" || raw === "manual" ? raw : null;
}

// ---------------------------------------------------------------------------
// Lista de atendentes (ação `list_attendants` de whatsapp-instance)
// ---------------------------------------------------------------------------

/** Resposta crua do servidor -> lista tipada. Entrada ruim => lista vazia, nunca lança. */
export function parseAttendants(data: unknown): WorkspaceAttendant[] {
  const list = data && typeof data === "object" ? (data as { attendants?: unknown }).attendants : undefined;
  if (!Array.isArray(list)) return [];
  const out: WorkspaceAttendant[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length === 0) continue;
    out.push({
      id: r.id,
      name: typeof r.name === "string" && r.name.trim() ? r.name : "Sem nome",
      role: typeof r.role === "string" ? r.role : "",
    });
  }
  return out;
}

/** Nunca lança: falha de rede/permissão => lista vazia (o Select fica desabilitado, a página segue). */
export async function listAttendants(invoke: InvokeFn, workspaceId: string): Promise<WorkspaceAttendant[]> {
  try {
    const { data, error } = await invoke("whatsapp-instance", { body: { action: "list_attendants", workspaceId } });
    if (error) return [];
    return parseAttendants(data);
  } catch {
    return [];
  }
}

/** Quem pode ser escolhido no Select. */
export function assignableAttendants(list: WorkspaceAttendant[]): WorkspaceAttendant[] {
  return list.filter((a) => isAssignableRole(a.role));
}

export function attendantName(list: WorkspaceAttendant[], id: string | null | undefined): string | null {
  if (!id) return null;
  return list.find((a) => a.id === id)?.name ?? null;
}

export const UNKNOWN_ASSIGNEE = "um atendente";

/** Nome pra frase corrida ("atribuída a Maria"); quem não está na lista (saiu do workspace) vira "um atendente". */
export function assigneeName(list: WorkspaceAttendant[], id: string | null | undefined): string {
  return attendantName(list, id) ?? UNKNOWN_ASSIGNEE;
}

export const NO_ASSIGNEE_LABEL = "Sem atendente atribuído";

/**
 * Rótulo do estado de atribuição (painel e banner): quem é o dono e como chegou nele.
 * "(automática)" = o handover ou o "assumir ao responder"; "(manual)" = alguém atribuiu.
 * Origem desconhecida (coluna ausente) não acrescenta nada — não afirma o que não sabe.
 */
export function assignmentLabel(
  assignedTo: string | null | undefined,
  list: WorkspaceAttendant[],
  origin?: AssignmentOrigin | null,
): string {
  if (!assignedTo) return NO_ASSIGNEE_LABEL;
  const suffix = origin === "auto" ? " (automática)" : origin === "manual" ? " (manual)" : "";
  return `Atribuída a ${assigneeName(list, assignedTo)}${suffix}`;
}

/**
 * Dica sobre o que "Devolver ao robô" faz com ESTA atribuição — só quando a conversa está
 * entregue e a origem é conhecida (D2: a devolução desfaz só a automática).
 */
export function returnHint(
  handedOver: boolean,
  assignedTo: string | null | undefined,
  origin: AssignmentOrigin | null | undefined,
): string | null {
  if (!handedOver || !assignedTo) return null;
  if (origin === "auto") return "“Devolver ao robô” remove esta atribuição automática.";
  if (origin === "manual") return "“Devolver ao robô” não desfaz uma atribuição manual.";
  return null;
}

// ---------------------------------------------------------------------------
// Ação `assign_conversation`
// ---------------------------------------------------------------------------

export type AssignResult =
  /**
   * `originRecorded: false` => a atribuição valeu, mas a coluna `assignment_origin` não existe
   * (migration pendente): a devolução ao robô não saberá desfazê-la. Servidor sem o campo =>
   * `true` (não alarma sem saber).
   */
  | { kind: "ok"; originRecorded: boolean }
  | { kind: "error"; message: string };

// O servidor responde 400/404/500 com { error: "..." } no corpo; supabase-js só expõe o
// genérico ("Edge Function returned a non-2xx status code") e deixa o Response em
// `error.context`. Tenta o corpo; cai na mensagem do erro.
async function readServerError(error: unknown): Promise<string> {
  const fallback =
    error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message
      : "Falha ao atribuir a conversa.";
  const context = error && typeof error === "object" ? (error as { context?: unknown }).context : null;
  const json = context && typeof context === "object" ? (context as { json?: unknown }).json : null;
  if (typeof json !== "function") return fallback;
  try {
    const body = (await (json as () => Promise<unknown>).call(context)) as { error?: unknown } | null;
    return body && typeof body.error === "string" && body.error ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/** Nunca lança: o chamador decide o toast a partir do `kind`. `userId = null` remove a atribuição. */
export async function assignConversation(
  invoke: InvokeFn,
  workspaceId: string,
  conversationId: string,
  userId: string | null,
): Promise<AssignResult> {
  try {
    const { data, error } = await invoke("whatsapp-instance", {
      body: { action: "assign_conversation", workspaceId, conversationId, userId },
    });
    if (error) return { kind: "error", message: await readServerError(error) };
    const originRecorded = !(data && typeof data === "object" && (data as { originRecorded?: unknown }).originRecorded === false);
    return { kind: "ok", originRecorded };
  } catch (e) {
    return { kind: "error", message: await readServerError(e) };
  }
}

export const ASSIGN_SUCCESS_TITLE = "Conversa atribuída";
export const ASSIGN_REMOVED_TITLE = "Atribuição removida";

// Degradação: coluna `assignment_origin` ausente. A atribuição foi feita (como sempre foi),
// mas sem origem a devolução não distingue manual de automática — e, sem a coluna, nada é
// desfeito por ela. Vocabulário da tela (G29): "Devolver ao robô".
export const ASSIGN_ORIGIN_NOT_RECORDED_TITLE = "Conversa atribuída, mas a origem não foi registrada";
export const ASSIGN_ORIGIN_NOT_RECORDED_DESCRIPTION =
  "A migration da origem da atribuição (Etapa 9) ainda não foi aplicada: a atribuição vale, mas “Devolver ao robô” não vai desfazê-la.";
