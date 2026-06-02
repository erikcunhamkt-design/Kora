import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Plug,
  RotateCw,
  Search,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppMessageBubble } from "@/components/whatsapp/WhatsAppMessageBubble";
import { WhatsAppConversationItem } from "@/components/whatsapp/WhatsAppConversationItem";
import { WhatsAppStatusBadge } from "@/components/whatsapp/WhatsAppStatusBadge";
import { WhatsAppChatInput } from "@/components/whatsapp/WhatsAppChatInput";
import { WhatsAppContactPanel } from "@/components/whatsapp/WhatsAppContactPanel";
import { WhatsAppEmptyState } from "@/components/whatsapp/WhatsAppEmptyState";

function initials(name: string | null, phone: string) {
  const base = (name ?? phone).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date(); yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return "Hoje";
  if (same(d, yest)) return "Ontem";
  return d.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

type Filter = "all" | "unread" | "open" | "resolved";

export default function WhatsAppPage() {
  const { workspace } = useCurrentWorkspace();
  const { instance } = useWhatsAppInstance();
  const { conversations, messages, selectedId, setSelectedId, loading, markRead } =
    useWhatsAppConversations(workspace?.id, instance?.id);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [contextSheetOpen, setContextSheetOpen] = useState(false);

  const status = instance?.status ?? "disconnected";
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread")   list = list.filter((c) => c.unread_count > 0);
    if (filter === "open")     list = list.filter((c) => (c.status ?? "open") !== "resolved");
    if (filter === "resolved") list = list.filter((c) => c.status === "resolved");
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          (c.contact_name ?? "").toLowerCase().includes(q) ||
          c.contact_phone.toLowerCase().includes(q) ||
          (c.last_message ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [conversations, query, filter]);

  const unreadCount = conversations.reduce((acc, c) => acc + (c.unread_count > 0 ? 1 : 0), 0);

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

  const handleSend = async (text: string) => {
    if (!text.trim() || !selectedId || !workspace) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "send", workspaceId: workspace.id, conversationId: selectedId, text },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    } catch (e) {
      toast.error("Falha ao enviar", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  // Group messages by day for separators
  const grouped = useMemo(() => {
    const out: Array<{ kind: "day"; label: string } | { kind: "msg"; msg: typeof messages[number] }> = [];
    let lastDay = "";
    for (const m of messages) {
      const lbl = dayLabel(m.created_at);
      if (lbl !== lastDay) {
        out.push({ kind: "day", label: lbl });
        lastDay = lbl;
      }
      out.push({ kind: "msg", msg: m });
    }
    return out;
  }, [messages]);

  // ---- Sem instância conectada ----
  if (!instance) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <WhatsAppEmptyState
          icon={Smartphone}
          title="WhatsApp não conectado"
          description="Conecte sua conta do WhatsApp em Automações para começar a atender seus clientes em um inbox profissional."
          action={
            <Button asChild>
              <Link to="/automacoes?tab=integracoes">
                <Plug className="h-4 w-4" /> Conectar WhatsApp
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const showSidebar = !selected; // mobile: hide sidebar when conversation is open
  const showChat = !!selected;   // mobile: hide chat when no conversation

  return (
    <div className="flex h-[calc(100vh-8rem)] -mx-6 -my-6 border-t border-border/40 bg-background">
      {/* ============ Sidebar de conversas ============ */}
      <aside
        className={cn(
          "flex-shrink-0 border-r border-border/40 bg-card/30 flex-col",
          // widths
          "w-full md:w-[280px] lg:w-[320px] xl:w-[340px]",
          // mobile show/hide based on selection
          showSidebar ? "flex" : "hidden md:flex",
        )}
      >
        <div className="p-4 space-y-3 border-b border-border/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="font-semibold text-base leading-tight">Inbox WhatsApp</h1>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {status === "connected"
                  ? instance.phone_name ?? instance.phone ?? "Conectado"
                  : `Status: ${status}`}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleSync}
              disabled={syncing || status !== "connected"}
              title="Sincronizar"
              className="h-8 w-8 flex-shrink-0"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            </Button>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversa, telefone..."
              className="pl-9 h-9 text-sm bg-background/60 border-border/50"
            />
          </div>

          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList className="grid grid-cols-4 h-8 bg-background/40 p-0.5">
              <TabsTrigger value="all" className="text-[11px] h-7">Todas</TabsTrigger>
              <TabsTrigger value="unread" className="text-[11px] h-7">
                Não lidas{unreadCount > 0 && <span className="ml-1 text-primary">{unreadCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="open" className="text-[11px] h-7">Abertas</TabsTrigger>
              <TabsTrigger value="resolved" className="text-[11px] h-7">Resolvidas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando conversas...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="p-8 text-center">
              <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">
                {conversations.length === 0
                  ? "Nenhuma conversa ainda. Clique em sincronizar."
                  : "Nenhum resultado para esses filtros."}
              </p>
            </div>
          )}
          <div className="py-1">
            {filtered.map((c) => (
              <WhatsAppConversationItem
                key={c.id}
                conversation={c}
                active={selectedId === c.id}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>
        </div>
      </aside>

      {/* ============ Conversa central ============ */}
      <section
        className={cn(
          "flex-1 flex-col min-w-0 bg-gradient-to-b from-background to-background/60",
          showChat ? "flex" : "hidden md:flex",
        )}
      >
        {selected ? (
          <>
            {/* Header */}
            <header className="px-4 md:px-5 py-3 border-b border-border/40 flex items-center gap-2 md:gap-3 bg-card/30 backdrop-blur-sm">
              {/* Back button (mobile only) */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 md:hidden flex-shrink-0"
                onClick={() => setSelectedId(null)}
                title="Voltar"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              <div className="h-9 w-9 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-primary/25 to-primary/5 border border-border/40 text-primary flex items-center justify-center text-xs font-semibold overflow-hidden flex-shrink-0">
                {selected.avatar_url ? (
                  <img
                    src={selected.avatar_url}
                    alt={selected.contact_name ?? selected.contact_phone}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials(selected.contact_name, selected.contact_phone)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm truncate">
                    {selected.contact_name ?? selected.contact_phone}
                  </p>
                  <WhatsAppStatusBadge status={selected.status} size="xs" />
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  {selected.contact_phone}
                  {selected.last_message_at && (
                    <span className="hidden sm:inline"> · última atividade {new Date(selected.last_message_at).toLocaleString()}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <Button size="icon" variant="ghost" className="h-8 w-8 hidden sm:inline-flex" title="Buscar na conversa" disabled>
                  <Search className="h-4 w-4" />
                </Button>
                {/* Desktop toggle: inline panel */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 hidden xl:inline-flex"
                  title={showContext ? "Ocultar painel" : "Mostrar painel"}
                  onClick={() => setShowContext((s) => !s)}
                >
                  {showContext
                    ? <PanelRightClose className="h-4 w-4" />
                    : <PanelRightOpen className="h-4 w-4" />}
                </Button>
                {/* Tablet/mobile toggle: drawer */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 xl:hidden"
                  title="Detalhes do contato"
                  onClick={() => setContextSheetOpen(true)}
                >
                  <PanelRightOpen className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" title="Mais" disabled>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </div>
            </header>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-5 space-y-2.5">
              {messages.length === 0 && (
                <div className="flex h-full items-center justify-center">
                  <WhatsAppEmptyState
                    icon={MessageCircle}
                    title="Sem mensagens ainda"
                    description="Quando esta conversa receber ou enviar mensagens, elas aparecerão aqui."
                  />
                </div>
              )}
              {grouped.map((item, idx) =>
                item.kind === "day" ? (
                  <div key={`d-${idx}`} className="flex items-center justify-center my-3">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-card/60 border border-border/40 rounded-full px-2.5 py-0.5">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <WhatsAppMessageBubble
                    key={item.msg.id}
                    direction={item.msg.direction}
                    type={item.msg.type}
                    content={item.msg.content}
                    mediaUrl={item.msg.media_url}
                    createdAt={item.msg.created_at}
                    status={item.msg.status}
                  />
                ),
              )}
            </div>

            {/* Input */}
            <WhatsAppChatInput
              disabled={status !== "connected"}
              sending={sending}
              onSend={handleSend}
              placeholder={
                status === "connected"
                  ? `Mensagem para ${selected.contact_name ?? selected.contact_phone}...`
                  : "Conecte o WhatsApp para enviar"
              }
            />
          </>
        ) : (
          <WhatsAppEmptyState
            icon={MessageCircle}
            title="Selecione uma conversa"
            description="Escolha um contato na lista à esquerda para visualizar o histórico e responder."
          />
        )}
      </section>

      {/* ============ Painel de contexto (desktop xl: inline) ============ */}
      {selected && showContext && (
        <div className="hidden xl:flex">
          <WhatsAppContactPanel
            contactName={selected.contact_name}
            contactPhone={selected.contact_phone}
            status={selected.status}
            tags={selected.tags}
            avatarUrl={selected.avatar_url}
            lastActivity={selected.last_message_at}
            onClose={() => setShowContext(false)}
          />
        </div>
      )}

      {/* ============ Painel de contexto (tablet/mobile: drawer) ============ */}
      <Sheet open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
        <SheetContent side="right" className="p-0 w-full sm:max-w-[340px] xl:hidden">
          {selected && (
            <WhatsAppContactPanel
              contactName={selected.contact_name}
              contactPhone={selected.contact_phone}
              status={selected.status}
              tags={selected.tags}
              avatarUrl={selected.avatar_url}
              lastActivity={selected.last_message_at}
              onClose={() => setContextSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
