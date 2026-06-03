import { useEffect, useState } from "react";
import {
  Check, CheckCheck, Clock, FileText, AlertCircle, Star,
  Reply, Pin, Smile, PinOff, CornerUpLeft, Trash2, Forward, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppImageLightbox } from "./WhatsAppImageLightbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ReplyPreviewData {
  id: string;
  content: string | null;
  direction: string;
  type: string | null;
}

export interface WhatsAppMessageBubbleProps {
  id: string;
  direction: "inbound" | "outbound" | string;
  type: string | null | undefined;
  content: string | null | undefined;
  mediaUrl?: string | null;
  createdAt: string;
  status?: string | null;
  senderId?: string | null;
  workspaceId?: string;
  reactions?: Record<string, string> | null;
  pinnedAt?: string | null;
  deletedAt?: string | null;
  replyTo?: ReplyPreviewData | null;
  onReply?: (msg: { id: string; content: string | null; direction: string; type: string | null }) => void;
  onJumpTo?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "👏"];

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

function ReactionsRow({
  reactions,
  outbound,
  onToggle,
}: {
  reactions: Record<string, string>;
  outbound: boolean;
  onToggle: (emoji: string) => void;
}) {
  const counts = new Map<string, number>();
  for (const e of Object.values(reactions)) counts.set(e, (counts.get(e) ?? 0) + 1);
  if (counts.size === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1 mt-0.5", outbound ? "justify-end mr-1" : "justify-start ml-1")}>
      {Array.from(counts.entries()).map(([emoji, n]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className="inline-flex items-center gap-0.5 rounded-full bg-card border border-border/60 px-1.5 py-0.5 text-[11px] hover:border-primary/40 transition"
        >
          <span>{emoji}</span>
          {n > 1 && <span className="text-muted-foreground">{n}</span>}
        </button>
      ))}
    </div>
  );
}

export function WhatsAppMessageBubble({
  id,
  direction,
  type,
  content,
  mediaUrl,
  createdAt,
  status,
  senderId,
  workspaceId,
  reactions,
  pinnedAt,
  deletedAt,
  replyTo,
  onReply,
  onJumpTo,
  onDelete,
  onForward,
}: WhatsAppMessageBubbleProps) {
  const outbound = direction === "outbound";
  const t = (type ?? "text").toLowerCase();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  const isImage   = t.includes("image") || t === "imagemessage";
  const isVideo   = t.includes("video");
  const isAudio   = t.includes("audio") || t === "ptt";
  const isDoc     = t.includes("document");
  const isSticker = t.includes("sticker");
  const isMedia   = isImage || isVideo || isAudio || isDoc || isSticker;
  const isUnknown = !isMedia && t !== "text" && !content;
  const reactionsObj = reactions ?? {};

  // Encrypted WhatsApp media URLs cannot be opened by the browser — must decrypt via UAZAPI
  const isEncryptedHost = (u?: string | null) =>
    !!u && (u.includes("mmg.whatsapp.net") || u.includes("media.whatsapp.net") || u.includes("a.whatsapp.net"));
  const needsDownload = isMedia && (!mediaUrl || isEncryptedHost(mediaUrl));
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(
    mediaUrl && !isEncryptedHost(mediaUrl) ? mediaUrl : null,
  );
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!needsDownload || resolvedUrl || downloading || !workspaceId) return;
    setDownloading(true);
    setDownloadError(null);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
          body: { action: "download_media", workspaceId, messageId: id },
        });
        if (error) throw error;
        const url = (data as { url?: string } | null)?.url ?? null;
        if (!cancelled) {
          if (url) setResolvedUrl(url);
          else setDownloadError("Sem mídia");
        }
      } catch (e) {
        if (!cancelled) setDownloadError((e as Error).message || "Falha ao baixar mídia");
      } finally {
        if (!cancelled) setDownloading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [needsDownload, resolvedUrl, downloading, workspaceId, id]);

  const effectiveMediaUrl = resolvedUrl ?? (mediaUrl && !isEncryptedHost(mediaUrl) ? mediaUrl : null);


  if (deletedAt) {
    return (
      <div className={cn("flex w-full flex-col", outbound ? "items-end" : "items-start")}>
        <div
          className={cn(
            "relative max-w-[85%] sm:max-w-[78%] md:max-w-[65%] xl:max-w-[60%] px-3 py-2 rounded-2xl text-sm",
            outbound
              ? "bg-primary/10 border border-primary/10 text-muted-foreground rounded-br-md italic"
              : "bg-muted/30 border border-border/30 text-muted-foreground rounded-bl-md italic",
          )}
        >
          Mensagem excluída
          <div className={cn(
            "flex items-center gap-1 text-[10px] opacity-70 mt-1",
            outbound ? "justify-end" : "justify-start",
          )}>
            <span>{formatTime(createdAt)}</span>
          </div>
        </div>
      </div>
    );
  }

  const react = async (emoji: string | null) => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "react_message", workspaceId, messageId: id, emoji },
      });
      if (error) throw error;
    } catch (e) {
      toast.error("Falha ao reagir", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  const togglePin = async () => {
    if (!workspaceId) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "pin_message", workspaceId, messageId: id, pinned: !pinnedAt },
      });
      if (error) throw error;
      toast.success(pinnedAt ? "Fixação removida" : "Mensagem fixada");
    } catch (e) {
      toast.error("Falha", { description: (e as Error).message });
    } finally { setBusy(false); }
  };

  const handleFavoriteSticker = async () => {
    if (!mediaUrl || !workspaceId) return;
    setFavoriting(true);
    try {
      const { error } = await supabase.functions.invoke("whatsapp-instance", {
        body: {
          action: "toggle_favorite_sticker",
          workspaceId,
          stickerUrl: mediaUrl,
          mimeType: "image/webp",
          op: favorited ? "remove" : "add",
        },
      });
      if (error) throw error;
      setFavorited(!favorited);
      toast.success(favorited ? "Removida dos favoritos" : "Figurinha favoritada");
    } catch (e) {
      toast.error("Falha ao favoritar", { description: (e as Error).message });
    } finally {
      setFavoriting(false);
    }
  };

  const HoverToolbar = (
    <div
      className={cn(
        "absolute -top-3 flex items-center gap-0.5 rounded-full border border-border/60 bg-popover shadow-md px-1 py-0.5 opacity-0 group-hover:opacity-100 transition z-10",
        outbound ? "right-2" : "left-2",
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className="h-6 w-6 rounded-full hover:bg-muted/50 flex items-center justify-center"
            title="Reagir"
          >
            <Smile className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" className="w-auto p-1">
          <div className="flex items-center gap-0.5">
            {QUICK_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => react(e)}
                className="h-8 w-8 rounded hover:bg-muted text-base"
              >
                {e}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {onReply && (
        <button
          type="button"
          onClick={() =>
            onReply({ id, content: content ?? null, direction, type: type ?? null })
          }
          className="h-6 w-6 rounded-full hover:bg-muted/50 flex items-center justify-center"
          title="Responder"
        >
          <Reply className="h-3.5 w-3.5" />
        </button>
      )}
      {onForward && (
        <button
          type="button"
          onClick={() => onForward(id)}
          className="h-6 w-6 rounded-full hover:bg-muted/50 flex items-center justify-center"
          title="Encaminhar"
        >
          <Forward className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={togglePin}
        className="h-6 w-6 rounded-full hover:bg-muted/50 flex items-center justify-center"
        title={pinnedAt ? "Desafixar" : "Fixar"}
      >
        {pinnedAt
          ? <PinOff className="h-3.5 w-3.5 text-primary" />
          : <Pin className="h-3.5 w-3.5" />}
      </button>
      {onDelete && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="h-6 w-6 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align={outbound ? "end" : "start"}>
            <DropdownMenuItem
              onClick={() => onDelete(id)}
              className="text-destructive focus:text-destructive focus:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir para mim
            </DropdownMenuItem>
            {outbound && (
              <DropdownMenuItem
                onClick={() => onDelete(id)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" /> Excluir para todos
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  // Sticker has no chat-bubble background
  if (isSticker) {
    return (
      <div className={cn("flex w-full flex-col group", outbound ? "items-end" : "items-start")}>
        <div className="relative">
          {HoverToolbar}
          {effectiveMediaUrl ? (
            <img
              src={effectiveMediaUrl}
              alt="sticker"
              className="h-36 w-36 object-contain"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-36 w-36 rounded-lg border border-border/40 bg-card flex items-center justify-center text-muted-foreground text-xs">
              {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : (downloadError ?? "🧩")}
            </div>
          )}
          {effectiveMediaUrl && (
            <button
              type="button"
              onClick={handleFavoriteSticker}
              disabled={favoriting}
              className={cn(
                "absolute top-1 right-1 h-7 w-7 rounded-full bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center transition",
                "opacity-0 group-hover:opacity-100",
                favorited && "opacity-100 text-warning",
              )}
              aria-label={favorited ? "Remover dos favoritos" : "Favoritar figurinha"}
              title={favorited ? "Remover dos favoritos" : "Favoritar figurinha"}
            >
              <Star className={cn("h-3.5 w-3.5", favorited && "fill-current")} />
            </button>
          )}
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[10px] opacity-70 mt-0.5",
          outbound ? "justify-end mr-1" : "justify-start ml-1",
        )}>
          {pinnedAt && <Pin className="h-2.5 w-2.5 text-primary" />}
          <span>{formatTime(createdAt)}</span>
          {outbound && <StatusTick status={status} />}
        </div>
        <ReactionsRow reactions={reactionsObj} outbound={outbound} onToggle={(e) =>
          react(reactionsObj && Object.values(reactionsObj).includes(e) ? null : e)
        } />
      </div>
    );
  }


  return (
    <div className={cn("flex w-full flex-col group", outbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "relative max-w-[85%] sm:max-w-[78%] md:max-w-[65%] xl:max-w-[60%] px-3 py-2 rounded-2xl text-sm shadow-sm space-y-1.5 transition-colors",
          outbound
            ? "bg-primary/20 border border-primary/20 text-foreground rounded-br-md"
            : "bg-card-elevated border border-border/40 text-foreground rounded-bl-md",
          pinnedAt && "ring-1 ring-primary/40",
        )}
      >
        {HoverToolbar}

        {/* Reply quote */}
        {replyTo && (
          <button
            type="button"
            onClick={() => onJumpTo?.(replyTo.id)}
            className={cn(
              "w-full text-left rounded-md px-2 py-1.5 border-l-2 border-primary/60 bg-background/30 hover:bg-background/50 transition flex items-start gap-1.5",
            )}
          >
            <CornerUpLeft className="h-3 w-3 mt-0.5 text-primary/80 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold text-primary/90">
                {replyTo.direction === "outbound" ? "Você" : "Contato"}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">
                {replyTo.content || `[${replyTo.type ?? "mídia"}]`}
              </p>
            </div>
          </button>
        )}

        {/* Image */}
        {isImage && effectiveMediaUrl && (
          <>
            <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full">
              <img
                src={effectiveMediaUrl}
                alt={content ?? "imagem"}
                className="rounded-lg max-h-72 w-full object-cover bg-background/40 cursor-zoom-in hover:opacity-95 transition"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.style.display = "none";
                  const fb = img.nextElementSibling as HTMLElement | null;
                  if (fb) fb.style.display = "flex";
                }}
              />
              <div
                style={{ display: "none" }}
                className="items-center gap-2 rounded-lg bg-background/40 px-2.5 py-2 border border-border/40 text-xs italic text-muted-foreground"
              >
                <FileText className="h-3 w-3" /> Imagem indisponível
              </div>
            </button>
            <WhatsAppImageLightbox
              src={effectiveMediaUrl}
              alt={content ?? "imagem"}
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
            />
          </>
        )}

        {isVideo && effectiveMediaUrl && (
          <video src={effectiveMediaUrl} controls preload="metadata" className="rounded-lg max-h-72 w-full" />
        )}

        {isAudio && effectiveMediaUrl && (
          <audio src={effectiveMediaUrl} controls preload="none" className="w-full min-w-[220px]" />
        )}

        {isDoc && effectiveMediaUrl && (
          <a
            href={effectiveMediaUrl}
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

        {isMedia && !effectiveMediaUrl && (
          <div className="flex items-center gap-2 italic text-muted-foreground text-xs rounded-lg bg-background/40 px-2.5 py-2 border border-border/40 min-w-[200px]">
            {downloading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Baixando mídia…
              </>
            ) : downloadError ? (
              <>
                <AlertCircle className="h-3.5 w-3.5 text-destructive" /> {downloadError}
              </>
            ) : (
              <>
                <FileText className="h-3 w-3" /> {isImage ? "Imagem" : isVideo ? "Vídeo" : isAudio ? "Áudio" : isDoc ? "Documento" : "Mídia"} sem preview
              </>
            )}
          </div>
        )}


        {isUnknown && (
          <div className="text-[11px] italic text-muted-foreground">
            Evento recebido ({t})
          </div>
        )}

        {content && !isDoc && (
          <div className="whitespace-pre-wrap break-words leading-relaxed">{content}</div>
        )}

        <div className={cn(
          "flex items-center gap-1 text-[10px] opacity-70",
          outbound ? "justify-end" : "justify-start",
        )}>
          {pinnedAt && <Pin className="h-2.5 w-2.5 text-primary" />}
          <span>{formatTime(createdAt)}</span>
          {outbound && <StatusTick status={status} />}
        </div>
      </div>

      <ReactionsRow reactions={reactionsObj} outbound={outbound} onToggle={(e) =>
        react(reactionsObj && Object.values(reactionsObj).includes(e) ? null : e)
      } />

      {outbound && senderId && (
        <span className="text-[9px] text-muted-foreground/60 mr-1 mt-0.5">
          Enviado pelo atendente
        </span>
      )}
    </div>
  );
}
