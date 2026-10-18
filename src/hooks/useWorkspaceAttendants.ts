// Etapa 9 · Item 4 (G101) — atendentes do workspace pro painel de contato do WhatsApp e pra
// resolver o NOME de quem está atribuído (banner/aviso). Uma busca por workspace, via a ação
// `list_attendants` de whatsapp-instance (o navegador não monta essa lista: RLS de profiles —
// ver supabase/functions/_shared/workspaceAttendants.ts). Falha => lista vazia, a página segue.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAttendants, type WorkspaceAttendant } from "@/lib/whatsapp/assignment";

export function useWorkspaceAttendants(workspaceId: string | null | undefined) {
  const [attendants, setAttendants] = useState<WorkspaceAttendant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!workspaceId) {
      setAttendants([]);
      return;
    }
    let active = true;
    setLoading(true);
    listAttendants((name, options) => supabase.functions.invoke(name, options), workspaceId).then((list) => {
      if (!active) return;
      setAttendants(list);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  return { attendants, loading };
}
