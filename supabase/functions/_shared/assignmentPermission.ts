// Etapa 9 · Item 4 — GATE DE PAPEL NO SERVIDOR para atribuir e devolver conversas
// (docs/architecture/etapa-9-handover-assigned-to-proposta.md §11.4; varredura da classe em
// docs/qa/etapa-9-bot-varredura-gate-papel-servidor.md). Pure logic — sem Deno.*, sem npm:
// imports — mesmo padrão de botAssignment.ts.
//
// Por que existe: o painel de contato gateia a atribuição por administrador (G101), mas
// `assign_conversation` aceitava QUALQUER membro (inclusive `viewer`) — gate só de UI, que um
// chamador direto ignora. Aqui o servidor passa a aplicar a MESMA régua. Modelo de referência:
// `whatsapp-official-credentials` (`isAdmin = role in (owner, admin)` => 403 "Admin role required").
//
// A régua (a elegibilidade é a MESMA `isAssignableRole` de sempre — §3.5):
//   owner / admin  => atribuem a QUALQUER elegível e removem qualquer atribuição;
//   member         => só atribuem A SI MESMOS e SÓ se a conversa NÃO tem dono (`assigned_to IS NULL`,
//                     decisão 1 do revisor — não toma conversa de outro; 403 se tiver dono, inclusive
//                     o próprio), ou removem a PRÓPRIA atribuição;
//   viewer / outro => 403 (somente leitura).
// Devolver ao robô (`end_human_handover`): qualquer papel que ATENDE (owner/admin/member); viewer 403.
// Justificativa: devolver NÃO atribui a ninguém — só encerra o estado de handover e desfaz o que o
// PRÓPRIO sistema fez (a atribuição automática); atribuição manual, decisão humana, nunca é tocada.
//
// Honestidade: o gate vale para chamadas ao edge function. A RLS de `whatsapp_conversations` é de
// nível "membro" (wa_conv_update), então escrita DIRETA pelo PostgREST não passa por aqui — fechar
// isso é DDL (§8-b do operador), registrado na varredura; este módulo não finge o contrário.

import { isAssignableRole } from "./botAssignment.ts";

/** Espelha `is_workspace_admin(w_id)` do banco: `role IN ('owner','admin')` (mesmo vocabulário de useWorkspaceRole). */
export const ADMIN_ROLES = ["owner", "admin"] as const;

export function isAdminRole(role: unknown): boolean {
  return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}

export type PermissionDenyReason =
  | "role-cannot-assign"
  | "member-can-only-assign-self"
  | "member-cannot-take-assigned"
  | "member-can-only-remove-own"
  | "role-cannot-return";

/** Texto devolvido na resposta 403 — fala do papel e da saída, sem vazar nada do banco. */
export const PERMISSION_DENY_MESSAGES: Record<PermissionDenyReason, string> = {
  "role-cannot-assign": "Seu papel no workspace (somente leitura) não permite atribuir conversas.",
  "member-can-only-assign-self":
    "Membros só podem atribuir a conversa a si mesmos; para atribuir a outra pessoa é preciso ser administrador.",
  "member-cannot-take-assigned":
    "Esta conversa já tem atendente; só um administrador pode reatribuí-la.",
  "member-can-only-remove-own":
    "Membros só podem remover a própria atribuição; para remover a de outra pessoa é preciso ser administrador.",
  "role-cannot-return": "Seu papel no workspace (somente leitura) não permite devolver conversas ao robô.",
};

export type PermissionDecision =
  /**
   * `scope`: "any" = sem restrição de alvo; "self" = member atribuindo a si mesmo a uma conversa SEM
   * dono (o UPDATE deve ser condicional a `assigned_to IS NULL`); "own-only" = member removendo a
   * PRÓPRIA atribuição (o UPDATE deve ser condicional a `assigned_to = <ele>`).
   */
  | { allow: true; scope: "any" | "self" | "own-only" }
  | { allow: false; status: 403; reason: PermissionDenyReason; message: string };

function deny(reason: PermissionDenyReason): PermissionDecision {
  return { allow: false, status: 403, reason, message: PERMISSION_DENY_MESSAGES[reason] };
}

export function decideAssignPermission(input: {
  role: unknown;
  callerId: string;
  /** Alvo da atribuição; `null`/`undefined` = REMOVER a atribuição. */
  targetUserId: string | null | undefined;
  /**
   * `assigned_to` atual da conversa — obrigatório pra um member em QUALQUER operação (atribuir a si
   * só se está sem dono; remover só a própria). `null` = lida e sem dono; `undefined` = NÃO lida:
   * na dúvida, nega.
   */
  currentAssignedTo?: string | null;
}): PermissionDecision {
  if (!isAssignableRole(input.role)) return deny("role-cannot-assign");
  if (isAdminRole(input.role)) return { allow: true, scope: "any" };

  // Daqui pra baixo o papel é `member`.
  if (input.targetUserId) {
    if (input.targetUserId !== input.callerId) return deny("member-can-only-assign-self");
    return input.currentAssignedTo === null ? { allow: true, scope: "self" } : deny("member-cannot-take-assigned");
  }
  return input.currentAssignedTo && input.currentAssignedTo === input.callerId
    ? { allow: true, scope: "own-only" }
    : deny("member-can-only-remove-own");
}

export function decideReturnPermission(role: unknown): PermissionDecision {
  return isAssignableRole(role) ? { allow: true, scope: "any" } : deny("role-cannot-return");
}
