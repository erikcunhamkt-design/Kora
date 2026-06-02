import { FileText } from "lucide-react";

export interface WhatsAppMessageBubbleProps {
  direction: "inbound" | "outbound" | string;
  type: string | null | undefined;
  content: string | null | undefined;
  mediaUrl?: string | null;
  createdAt: string;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function WhatsAppMessageBubble({
  direction,
  type,
  content,
  mediaUrl,
  createdAt,
}: WhatsAppMessageBubbleProps) {
  const outbound = direction === "outbound";
  const t = (type ?? "text").toLowerCase();

  const isImage = t.includes("image") || t === "imagemessage";
  const isVideo = t.includes("video");
  const isAudio = t.includes("audio") || t === "ptt";
  const isDoc = t.includes("document");
  const isSticker = t.includes("sticker");

  return (
    <div
      className={`max-w-[65%] px-3 py-2 rounded-2xl text-sm shadow-sm space-y-1.5 ${
        outbound
          ? "ml-auto bg-primary/20 text-foreground rounded-br-sm"
          : "bg-card-elevated text-foreground rounded-bl-sm"
      }`}
    >
      {mediaUrl && isImage && (
        <a href={mediaUrl} target="_blank" rel="noreferrer">
          <img
            src={mediaUrl}
            alt={content ?? "imagem"}
            className="rounded-lg max-h-72 object-cover"
            loading="lazy"
          />
        </a>
      )}
      {mediaUrl && isVideo && (
        <video src={mediaUrl} controls className="rounded-lg max-h-72" />
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
          className="flex items-center gap-2 underline underline-offset-2"
        >
          <FileText className="h-4 w-4" /> {content ?? "Documento"}
        </a>
      )}
      {!mediaUrl && (isImage || isVideo || isAudio || isSticker || isDoc) && (
        <span className="italic text-muted-foreground text-xs">[{t}]</span>
      )}

      {content && !isDoc && (
        <div className="whitespace-pre-wrap break-words">{content}</div>
      )}
      {!content && !mediaUrl && (
        <span className="italic text-muted-foreground">[{t}]</span>
      )}

      <div className="text-[10px] opacity-60 text-right">{formatTime(createdAt)}</div>
    </div>
  );
}
