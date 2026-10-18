// Etapa 9 · Item 4 (G101) — lista de ATENDENTES do workspace para o painel de contato.
// Pure logic — sem Deno.*, sem npm: imports.
//
// Por que existe no servidor: o navegador NÃO consegue montar essa lista. O embed que o
// painel tentava (`users:user_id(email, raw_user_meta_data)`) aponta pra uma relação que
// não existe — `workspace_members.user_id` referencia `public.profiles` — e a RLS de
// `profiles` só deixa cada um ler a PRÓPRIA linha. Então `whatsapp-instance` (service
// role, depois de verificar que o chamador é membro) lê `workspace_members` + `profiles`
// do PRÓPRIO workspace e devolve só o necessário: id, nome e papel (nunca o e-mail).
//
// A lista traz TODOS os membros (inclusive `viewer`) de propósito: o nome de quem está
// atribuído precisa resolver mesmo se o papel mudou. Quem pode ser ESCOLHIDO no Select é
// decidido por `isAssignableRole` (§3.5: owner/admin/member), nos dois lados.

export interface WorkspaceAttendant {
  id: string;
  name: string;
  role: string;
}

export const UNNAMED_ATTENDANT = "Sem nome";

function nameOf(profile: Record<string, unknown> | undefined): string {
  const display = typeof profile?.display_name === "string" ? profile.display_name.trim() : "";
  if (display) return display;
  // Sem display_name: a parte local do e-mail (nunca o e-mail inteiro — não sai do servidor).
  const email = typeof profile?.email === "string" ? profile.email.trim() : "";
  const local = email.includes("@") ? email.split("@")[0].trim() : "";
  return local || UNNAMED_ATTENDANT;
}

/**
 * `memberRows`: linhas de `workspace_members` (`user_id`, `role`);
 * `profileRows`: linhas de `profiles` (`user_id`, `display_name`, `email`).
 * Entrada ruim vira lista vazia / nome padrão, nunca lança. Ordem estável: nome
 * (pt-BR, sem caixa) e depois id.
 */
export function buildAttendants(memberRows: unknown, profileRows: unknown): WorkspaceAttendant[] {
  const profiles = new Map<string, Record<string, unknown>>();
  if (Array.isArray(profileRows)) {
    for (const p of profileRows) {
      if (p && typeof p === "object" && typeof (p as { user_id?: unknown }).user_id === "string") {
        profiles.set((p as { user_id: string }).user_id, p as Record<string, unknown>);
      }
    }
  }
  const out: WorkspaceAttendant[] = [];
  const seen = new Set<string>();
  if (Array.isArray(memberRows)) {
    for (const m of memberRows) {
      if (!m || typeof m !== "object") continue;
      const row = m as Record<string, unknown>;
      if (typeof row.user_id !== "string" || row.user_id.length === 0 || seen.has(row.user_id)) continue;
      seen.add(row.user_id);
      out.push({
        id: row.user_id,
        name: nameOf(profiles.get(row.user_id)),
        role: typeof row.role === "string" ? row.role : "",
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }) || a.id.localeCompare(b.id));
}
