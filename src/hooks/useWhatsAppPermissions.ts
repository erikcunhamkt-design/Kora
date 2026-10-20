// Etapa 9 · Item 4 (G103) — permissões de UI do WhatsApp por papel. Um lugar só (como useWorkspaceRole):
// as telas consomem `canWrite` / `canManageInstance` / `canAssign` / `canReturn` e nunca reinventam a
// checagem. Derivado da tabela de papel mínimo do servidor (src/lib/whatsapp/permissions.ts).
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { whatsappPermissions, type WhatsAppPermissions } from "@/lib/whatsapp/permissions";

export function useWhatsAppPermissions(): WhatsAppPermissions & { role: string | null; loading: boolean } {
  const { role, loading } = useWorkspaceRole();
  return { ...whatsappPermissions(role), role, loading };
}
