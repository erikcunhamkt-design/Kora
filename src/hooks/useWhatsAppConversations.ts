import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WAConversation = Database["public"]["Tables"]["whatsapp_conversations"]["Row"];
export type WAMessage = Database["public"]["Tables"]["whatsapp_messages"]["Row"];

export function useWhatsAppConversations(workspaceId: string | undefined, instanceId: string | undefined) {
  const [conversations, setConversations] = useState<WAConversation[]>([]);
  const [messages, setMessages] = useState<WAMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initial load + realtime subscription for conversations
  useEffect(() => {
    if (!workspaceId || !instanceId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("instance_id", instanceId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (cancelled) return;
      setConversations((data as WAConversation[]) ?? []);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`wa-conv-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", filter: `instance_id=eq.${instanceId}` },
        (payload) => {
          setConversations((prev) => {
            if (payload.eventType === "INSERT") {
              const next = [payload.new as WAConversation, ...prev.filter((c) => c.id !== (payload.new as WAConversation).id)];
              return next.sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
            }
            if (payload.eventType === "UPDATE") {
              return prev
                .map((c) => (c.id === (payload.new as WAConversation).id ? (payload.new as WAConversation) : c))
                .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((c) => c.id !== (payload.old as WAConversation).id);
            }
            return prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [workspaceId, instanceId]);

  // Load + subscribe to messages of selected conversation
  useEffect(() => {
    if (!selectedId || !workspaceId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", selectedId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      const list = (data as WAMessage[]) ?? [];
      setMessages(list);

      // If no messages cached yet, fetch history from uazapi
      if (list.length === 0) {
        try {
          await supabase.functions.invoke("whatsapp-instance", {
            body: { action: "load_messages", workspaceId, conversationId: selectedId, limit: 50 },
          });
          const { data: after } = await supabase
            .from("whatsapp_messages")
            .select("*")
            .eq("conversation_id", selectedId)
            .order("created_at", { ascending: true });
          if (!cancelled) setMessages((after as WAMessage[]) ?? []);
        } catch (_e) { /* ignore */ }
      }
    })();

    const channel = supabase
      .channel(`wa-msg-${selectedId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages", filter: `conversation_id=eq.${selectedId}` },
        (payload) => {
          setMessages((prev) => {
            const incoming = payload.new as WAMessage;
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [selectedId, workspaceId]);

  const markRead = useCallback(async (conversationId: string) => {
    await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", conversationId);
  }, []);

  return { conversations, messages, selectedId, setSelectedId, loading, markRead };
}
