import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Plug, RotateCw, Search, Send, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function initials(name: string | null, phone: string) {
  const base = (name ?? phone).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function WhatsAppPage() {
  const { workspace } = useCurrentWorkspace();
  const { instance } = useWhatsAppInstance();
  const { conversations, messages, selectedId, setSelectedId, loading, markRead } = useWhatsAppConversations(
    workspace?.id,
    instance?.id,
  );

  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const status = instance?.status ?? "disconnected";
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        (c.contact_name ?? "").toLowerCase().includes(q) ||
        c.contact_phone.toLowerCase().includes(q) ||
        (c.last_message ?? "").toLowerCase().includes(q),
    );
  }, [conversations, query]);

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
    } finally {
      setSyncing(false);
    }
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
    } finally {
      setSending(false);
    }
  };

  if (!instance) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center max-w-sm space-y-4">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Smartphone className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">WhatsApp não conectado</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Conecte sua conta do WhatsApp em Automações para começar a conversar.
            </p>
          </div>
          <Button asChild>
            <Link to="/automacoes?tab=integracoes">
              <Plug className="h-4 w-4" /> Conectar WhatsApp
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] -mx-6 -my-6 border-t border-border/40">
      {/* Sidebar de conversas */}
      <aside className="w-[320px] flex-shrink-0 border-r border-border/40 bg-card/30 flex flex-col">
        <div className="p-4 border-b border-border/40 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-base">Conversas</h1>
              <p className="text-[11px] text-muted-foreground">
                {status === "connected" ? instance.phone_name ?? instance.phone ?? "Conectado" : status}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSync}
              disabled={syncing || status !== "connected"}
              title="Sincronizar conversas"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            </Button>
          </div>
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-6 text-xs text-muted-foreground text-center">
              {conversations.length === 0
                ? "Nenhuma conversa ainda. Clique no botão de sincronizar."
                : "Nenhum resultado para a busca."}
            </div>
          )}
          {filtered.map((c) => {
            const active = selectedId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-3 py-3 border-b border-border/30 transition-colors flex gap-3 ${
                  active ? "bg-card-elevated" : "hover:bg-muted/30"
                }`}
              >
                <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
                  {initials(c.contact_name, c.contact_phone)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">
                      {c.contact_name ?? c.contact_phone}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatTime(c.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground truncate flex-1">
                      {c.last_message ?? "—"}
                    </p>
                    {c.unread_count > 0 && (
                      <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px] flex-shrink-0">
                        {c.unread_count}
                      </Badge>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Painel da conversa */}
      <section className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <header className="px-5 py-3 border-b border-border/40 flex items-center gap-3 bg-card/20">
              <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
                {initials(selected.contact_name, selected.contact_phone)}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {selected.contact_name ?? selected.contact_phone}
                </p>
                <p className="text-[11px] text-muted-foreground">{selected.contact_phone}</p>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2 bg-background">
              {messages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-10">
                  Nenhuma mensagem nesta conversa ainda.
                </p>
              )}
              {messages.map((m) => {
                const outbound = m.direction === "outbound";
                return (
                  <div
                    key={m.id}
                    className={`max-w-[65%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      outbound
                        ? "ml-auto bg-primary/20 text-foreground rounded-br-sm"
                        : "bg-card-elevated text-foreground rounded-bl-sm"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {m.content ?? <span className="italic text-muted-foreground">[{m.type}]</span>}
                    </div>
                    <div className="text-[10px] opacity-60 mt-1 text-right">
                      {formatTime(m.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-5 py-3 border-t border-border/40 bg-card/20 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={status === "connected" ? "Mensagem..." : "Conecte para enviar"}
                disabled={status !== "connected" || sending}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                className="h-10"
              />
              <Button
                onClick={handleSend}
                disabled={sending || status !== "connected" || !input.trim()}
                className="h-10 px-4"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Selecione uma conversa para começar</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
