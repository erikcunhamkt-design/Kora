// Etapa 9 · Item 4 (G103) — o que a UI do WhatsApp mostra por PAPEL, derivado da MESMA tabela de
// papel mínimo que o servidor impõe (supabase/functions/_shared/instanceRoles.ts) — importada, não
// copiada, pra a UI nunca prometer um botão que o servidor nega com 403 (G29).
// Pure logic — sem React, sem supabase.
//
// Regra do papel ainda DESCONHECIDO (carregando / sem membership): nunca presume admin
// (mesmo princípio de `useWorkspaceRole().isAdmin`), mas também não esconde leitura/escrita
// operacional — o servidor decide de qualquer forma e isso evita piscar a tela.
import { isAdminRole } from "../../../supabase/functions/_shared/assignmentPermission";
import { decideInstanceAction, minRoleOf } from "../../../supabase/functions/_shared/instanceRoles";

/** Esta ação de `whatsapp-instance` está liberada para `role`? (papel desconhecido: só o que não é de admin) */
export function canDo(action: string, role: string | null | undefined): boolean {
  const min = minRoleOf(action);
  if (min === null) return true;
  if (typeof role !== "string") return min !== "admin";
  return decideInstanceAction(action, role).allow;
}

export interface WhatsAppPermissions {
  /** Administrar a instância (conectar, desconectar, apagar, importar token, webhook): owner/admin. */
  canManageInstance: boolean;
  /** Escritas operacionais (enviar, apagar mensagem, arquivar, tags, sincronizar...): owner/admin/member. `false` = somente leitura. */
  canWrite: boolean;
  /** Devolver ao robô: quem atende. */
  canReturn: boolean;
  /** Controle de atribuição do painel (Select + remover): owner/admin (member só se atribui ao responder — G102). */
  canAssign: boolean;
}

export function whatsappPermissions(role: string | null | undefined): WhatsAppPermissions {
  return {
    canManageInstance: canDo("delete", role),
    canWrite: canDo("send", role),
    canReturn: canDo("end_human_handover", role),
    canAssign: isAdminRole(role),
  };
}

export const READ_ONLY_COMPOSER_MESSAGE = "Somente leitura — seu papel no workspace não permite enviar mensagens.";
export const ADMIN_ONLY_INSTANCE_MESSAGE =
  "Somente administradores (owner/admin) gerenciam a conexão do WhatsApp — conectar, desconectar, importar ou apagar a instância.";
