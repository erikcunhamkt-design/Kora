import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Archive,
  ArchiveRestore,
  Inbox,
  MoreHorizontal,
  ShoppingBag,
  Wallet,
  ListChecks,
  Settings as SettingsIcon,
  LifeBuoy,
  ChevronRight,
  Trash2,
} from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useNotificationsCenter,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationType,
} from "@/hooks/useNotificationsCenter";
import type { AppNotification } from "@/hooks/useNotificationsCenter";
import { cn } from "@/lib/utils";

interface NotificationInboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Filter = "all" | "unread" | "important" | "archived";

const CATEGORY_META: Record<NotificationCategory, { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string; bg: string }> = {
  commercial: { label: "Comercial", Icon: ShoppingBag, tone: "text-primary/80", bg: "bg-primary/5" },
  finance: { label: "Financeiro", Icon: Wallet, tone: "text-emerald-500/80", bg: "bg-emerald-500/5" },
  project: { label: "Projetos", Icon: ListChecks, tone: "text-sky-400/80", bg: "bg-sky-400/5" },
  system: { label: "Sistema", Icon: SettingsIcon, tone: "text-muted-foreground/70", bg: "bg-muted/30" },
  support: { label: "Suporte", Icon: LifeBuoy, tone: "text-amber-400/80", bg: "bg-amber-400/5" },
};

const PRIORITY_BADGE: Record<NotificationPriority, string> = {
  low: "border-border/40 text-muted-foreground/60",
  medium: "border-border/50 text-muted-foreground/80",
  high: "border-primary/25 text-primary/80 bg-primary/[0.04]",
  critical: "border-destructive/30 text-destructive/90 bg-destructive/[0.06]",
};

const PRIORITY_LABEL: Record<NotificationPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  critical: "Crítica",
};

const TYPE_DOT: Record<NotificationType, string> = {
  info: "bg-sky-400/80",
  success: "bg-emerald-400/80",
  warning: "bg-amber-400/80",
  danger: "bg-primary/80",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function groupOf(iso: string): "today" | "week" | "old" {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = diff / 3_600_000;
  if (hours < 24) return "today";
  if (hours < 24 * 7) return "week";
  return "old";
}

const GROUP_LABEL = { today: "Hoje", week: "Esta semana", old: "Antigas" } as const;

export function NotificationInbox({ open, onOpenChange }: NotificationInboxProps) {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markRead,
    markUnread,
    markAllRead,
    archive,
    unarchive,
    clearArchived,
  } = useNotificationsCenter();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      if (filter === "archived") return n.archived;
      if (n.archived) return false;
      if (filter === "unread") return !n.read;
      if (filter === "important") return n.priority === "high" || n.priority === "critical";
      return true;
    });
  }, [notifications, filter]);

  const grouped = useMemo(() => {
    const g: Record<"today" | "week" | "old", AppNotification[]> = { today: [], week: [], old: [] };
    for (const n of filtered) g[groupOf(n.createdAt)].push(n);
    return g;
  }, [filtered]);

  const archivedCount = notifications.filter((n) => n.archived).length;

  const handleClick = (n: AppNotification) => {
    if (!n.read) markRead(n.id);
    if (n.actionRoute) {
      onOpenChange(false);
      navigate(n.actionRoute);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[420px] p-0 flex flex-col bg-card border-l border-border/60"
      >
        {/* Header */}
        <div className="px-5 pt-6 pb-4 border-b border-border/40 bg-gradient-to-b from-primary/[0.04] to-transparent">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[1.0625rem] font-semibold text-foreground tracking-tight">Notificações</h2>
                {unreadCount > 0 && (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] border-primary/40 text-primary bg-primary/10 font-medium">
                    {unreadCount} não {unreadCount === 1 ? "lida" : "lidas"}
                  </Badge>
                )}
              </div>
              <p className="text-[0.75rem] text-muted-foreground mt-1">
                Acompanhe o que precisa da sua atenção
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className="h-8 text-[0.75rem] gap-1.5"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Marcar todas
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 mt-4 flex-wrap">
            {([
              { value: "all", label: "Todas" },
              { value: "unread", label: "Não lidas" },
              { value: "important", label: "Importantes" },
              { value: "archived", label: "Arquivadas" },
            ] as { value: Filter; label: string }[]).map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[0.6875rem] font-medium border transition-all",
                  filter === f.value
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 py-3 min-h-0">
          {filtered.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            (["today", "week", "old"] as const).map((key) => {
              const items = grouped[key];
              if (items.length === 0) return null;
              return (
                <div key={key} className="mb-4 last:mb-0">
                  <div className="px-2 pb-1.5 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground/60">
                    {GROUP_LABEL[key]}
                  </div>
                  <div className="space-y-1">
                    {items.map((n) => (
                      <NotificationRow
                        key={n.id}
                        notification={n}
                        onClick={() => handleClick(n)}
                        onMarkRead={() => markRead(n.id)}
                        onMarkUnread={() => markUnread(n.id)}
                        onArchive={() => archive(n.id)}
                        onUnarchive={() => unarchive(n.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {filter === "archived" && archivedCount > 0 && (
          <div className="border-t border-border/40 px-4 py-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={clearArchived}
              className="w-full text-[0.75rem] text-muted-foreground hover:text-destructive gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Limpar arquivadas
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function NotificationRow({
  notification: n,
  onClick,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onUnarchive,
}: {
  notification: AppNotification;
  onClick: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) {
  const meta = CATEGORY_META[n.category];
  const { Icon } = meta;

  return (
    <div
      className={cn(
        "group relative rounded-lg border px-3 py-2.5 transition-all cursor-pointer",
        !n.read
          ? "bg-card border-l-2 border-l-primary/40 border-y-border/60 border-r-border/60 hover:bg-muted/20"
          : "bg-card border-border/60 hover:border-border hover:bg-muted/10",
        n.priority === "critical" && !n.read && "border-l-destructive/50",
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          "shrink-0 h-8 w-8 rounded-md border border-border/40 flex items-center justify-center",
          meta.bg,
          meta.tone,
        )}>
          <Icon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {!n.read && (
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TYPE_DOT[n.type])} />
              )}
              <div className={cn(
                "text-[0.8125rem] truncate",
                !n.read ? "font-semibold text-foreground" : "font-medium text-foreground/80",
              )}>
                {n.title}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[0.6875rem] text-muted-foreground/70">{relativeTime(n.createdAt)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <button
                    aria-label="Mais opções"
                    className="p-1 rounded hover:bg-muted/60 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {n.read ? (
                    <DropdownMenuItem onClick={onMarkUnread}>Marcar como não lida</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onMarkRead}>Marcar como lida</DropdownMenuItem>
                  )}
                  {n.archived ? (
                    <DropdownMenuItem onClick={onUnarchive}>
                      <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restaurar
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onArchive}>
                      <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {n.description && (
            <p className="text-[0.75rem] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
              {n.description}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] border-border/40 text-muted-foreground/70 font-medium">
              {meta.label}
            </Badge>
            <Badge variant="outline" className={cn("h-4 px-1.5 text-[9px] font-medium", PRIORITY_BADGE[n.priority])}>
              {PRIORITY_LABEL[n.priority]}
            </Badge>
            {n.actionLabel && n.actionRoute && (
              <span className="ml-auto inline-flex items-center gap-0.5 text-[0.6875rem] font-medium text-primary group-hover:text-primary">
                {n.actionLabel}
                <ChevronRight className="h-3 w-3" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: Filter }) {
  const messages: Record<Filter, { title: string; text: string }> = {
    all: { title: "Tudo em ordem", text: "Quando algo importante acontecer, você verá aqui." },
    unread: { title: "Sem novidades", text: "Você está em dia com todas as notificações." },
    important: { title: "Nada urgente", text: "Não há notificações importantes no momento." },
    archived: { title: "Nenhuma arquivada", text: "Notificações arquivadas aparecerão aqui." },
  };
  const { title, text } = messages[filter];
  return (
    <div className="text-center py-20 px-6">
      <div className="mx-auto h-10 w-10 rounded-full bg-muted/40 border border-border/50 flex items-center justify-center mb-3">
        <Inbox className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-[0.9375rem] font-medium text-foreground">{title}</div>
      <p className="text-[0.8125rem] text-muted-foreground mt-1 max-w-[260px] mx-auto leading-relaxed">{text}</p>
    </div>
  );
}

// Re-export Bell for convenience if needed
export { Bell };
