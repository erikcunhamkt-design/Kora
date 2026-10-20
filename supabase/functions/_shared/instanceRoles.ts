// Etapa 9 · Item 4 (G103) — PAPEL MÍNIMO por ação de `whatsapp-instance` (tabela única + decisão).
// docs/qa/etapa-9-bot-varredura-gate-papel-servidor.md é a versão em prosa desta tabela, e um teste
// (instanceRolesWiring.test.ts) confere as duas contra o código-fonte do handler. Pure logic — sem
// Deno.*, sem npm: imports — mesmo padrão de assignmentPermission.ts.
//
// Antes: a única checagem do servidor era "é membro do workspace" — o papel `viewer` ("somente
// leitura") não era respeitado em lugar nenhum, e ações de instância (apagar/desconectar/importar
// token) não exigiam admin. Agora há UM gate central, antes de qualquer efeito:
//
//   admin  (owner/admin)          — administração da instância: create, connect, set_webhook,
//                                   disconnect, delete, import;
//   member (owner/admin/member)   — escritas OPERACIONAIS: enviar, apagar mensagem, arquivar,
//                                   atribuir, devolver, tags, sincronizar...;
//   viewer (qualquer membro)      — LEITURA: status, load_messages, download_media, listas.
//
// Regras finas dentro de "member" continuam nos deciders próprios (assign_conversation:
// decideAssignPermission; end_human_handover: decideReturnPermission). Ação que NÃO está na
// tabela passa direto (o handler responde 400 "Unknown action"); o teste de fiação garante que
// toda ação do código tem linha aqui, então esquecer uma não passa.
//
// Honestidade: vale para chamadas ao edge function. A RLS de escrita de `whatsapp_*` é de nível
// membro (G104): escrita DIRETA pelo PostgREST não passa por aqui.

import { isAssignableRole } from "./botAssignment.ts";
import { PERMISSION_DENY_MESSAGES, isAdminRole, type PermissionDenyReason } from "./assignmentPermission.ts";

export type MinRole = "admin" | "member" | "viewer";
export type ActionKind = "instance-admin" | "operational-write" | "assignment" | "read";

export interface InstanceActionPolicy {
  min: MinRole;
  kind: ActionKind;
  /** Motivo específico quando um papel sem permissão bate numa ação "member" (ex.: atribuição/devolução). */
  denyReason?: PermissionDenyReason;
}

const admin = (): InstanceActionPolicy => ({ min: "admin", kind: "instance-admin" });
const write = (): InstanceActionPolicy => ({ min: "member", kind: "operational-write" });
const read = (): InstanceActionPolicy => ({ min: "viewer", kind: "read" });

/** As 24 ações de `whatsapp-instance`, cada uma com o papel mínimo. */
export const INSTANCE_ACTION_POLICY: Readonly<Record<string, InstanceActionPolicy>> = {
  // administração da instância (credencial do número / webhook / vida da instância)
  create: admin(),
  connect: admin(),
  set_webhook: admin(),
  disconnect: admin(),
  delete: admin(),
  import: admin(),
  // leitura (o `status` redige o QR pra não-admin — ver o handler)
  status: read(),
  load_messages: read(),
  download_media: read(),
  list_favorite_stickers: read(),
  list_attendants: read(),
  // escritas operacionais
  sync: write(),
  refresh_avatars: write(),
  send: write(),
  send_media: write(),
  forward_message: write(),
  react_message: write(),
  pin_message: write(),
  delete_message: write(),
  archive_conversation: write(),
  mark_unread: write(),
  update_conversation_tags: write(),
  toggle_favorite_sticker: write(),
  // atribuição — o piso é "member"; a régua fina está em assignmentPermission.ts
  assign_conversation: { min: "member", kind: "assignment", denyReason: "role-cannot-assign" },
  end_human_handover: { min: "member", kind: "assignment", denyReason: "role-cannot-return" },
};

export const INSTANCE_ACTIONS: readonly string[] = Object.keys(INSTANCE_ACTION_POLICY);

export type RoleGateReason = "role-requires-admin" | "role-read-only";

export const ROLE_GATE_MESSAGES: Record<RoleGateReason, string> = {
  "role-requires-admin": "Esta ação exige papel de administrador (owner ou admin) no workspace.",
  "role-read-only": "Seu papel no workspace (somente leitura) não permite esta ação.",
};

export type InstanceActionDecision =
  /** `known: false` = ação fora da tabela (o handler responde "Unknown action"). */
  | { allow: true; known: boolean }
  | { allow: false; status: 403; reason: RoleGateReason | PermissionDenyReason; message: string };

function deny(reason: RoleGateReason | PermissionDenyReason): InstanceActionDecision {
  const message =
    reason === "role-requires-admin" || reason === "role-read-only"
      ? ROLE_GATE_MESSAGES[reason]
      : PERMISSION_DENY_MESSAGES[reason];
  return { allow: false, status: 403, reason, message };
}

export function minRoleOf(action: unknown): MinRole | null {
  return typeof action === "string" && Object.prototype.hasOwnProperty.call(INSTANCE_ACTION_POLICY, action)
    ? INSTANCE_ACTION_POLICY[action].min
    : null;
}

/** Decide ANTES de qualquer efeito. `role` é o `workspace_members.role` do chamador. */
export function decideInstanceAction(action: unknown, role: unknown): InstanceActionDecision {
  const policy =
    typeof action === "string" && Object.prototype.hasOwnProperty.call(INSTANCE_ACTION_POLICY, action)
      ? INSTANCE_ACTION_POLICY[action]
      : null;
  if (!policy) return { allow: true, known: false };
  switch (policy.min) {
    case "viewer":
      return { allow: true, known: true };
    case "member":
      return isAssignableRole(role) ? { allow: true, known: true } : deny(policy.denyReason ?? "role-read-only");
    case "admin":
      return isAdminRole(role) ? { allow: true, known: true } : deny("role-requires-admin");
  }
}
