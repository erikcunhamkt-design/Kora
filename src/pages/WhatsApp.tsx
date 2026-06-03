import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  Layers,
  Loader2,
  MessageCircle,
  MoreVertical,
  PanelRightClose,
  PanelRightOpen,
  Bot,
  Plug,
  Rows3,
  RotateCw,
  Search,
  Send,
  Smartphone,
  Users,
  X,
  Archive,
  ArchiveRestore,
  MailOpen,
  UserCheck,
  Tag,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
import { WhatsAppBotConfig } from "@/components/whatsapp/WhatsAppBotConfig";
import { BotRulesPanel } from "@/components/whatsapp/bot/BotRulesPanel";
import { AudiencesBackendPage } from "@/components/whatsapp/audiences/AudiencesBackendPage";
import { TemplatesBackendPage } from "@/components/whatsapp/templates/TemplatesBackendPage";
import { CampaignsBackendPage } from "@/components/whatsapp/campaigns/CampaignsBackendPage";

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

type Filter = "all" | "unread" | "awaiting" | "open" | "resolved";

const SLA_MINUTES = 120;


export default function WhatsAppPage() {
  const { workspace } = useCurrentWorkspace();
  const { instance, loading: loadingInstance } = useWhatsAppInstance();
  const { conversations, messages, selectedId, setSelectedId, loading, markRead } =
    useWhatsAppConversations(workspace?.id, instance?.id);

  type MainTab = "chat" | "audiences" | "campaigns" | "templates" | "bot";
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("chat");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [contextSheetOpen, setContextSheetOpen] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // ---- Phase 3: in-conversation search ----
  const [searchOpen, setSearchOpen] = useState(false);
  const [msgQuery, setMsgQuery] = useState("");

  // ---- Phase 3: reply context ----
  const [replyTo, setReplyTo] = useState<{
    id: string; content: string | null; direction: string; type: string | null;
  } | null>(null);

  // ---- Phase 3: message density ----
  type Density = "compact" | "normal" | "comfortable";
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "normal";
    return (localStorage.getItem("wa:density") as Density) || "normal";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("wa:density", density);
  }, [density]);
  const densityCfg = {
    compact:     { gap: "space-y-1",   px: "px-3 md:px-4", py: "py-2 md:py-3" },
    normal:      { gap: "space-y-2.5", px: "px-3 md:px-6", py: "py-4 md:py-5" },
    comfortable: { gap: "space-y-4",   px: "px-4 md:px-8", py: "py-6 md:py-7" },
  }[density];

  // Reset in-chat search/reply when changing conversation
  useEffect(() => {
    setSearchOpen(false);
    setMsgQuery("");
    setReplyTo(null);
    setForwardOpen(false);
    setForwardMessageId(null);
  }, [selectedId]);

  // Scroll to bottom when opening a chat or when messages change
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [selectedId, messages.length]);

  // ---- Phase 4: forward message ----
  const [forwardOpen, setForwardOpen] = useState(false);
  const [forwardMessageId, setForwardMessageId] = useState<string | null>(null);
  const [forwardTargetId, setForwardTargetId] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);

  // ---- Phase 4: sound notifications ----
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("wa:sound") !== "false";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("wa:sound", String(soundEnabled));
  }, [soundEnabled]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play notification sound on new inbound messages
  useEffect(() => {
    if (!soundEnabled) return;
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.direction === "inbound") {
      if (!audioRef.current) {
        audioRef.current = new Audio("/notification.mp3");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => { /* ignore autoplay policy */ });
    }
  }, [messages, soundEnabled]);


  const status = instance?.status ?? "disconnected";
  const selected = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === "unread")   list = list.filter((c) => c.unread_count > 0);
    if (filter === "awaiting") {
      const cutoff = Date.now() - SLA_MINUTES * 60_000;
      list = list.filter(
        (c) =>
          c.unread_count > 0 &&
          c.last_message_at != null &&
          new Date(c.last_message_at).getTime() < cutoff,
      );
    }
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
  const awaitingCount = useMemo(() => {
    const cutoff = Date.now() - SLA_MINUTES * 60_000;
    return conversations.filter(
      (c) =>
        c.unread_count > 0 &&
        c.last_message_at != null &&
        new Date(c.last_message_at).getTime() < cutoff,
    ).length;
  }, [conversations]);


  useEffect(() => {
    if (selectedId) void markRead(selectedId);
  }, [selectedId, markRead]);

  // Auto-sync once when instance is connected and we have zero conversations cached
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    if (loadingInstance || loading) return;
    if (!workspace || !instance) return;
    if (status !== "connected") return;
    if (conversations.length > 0) return;
    autoSyncedRef.current = true;
    void handleSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingInstance, loading, workspace, instance, status, conversations.length]);


  const refreshAvatars = async (force = false) => {
    if (!workspace) return;
    try {
      await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "refresh_avatars", workspaceId: workspace.id, limit: 300, force },
      });
    } catch { /* best-effort */ }
  };

  const handleSync = async (silent = false) => {
    if (!workspace) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "sync", workspaceId: workspace.id },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      if ((data as { needs_reconnect?: boolean })?.needs_reconnect) {
        if (!silent) toast.warning("Sessão WhatsApp expirou", { description: "Reconecte a instância para continuar." });
        return;
      }
      if (!silent) toast.success(`Sincronizado: ${(data as { synced: number }).synced} conversas`);
      void refreshAvatars(false);
    } catch (e) {
      if (!silent) toast.error("Falha ao sincronizar", { description: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  };

  // Background auto-sync every 30s while connected and tab visible (silent)
  useEffect(() => {
    if (!workspace || !instance || status !== "connected") return;
    const tick = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void handleSync(true);
    };
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, instance, status]);

  // Ensure uazapi webhook is (re)registered once per session when connected,
  // so inbound messages reach our webhook and trigger the bot reply.
  const webhookRegisteredRef = useRef(false);
  useEffect(() => {
    if (webhookRegisteredRef.current) return;
    if (!workspace || !instance || status !== "connected") return;
    webhookRegisteredRef.current = true;
    void supabase.functions
      .invoke("whatsapp-instance", { body: { action: "set_webhook", workspaceId: workspace.id } })
      .catch(() => { webhookRegisteredRef.current = false; });
  }, [workspace, instance, status]);

  // Backfill avatars for already-cached conversations once on mount
  const avatarsRefreshedRef = useRef(false);
  useEffect(() => {
    if (avatarsRefreshedRef.current) return;
    if (!workspace || status !== "connected") return;
    if (conversations.length === 0) return;
    const missing = conversations.some((c) => !c.avatar_url);
    if (!missing) return;
    avatarsRefreshedRef.current = true;
    void refreshAvatars(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace, status, conversations.length]);

  const handleSend = async (text: string) => {
    if (!text.trim() || !selectedId || !workspace) return;
    setSending(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: {
          action: "send",
          workspaceId: workspace.id,
          conversationId: selectedId,
          text,
          senderId: userData.user?.id,
          replyMessageId: replyTo?.id ?? null,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setReplyTo(null);
    } catch (e) {
      toast.error("Falha ao enviar", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };


  const handleSendMedia = async (payload: {
    kind: "image" | "video" | "audio" | "document" | "sticker";
    base64: string;
    mimeType: string;
    fileName?: string;
    caption?: string;
  }) => {
    if (!selectedId || !workspace) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: {
          action: "send_media",
          workspaceId: workspace.id,
          conversationId: selectedId,
          ...payload,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Enviado");
    } catch (e) {
      toast.error("Falha ao enviar mídia", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  const handleSendStickerUrl = async (stickerUrl: string, mimeType?: string | null) => {
    if (!selectedId || !workspace) return;
    setSending(true);
    try {
      // Download sticker and re-send as base64 (uazapi /send/sticker expects file)
      const res = await fetch(stickerUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onerror = () => reject(reader.error);
        reader.onload = () => {
          const r = String(reader.result ?? "");
          const i = r.indexOf(",");
          resolve(i >= 0 ? r.slice(i + 1) : r);
        };
        reader.readAsDataURL(blob);
      });
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: {
          action: "send_media",
          workspaceId: workspace.id,
          conversationId: selectedId,
          kind: "sticker",
          base64,
          mimeType: mimeType ?? blob.type ?? "image/webp",
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    } catch (e) {
      toast.error("Falha ao enviar figurinha", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  // ---- Phase 4: conversation actions ----
  const handleArchive = async (conversationId: string, archived: boolean) => {
    if (!workspace) return;
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "archive_conversation", workspaceId: workspace.id, conversationId, archived },
      });
      if (error) throw error;
      toast.success(archived ? "Conversa arquivada" : "Conversa desarquivada");
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const handleMarkUnread = async (conversationId: string, unread: boolean) => {
    if (!workspace) return;
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "mark_unread", workspaceId: workspace.id, conversationId, unread },
      });
      if (error) throw error;
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const handleAssign = async (conversationId: string, userId: string | null) => {
    if (!workspace) return;
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "assign_conversation", workspaceId: workspace.id, conversationId, userId },
      });
      if (error) throw error;
      toast.success(userId ? "Conversa atribuída" : "Atribuição removida");
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const handleUpdateTags = async (conversationId: string, tags: string[]) => {
    if (!workspace) return;
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "update_conversation_tags", workspaceId: workspace.id, conversationId, tags },
      });
      if (error) throw error;
      toast.success("Tags atualizadas");
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    }
  };

  const handleForward = async () => {
    if (!forwardMessageId || !forwardTargetId || !workspace) return;
    setForwarding(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: {
          action: "forward_message",
          workspaceId: workspace.id,
          messageId: forwardMessageId,
          targetConversationId: forwardTargetId,
        },
      });
      if (error) throw error;
      toast.success("Mensagem encaminhada");
      setForwardOpen(false);
      setForwardMessageId(null);
      setForwardTargetId(null);
    } catch (e) {
      toast.error("Falha ao encaminhar", { description: (e as Error).message });
    } finally {
      setForwarding(false);
    }
  };

  // Group messages by day for separators (+ in-conversation search filter)
  const visibleMessages = useMemo(() => {
    const q = msgQuery.trim().toLowerCase();
    if (!q) return messages;
    return messages.filter((m) => (m.content ?? "").toLowerCase().includes(q));
  }, [messages, msgQuery]);

  const grouped = useMemo(() => {
    const out: Array<{ kind: "day"; label: string } | { kind: "msg"; msg: typeof messages[number] }> = [];
    let lastDay = "";
    for (const m of visibleMessages) {
      const lbl = dayLabel(m.created_at);
      if (lbl !== lastDay) {
        out.push({ kind: "day", label: lbl });
        lastDay = lbl;
      }
      out.push({ kind: "msg", msg: m });
    }
    return out;
  }, [visibleMessages]);

  if (loadingInstance) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando conexão do WhatsApp...
      </div>
    );
  }

  // ---- Sem instância conectada ----
  if (!instance || status !== "connected") {
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
    <div className="flex h-[calc(100vh-8rem)] -mx-6 -my-6 border-t border-border/40 bg-background flex-col">
      {/* Top navigation tabs */}
      <div className="flex items-center justify-between border-b border-border/40 px-6 py-2.5 bg-card/20 flex-shrink-0">
        <Tabs value={activeMainTab} onValueChange={(v) => setActiveMainTab(v as MainTab)}>
          <TabsList className="bg-background/40 p-0.5 flex-wrap h-auto">
            <TabsTrigger value="chat" className="text-xs h-8 gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Inbox
            </TabsTrigger>
            <TabsTrigger value="audiences" className="text-xs h-8 gap-1.5">
              <Users className="h-3.5 w-3.5" /> Audiências
            </TabsTrigger>
            <TabsTrigger value="templates" className="text-xs h-8 gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Modelos de Mensagem
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="text-xs h-8 gap-1.5">
              <Send className="h-3.5 w-3.5" /> Campanhas
            </TabsTrigger>
            <TabsTrigger value="bot" className="text-xs h-8 gap-1.5">
              <Bot className="h-3.5 w-3.5" /> Robô IA
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-[11px] text-muted-foreground hidden sm:inline">
          Workspace ativo · <strong>{workspace?.name}</strong>
        </span>
      </div>

      {/* Main Tab content container */}
      <div className="flex-1 flex overflow-hidden">
        {activeMainTab === "chat" && (
          <div className="flex flex-1 overflow-hidden w-full">
            {/* ============ Sidebar de conversas ============ */}
            <aside
              className={cn(
                "flex-shrink-0 border-r border-border/40 bg-card/30 flex-col",
                // widths
                "w-full md:w-[340px] lg:w-[380px] xl:w-[400px]",
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
                  <Badge variant="outline" className="h-7 px-2 text-[10px] gap-1 flex-shrink-0">
                    {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCw className="h-3 w-3" />}
                    Tempo real
                  </Badge>
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
                  <TabsList className="grid grid-cols-5 h-8 bg-background/40 p-0.5">
                    <TabsTrigger value="all" className="text-[11px] h-7">Todas</TabsTrigger>
                    <TabsTrigger value="unread" className="text-[11px] h-7">
                      Não lidas{unreadCount > 0 && <span className="ml-1 text-primary">{unreadCount}</span>}
                    </TabsTrigger>
                    <TabsTrigger value="awaiting" className="text-[11px] h-7 px-1" title={`Sem resposta há mais de ${SLA_MINUTES} min`}>
                      Atrasadas{awaitingCount > 0 && <span className="ml-1 text-destructive">{awaitingCount}</span>}
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
                  <div className="p-8 text-center space-y-3">
                    <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {conversations.length === 0
                        ? (status === "connected"
                            ? "Sincronizando suas conversas em tempo real... Envie ou receba uma mensagem para começar."
                            : "Conecte o WhatsApp para ver suas conversas.")
                        : "Nenhum resultado para esses filtros."}
                    </p>
                    {conversations.length === 0 && status === "connected" && (
                      <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Atualizando automaticamente
                      </div>
                    )}
                  </div>
                )}

                <div className="py-1">
                  {filtered.map((c) => (
                    <WhatsAppConversationItem
                      key={c.id}
                      conversation={c}
                      active={selectedId === c.id}
                      onClick={() => setSelectedId(c.id)}
                      showWaitingTime={filter === "awaiting"}
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
                      <Button
                        size="icon"
                        variant={searchOpen ? "secondary" : "ghost"}
                        className="h-8 w-8 hidden sm:inline-flex"
                        title="Buscar na conversa"
                        onClick={() => {
                          setSearchOpen((s) => !s);
                          if (searchOpen) setMsgQuery("");
                        }}
                      >
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Mais opções">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuLabel className="flex items-center gap-2 text-xs">
                            <Rows3 className="h-3.5 w-3.5" /> Densidade das mensagens
                          </DropdownMenuLabel>
                          {(["compact", "normal", "comfortable"] as const).map((d) => (
                            <DropdownMenuItem
                              key={d}
                              onClick={() => setDensity(d)}
                              className="text-xs justify-between"
                            >
                              <span className="capitalize">
                                {d === "compact" ? "Compacta" : d === "normal" ? "Normal" : "Confortável"}
                              </span>
                              {density === d && <Check className="h-3.5 w-3.5 text-primary" />}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleArchive(selected.id, selected.status !== "archived")}
                            className="text-xs gap-2"
                          >
                            {selected.status === "archived" ? (
                              <><ArchiveRestore className="h-3.5 w-3.5" /> Desarquivar</>
                            ) : (
                              <><Archive className="h-3.5 w-3.5" /> Arquivar conversa</>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleMarkUnread(selected.id, true)}
                            className="text-xs gap-2"
                          >
                            <MailOpen className="h-3.5 w-3.5" /> Marcar como não lida
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setSoundEnabled((s) => !s)}
                            className="text-xs gap-2 justify-between"
                          >
                            <span className="flex items-center gap-2">
                              {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                              Som de notificação
                            </span>
                            {soundEnabled && <Check className="h-3.5 w-3.5 text-primary" />}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </header>

                  {/* In-conversation search bar */}
                  {searchOpen && (
                    <div className="px-4 md:px-5 py-2 border-b border-border/40 bg-card/20 flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          autoFocus
                          value={msgQuery}
                          onChange={(e) => setMsgQuery(e.target.value)}
                          placeholder="Buscar nesta conversa..."
                          className="pl-9 h-8 text-sm bg-background/60 border-border/50"
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setSearchOpen(false);
                              setMsgQuery("");
                            }
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {msgQuery.trim()
                          ? `${visibleMessages.length} resultado${visibleMessages.length === 1 ? "" : "s"}`
                          : `${messages.length} msgs`}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => {
                          setSearchOpen(false);
                          setMsgQuery("");
                        }}
                        title="Fechar busca"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Mensagens */}
                  <div ref={messagesContainerRef} className={cn("flex-1 overflow-y-auto", densityCfg.px, densityCfg.py, densityCfg.gap)}>
                    {messages.length === 0 && (
                      <div className="flex h-full items-center justify-center">
                        <WhatsAppEmptyState
                          icon={MessageCircle}
                          title="Sem mensagens ainda"
                          description="Quando esta conversa receber ou enviar mensagens, elas aparecerão aqui."
                        />
                      </div>
                    )}
                    {messages.length > 0 && grouped.length === 0 && msgQuery.trim() && (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-xs text-muted-foreground">
                          Nenhuma mensagem encontrada para "{msgQuery}".
                        </p>
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
                        <div key={item.msg.id} id={`wa-msg-${item.msg.id}`}>
                        <WhatsAppMessageBubble
                          id={item.msg.id}
                          direction={item.msg.direction}
                          type={item.msg.type}
                          content={item.msg.content}
                          mediaUrl={item.msg.media_url}
                          createdAt={item.msg.created_at}
                          status={item.msg.status}
                          senderId={item.msg.sender_id}
                          workspaceId={workspace?.id}
                          reactions={(item.msg as any).reactions ?? null}
                          pinnedAt={(item.msg as any).pinned_at ?? null}
                          deletedAt={(item.msg as any).deleted_at ?? null}
                          replyTo={(() => {
                            const rId = (item.msg as any).reply_to_message_id as string | null;
                            if (!rId) return null;
                            const r = messages.find((x) => x.id === rId);
                            return r ? { id: r.id, content: r.content, direction: r.direction, type: r.type } : null;
                          })()}
                          onReply={(m) => setReplyTo(m)}
                          onJumpTo={(mid) => {
                            const el = document.getElementById(`wa-msg-${mid}`);
                            el?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          onDelete={async (msgId) => {
                            try {
                              const { error } = await supabase.functions.invoke("whatsapp-instance", {
                                body: { action: "delete_message", workspaceId: workspace?.id, messageId: msgId },
                              });
                              if (error) throw error;
                              toast.success("Mensagem excluída");
                            } catch (e) {
                              toast.error("Falha ao excluir", { description: (e as Error).message });
                            }
                          }}
                          onForward={(msgId) => {
                            setForwardMessageId(msgId);
                            setForwardOpen(true);
                          }}
                        />
                        </div>

                      ),
                    )}
                  </div>



                  {/* Reply preview */}
                  {replyTo && (
                    <div className="px-4 md:px-5 py-2 border-t border-border/40 bg-card/30 flex items-start gap-2">
                      <div className="flex-1 min-w-0 border-l-2 border-primary pl-2">
                        <p className="text-[10px] font-semibold text-primary">
                          Respondendo a {replyTo.direction === "outbound" ? "você" : (selected.contact_name ?? "contato")}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {replyTo.content || `[${replyTo.type ?? "mídia"}]`}
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => setReplyTo(null)}
                        title="Cancelar resposta"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {/* Input */}
                  <WhatsAppChatInput
                    disabled={status !== "connected"}
                    sending={sending}
                    onSend={handleSend}
                    onSendMedia={handleSendMedia}
                    onSendStickerUrl={handleSendStickerUrl}
                    workspaceId={workspace?.id}
                    contactName={selected.contact_name}
                    contactPhone={selected.contact_phone}
                    placeholder={
                      status === "connected"
                        ? replyTo
                          ? "Escreva sua resposta..."
                          : `Mensagem para ${selected.contact_name ?? selected.contact_phone}...`
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
            {selected && showContext && workspace && (
              <div className="hidden xl:flex">
                <WhatsAppContactPanel
                  conversationId={selected.id}
                  workspaceId={workspace.id}
                  contactName={selected.contact_name}
                  contactPhone={selected.contact_phone}
                  status={selected.status}
                  tags={selected.tags}
                  assignedTo={(selected as any).assigned_to ?? null}
                  avatarUrl={selected.avatar_url}
                  lastActivity={selected.last_message_at}
                  clientId={(selected as any).client_id ?? null}
                  onClose={() => setShowContext(false)}
                  onAssign={(userId) => handleAssign(selected.id, userId)}
                  onUpdateTags={(tags) => handleUpdateTags(selected.id, tags)}
                />
              </div>
            )}

            {/* ============ Painel de contexto (tablet/mobile: drawer) ============ */}
            <Sheet open={contextSheetOpen} onOpenChange={setContextSheetOpen}>
              <SheetContent side="right" className="p-0 w-full sm:max-w-[340px] xl:hidden">
                {selected && workspace && (
                  <WhatsAppContactPanel
                    conversationId={selected.id}
                    workspaceId={workspace.id}
                    contactName={selected.contact_name}
                    contactPhone={selected.contact_phone}
                    status={selected.status}
                    tags={selected.tags}
                    assignedTo={(selected as any).assigned_to ?? null}
                    avatarUrl={selected.avatar_url}
                    lastActivity={selected.last_message_at}
                    clientId={(selected as any).client_id ?? null}
                    onClose={() => setContextSheetOpen(false)}
                    onAssign={(userId) => handleAssign(selected.id, userId)}
                    onUpdateTags={(tags) => handleUpdateTags(selected.id, tags)}
                  />
                )}
              </SheetContent>
            </Sheet>

          </div>
        )}

        {activeMainTab === "audiences" && (
          <div className="flex-1 overflow-hidden h-full bg-background/50">
            <AudiencesBackendPage />
          </div>
        )}

        {activeMainTab === "campaigns" && workspace && (
          <div className="flex-1 overflow-hidden h-full">
            <CampaignsBackendPage />
          </div>
        )}

        {activeMainTab === "templates" && (
          <div className="flex-1 overflow-hidden h-full bg-background/50">
            <TemplatesBackendPage />
          </div>
        )}

        {activeMainTab === "bot" && workspace && (
          <div className="flex-1 overflow-y-auto h-full bg-background/50">
            <WhatsAppBotConfig workspaceId={workspace.id} />
            <BotRulesPanel />
          </div>
        )}

        {/* Forward Dialog */}
        <Dialog open={forwardOpen} onOpenChange={setForwardOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm">Encaminhar mensagem</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">Selecione a conversa de destino:</p>
              <div className="max-h-64 overflow-y-auto space-y-1 border border-border/40 rounded-lg p-1">
                {conversations
                  .filter((c) => c.id !== selectedId)
                  .map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setForwardTargetId(c.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-md text-xs flex items-center gap-2 transition",
                        forwardTargetId === c.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50",
                      )}
                    >
                      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/25 to-primary/5 border border-border/40 text-primary flex items-center justify-center text-[10px] font-semibold flex-shrink-0 overflow-hidden">
                        {c.avatar_url ? (
                          <img src={c.avatar_url} alt={c.contact_name ?? c.contact_phone} className="h-full w-full object-cover" />
                        ) : (
                          (c.contact_name ?? c.contact_phone).slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{c.contact_name ?? c.contact_phone}</p>
                        <p className="text-[10px] text-muted-foreground">{c.contact_phone}</p>
                      </div>
                    </button>
                  ))}
                {conversations.filter((c) => c.id !== selectedId).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma outra conversa disponível.</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => { setForwardOpen(false); setForwardMessageId(null); setForwardTargetId(null); }}>
                Cancelar
              </Button>
              <Button size="sm" disabled={!forwardTargetId || forwarding} onClick={handleForward}>
                {forwarding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                Encaminhar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
