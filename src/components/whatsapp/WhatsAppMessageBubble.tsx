import { useState } from "react";
import { Check, CheckCheck, Clock, FileText, AlertCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { WhatsAppImageLightbox } from "./WhatsAppImageLightbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WhatsAppMessageBubbleProps {
  direction: "inbound" | "outbound" | string;
  type: string | null | undefined;
  content: string | null | undefined;
  mediaUrl?: string | null;
  createdAt: string;
  status?: string | null;
  senderId?: string | null;
  workspaceId?: string;
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
  workspaceId,
}: WhatsAppMessageBubbleProps) {
  const outbound = direction === "outbound";
  const t = (type ?? "text").toLowerCase();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const [favorited, setFavorited] = useState(false);

  const isImage   = t.includes("image") || t === "imagemessage";
  const isVideo   = t.includes("video");
  const isAudio   = t.includes("audio") || t === "ptt";
  const isDoc     = t.includes("document");
  const isSticker = t.includes("sticker");
  const isMedia   = isImage || isVideo || isAudio || isDoc || isSticker;
  const isUnknown = !isMedia && t !== "text" && !content;

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

  // Sticker has no chat-bubble background
  if (isSticker && mediaUrl) {
    return (
      <div className={cn("flex w-full flex-col", outbound ? "items-end" : "items-start")}>
        <div className="relative group">
          <img
            src={mediaUrl}
            alt="sticker"
            className="h-36 w-36 object-contain"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
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
        </div>
        <div className={cn(
          "flex items-center gap-1 text-[10px] opacity-70 mt-0.5",
          outbound ? "justify-end mr-1" : "justify-start ml-1",
        )}>
          <span>{formatTime(createdAt)}</span>
          {outbound && <StatusTick status={status} />}
        </div>
      </div>
    );
  }

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
        {/* Image */}
        {mediaUrl && isImage && (
          <>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full"
            >
              <img
                src={mediaUrl}
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
              src={mediaUrl}
              alt={content ?? "imagem"}
              open={lightboxOpen}
              onOpenChange={setLightboxOpen}
            />
          </>
        )}

        {mediaUrl && isVideo && (
          <video src={mediaUrl} controls preload="metadata" className="rounded-lg max-h-72 w-full" />
        )}

        {mediaUrl && isAudio && (
          <audio src={mediaUrl} controls preload="none" className="w-full min-w-[220px]" />
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
