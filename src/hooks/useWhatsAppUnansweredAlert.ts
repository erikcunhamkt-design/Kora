import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSoundPreferences } from "@/hooks/useSoundPreferences";
import { playKoraSound } from "@/lib/sound/soundManager";

/**
 * Verifica periodicamente se existe alguma conversa do WhatsApp com mensagens
 * não lidas (`unread_count > 0`) cuja última mensagem é mais antiga que o
 * limite configurado pelo usuário. Caso exista, dispara o som de alerta em
 * loop (no intervalo configurado) até que o usuário abra a(s) conversa(s) —
 * o que zera `unread_count` via `markRead`.
 */
export function useWhatsAppUnansweredAlert() {
  const { workspace } = useCurrentWorkspace();
  const { prefs } = useSoundPreferences();
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (!workspace?.id) return;
    if (!prefs.enabled) return;
    if (!prefs.modules.whatsapp) return;
    if (!prefs.unansweredAlert.enabled) return;

    const thresholdMs = Math.max(1, prefs.unansweredAlert.thresholdMinutes) * 60_000;
    const intervalMs = Math.max(5, prefs.unansweredAlert.repeatSeconds) * 1000;

    let cancelled = false;

    const check = async () => {
      try {
        const cutoffIso = new Date(Date.now() - thresholdMs).toISOString();
        const { data, error } = await supabase
          .from("whatsapp_conversations")
          .select("id, unread_count, last_message_at")
          .eq("workspace_id", workspace.id)
          .gt("unread_count", 0)
          .lte("last_message_at", cutoffIso)
          .limit(1);
        if (cancelled) return;
        if (error) return;
        if (data && data.length > 0) {
          // skipThrottle para tocar a cada intervalo definido pelo usuário
          playKoraSound("whatsapp:unanswered_alert", { skipThrottle: true });
        }
      } catch {
        /* silencioso */
      }
    };

    void check();
    tickRef.current = window.setInterval(check, intervalMs);

    return () => {
      cancelled = true;
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [
    workspace?.id,
    prefs.enabled,
    prefs.modules.whatsapp,
    prefs.unansweredAlert.enabled,
    prefs.unansweredAlert.thresholdMinutes,
    prefs.unansweredAlert.repeatSeconds,
  ]);
}
