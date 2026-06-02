import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConnectionCard } from "@/components/automacoes/WhatsAppConnectionCard";

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export function WhatsAppSection() {
  const { workspace } = useCurrentWorkspace();
  const { instance, loading: loadingInstance, busy, connect, disconnect, removeInstance, refreshStatus, importInstance } = useWhatsAppInstance();
  const { conversations, messages, selectedId, setSelectedId, loading: loadingConv, markRead } = useWhatsAppConversations(
    workspace?.id,
    instance?.id,
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const status = instance?.status ?? "disconnected";
  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  useEffect(() => {
    if (selectedId) void markRead(selectedId);
  }, [selectedId, markRead]);

  const handleSync = async () => {
    if (!workspace) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "sync", workspaceId: workspace.id },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(`Sincronizado: ${(data as { synced: number }).synced} conversas`);
    } catch (e) {
      toast.error("Falha ao sincronizar", { description: (e as Error).message });
    } finally { setSyncing(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedId || !workspace) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "send", workspaceId: workspace.id, conversationId: selectedId, text },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    } catch (e) {
      toast.error("Falha ao enviar", { description: (e as Error).message });
      setInput(text);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <WhatsAppConnectionCard
        instance={instance}
        loading={loadingInstance}
        busy={busy}
        syncing={syncing}
        showSync
        connect={connect}
        disconnect={disconnect}
        removeInstance={removeInstance}
        refreshStatus={refreshStatus}
        importInstance={importInstance}
        onSync={handleSync}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Conversas</h2>
        {conversations.length > 0 && (
          <span className="text-xs text-muted-foreground">{conversations.length} conversa(s)</span>
        )}
      </div>

      <Card className="grid md:grid-cols-[280px_1fr] overflow-hidden min-h-[400px]">
        <div className="border-r border-border/40 overflow-y-auto max-h-[500px]">
          {loadingConv && (
            <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </div>
          )}
          {!loadingConv && conversations.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              {status === "connected"
                ? "Nenhuma conversa ainda. Clique em 'Sincronizar conversas' ou envie/receba uma mensagem."
                : "Conecte o WhatsApp para ver as conversas."}
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 border-b border-border/40 hover:bg-muted/30 transition-colors ${selectedId === c.id ? "bg-muted/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{c.contact_name ?? c.contact_phone}</span>
                {c.unread_count > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">{c.unread_count}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.last_message ?? "—"}</p>
              <div className="flex items-center justify-between gap-1 mt-1">
                <Badge variant="secondary" className="text-[9px]">{c.status}</Badge>
                <span className="text-[10px] text-muted-foreground">{formatTime(c.last_message_at)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          {selected ? (
            <>
              <div className="p-3 border-b border-border/40">
                <p className="font-medium text-sm">{selected.contact_name ?? selected.contact_phone}</p>
                <p className="text-xs text-muted-foreground">{selected.contact_phone}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px]">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Nenhuma mensagem nesta conversa ainda.</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] p-2 rounded-lg text-sm ${m.direction === "outbound" ? "ml-auto bg-primary/20" : "bg-muted/50"}`}
                  >
                    <div>{m.content ?? <span className="italic text-muted-foreground">[{m.type}]</span>}</div>
                    <div className="text-[10px] opacity-60 mt-1 text-right">{formatTime(m.created_at)}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 p-3 border-t border-border/40">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={status === "connected" ? "Mensagem..." : "Conecte para enviar"}
                  disabled={status !== "connected" || sending}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend} disabled={sending || status !== "connected" || !input.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <MessageCircle className="h-5 w-5 mr-2" /> Selecione uma conversa
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
