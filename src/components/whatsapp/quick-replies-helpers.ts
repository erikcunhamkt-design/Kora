import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
}

export function renderQuickReply(
  content: string,
  vars: { nome?: string | null; telefone?: string | null },
) {
  return content
    .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome ?? "")
    .replace(/\{\{\s*telefone\s*\}\}/gi, vars.telefone ?? "");
}

export function useQuickReplies(workspaceId?: string) {
  const [items, setItems] = useState<QuickReply[]>([]);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    supabase
      .from("whatsapp_quick_replies")
      .select("id, shortcut, content")
      .eq("workspace_id", workspaceId)
      .order("shortcut")
      .then(({ data }) => {
        if (active) setItems((data ?? []) as QuickReply[]);
      });
    return () => {
      active = false;
    };
  }, [workspaceId]);

  const reload = async () => {
    if (!workspaceId) return;
    const { data } = await supabase
      .from("whatsapp_quick_replies")
      .select("id, shortcut, content")
      .eq("workspace_id", workspaceId)
      .order("shortcut");
    setItems((data ?? []) as QuickReply[]);
  };

  return { items, reload, setItems };
}
