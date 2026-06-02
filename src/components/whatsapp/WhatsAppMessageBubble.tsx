import { Check, CheckCheck, Clock, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WhatsAppMessageBubbleProps {
  direction: "inbound" | "outbound" | string;
  type: string | null | undefined;
  content: string | null | undefined;
  mediaUrl?: string | null;
  createdAt: string;
  status?: string | null;
  senderId?: string | null;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function StatusTick({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toLowerCase();
  if (s === "error" || s === "failed") return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (s === "read")      return <CheckCheck className="h-3 w-3 text-sky-400" />;
  if (s === "delivered") return <CheckCheck className="h-3 w-3 opacity-70" />;
  if (s === "sent")      return <Check className="h-3 w-3 opacity-70" />;
  return <Clock className="h-3 w-3 opacity-50" />;
}

export function WhatsAppMessageBubble({
  direction,
  type,
  content,
  mediaUrl,
  createdAt,
  status,
  senderId,
}: WhatsAppMessageBubbleProps) {
  const outbound = direction === "outbound";
  const t = (type ?? "text").toLowerCase();

  const isImage   = t.includes("image") || t === "imagemessage";
  const isVideo   = t.includes("video");
  const isAudio   = t.includes("audio") || t === "ptt";
  const isDoc     = t.includes("document");
  const isSticker = t.includes("sticker");
  const isMedia   = isImage || isVideo || isAudio || isDoc || isSticker;
  const isUnknown = !isMedia && t !== "text" && !content;

  return (
    <div className={cn("flex w-full flex-col", outbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] sm:max-w-[78%] md:max-w-[65%] xl:max-w-[60%] px-3 py-2 rounded-2xl text-sm shadow-sm space-y-1.5 transition-colors",
          outbound
            ? "bg-primary/20 border border-primary/20 text-foreground rounded-br-md"
            : "bg-card-elevated border border-border/40 text-foreground rounded-bl-md",
        )}
      >
        {/* Media renderers */}
        {mediaUrl && isImage && (
          <a href={mediaUrl} target="_blank" rel="noreferrer" className="block">
            <img
              src={mediaUrl}
              alt={content ?? "imagem"}
              className="rounded-lg max-h-72 w-full object-cover"
              loading="lazy"
            />
          </a>
        )}
        {mediaUrl && isVideo && (
          <video src={mediaUrl} controls className="rounded-lg max-h-72 w-full" />
        )}
        {mediaUrl && isAudio && (
          <audio src={mediaUrl} controls className="w-full" />
        )}
        {mediaUrl && isSticker && (
          <img src={mediaUrl} alt="sticker" className="h-28 w-28 object-contain" />
        )}
        {mediaUrl && isDoc && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-lg bg-background/40 px-2.5 py-2 border border-border/40 hover:border-primary/40 transition"
          >
            <div className="h-9 w-9 rounded-md bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{content ?? "Documento"}</p>
              <p className="text-[10px] text-muted-foreground">Toque para abrir</p>
            </div>
          </a>
        )}

        {/* Media without URL */}
        {!mediaUrl && isMedia && (
          <div className="flex items-center gap-2 italic text-muted-foreground text-xs">
            <FileText className="h-3 w-3" /> {t} sem preview
          </div>
        )}

        {/* Unknown / payload event */}
        {isUnknown && (
          <div className="text-[11px] italic text-muted-foreground">
            Evento recebido ({t})
          </div>
        )}

        {/* Text content */}
        {content && !isDoc && (
          <div className="whitespace-pre-wrap break-words leading-relaxed">{content}</div>
        )}

        <div className={cn(
          "flex items-center gap-1 text-[10px] opacity-70",
          outbound ? "justify-end" : "justify-start",
        )}>
          <span>{formatTime(createdAt)}</span>
          {outbound && <StatusTick status={status} />}
        </div>
      </div>
      {outbound && senderId && (
        <span className="text-[9px] text-muted-foreground/60 mr-1 mt-0.5">
          Enviado pelo atendente
        </span>
      )}
    </div>
  );
}
