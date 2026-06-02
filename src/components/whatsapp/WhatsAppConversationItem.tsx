import { Camera, FileText, Headphones, Mic, Sticker, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatMessagePreview } from "@/lib/whatsapp/formatMessagePreview";

export interface WAConvLike {
  id: string;
  contact_name: string | null;
  contact_phone: string;
  avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  status?: string | null;
}

function initials(name: string | null, phone: string) {
  const base = (name ?? phone).trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const diff = (now.getTime() - d.getTime()) / 86_400_000;
    if (diff < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
  } catch { return ""; }
}

function detectTypeIcon(text: string | null) {
  const t = (text ?? "").toLowerCase();
  if (t.startsWith("📷")) return Camera;
  if (t.startsWith("🎥")) return Video;
  if (t.startsWith("🎤")) return Mic;
  if (t.startsWith("🧩")) return Sticker;
  if (t.startsWith("📄")) return FileText;
  if (t.includes("audio")) return Headphones;
  return null;
}

export function WhatsAppConversationItem({
  conversation,
  active,
  onClick,
}: {
  conversation: WAConvLike;
  active: boolean;
  onClick: () => void;
}) {
  const c = conversation;
  const preview = formatMessagePreview(c.last_message, null);
  const Icon = detectTypeIcon(preview);
  // strip leading emoji marker since we render an icon instead
  const cleanPreview = Icon ? preview.replace(/^[^\s]+\s*/u, "") : preview;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full text-left px-3 py-2.5 flex gap-3 transition-all border-l-2",
        active
          ? "bg-primary/10 border-l-primary"
          : "border-l-transparent hover:bg-muted/30",
      )}
    >
      <div className="relative h-11 w-11 flex-shrink-0">
        <div className="h-11 w-11 rounded-full bg-gradient-to-br from-primary/25 to-primary/5 border border-border/40 text-primary flex items-center justify-center text-xs font-semibold overflow-hidden">
          {c.avatar_url ? (
            <img src={c.avatar_url} alt={c.contact_name ?? c.contact_phone} className="h-full w-full object-cover" />
          ) : (
            initials(c.contact_name, c.contact_phone)
          )}
        </div>
        {c.unread_count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary border-2 border-card" />
        )}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className={cn(
            "text-sm truncate",
            c.unread_count > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90",
          )}>
            {c.contact_name ?? c.contact_phone}
          </span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0 tabular-nums">
            {formatTime(c.last_message_at)}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5">{c.contact_phone}</p>

        <div className="flex items-center justify-between gap-2 mt-1">
          <div className={cn(
            "flex items-center gap-1 min-w-0 flex-1 text-xs",
            c.unread_count > 0 ? "text-foreground/85" : "text-muted-foreground",
          )}>
            {Icon && <Icon className="h-3 w-3 flex-shrink-0 opacity-70" />}
            <span className="truncate">{cleanPreview}</span>
          </div>
          {c.unread_count > 0 && (
            <Badge className="h-4 min-w-[16px] px-1 text-[9px] flex-shrink-0 bg-primary text-primary-foreground border-0 rounded-full">
              {c.unread_count > 99 ? "99+" : c.unread_count}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
