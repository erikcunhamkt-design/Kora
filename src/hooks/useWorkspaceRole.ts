// G71 — adendo de backlog de UI (kora-hub-auditoria-e-plano.md). Hook único
// e reusável pro papel do usuário no workspace atual — extrai o dado que
// useCurrentWorkspace() já busca (membership.role) sem nenhuma tela
// reinventar a própria checagem, mesmo precedente de useCurrentWorkspace.ts/
// useBifurcatedTasks.ts (lógica compartilhada extraída uma vez, N
// consumidores).
//
// isAdmin espelha 1:1 a função is_workspace_admin(w_id) do lado servidor
// (supabase/migrations/20260603174051_..., role IN ('owner','admin')) —
// mesma coluna (workspace_members.role), mesmo vocabulário de 2 valores.
// Self-contido: chama useCurrentWorkspace() internamente, nenhum
// componente precisa passar workspace/membership como prop.
import { useCurrentWorkspace, type WorkspaceMember } from "@/hooks/useCurrentWorkspace";

export type WorkspaceRole = WorkspaceMember["role"];

export interface WorkspaceRoleState {
  role: WorkspaceRole | null;
  /** false enquanto `loading` é true — nunca assume admin antes de saber. */
  isAdmin: boolean;
  loading: boolean;
}

export function useWorkspaceRole(): WorkspaceRoleState {
  const { membership, loading } = useCurrentWorkspace();
  const role = membership?.role ?? null;
  const isAdmin = role === "owner" || role === "admin";
  return { role, isAdmin, loading };
}
