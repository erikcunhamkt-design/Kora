// Returns a user-friendly preview string for the conversation list,
// avoiding raw JSON/base64 dumps for media messages.
export function formatMessagePreview(
  last: string | null | undefined,
  type?: string | null,
): string {
  const t = (type ?? "").toLowerCase();
  const raw = (last ?? "").trim();

  // If the stored "last_message" is actually a JSON/base64 blob, mask it.
  const looksLikeBlob =
    raw.startsWith("{") ||
    raw.startsWith("[") ||
    raw.startsWith("data:") ||
    /^[A-Za-z0-9+/=]{120,}$/.test(raw);

  if (t.includes("image") || t === "imagemessage") return raw && !looksLikeBlob ? `📷 ${raw}` : "📷 Foto";
  if (t.includes("video")) return raw && !looksLikeBlob ? `🎥 ${raw}` : "🎥 Vídeo";
  if (t.includes("audio") || t === "ptt") return "🎤 Áudio";
  if (t.includes("sticker")) return "🧩 Figurinha";
  if (t.includes("document")) return raw && !looksLikeBlob ? `📄 ${raw}` : "📄 Documento";
  if (t.includes("location")) return "📍 Localização";
  if (t.includes("contact")) return "👤 Contato";

  if (!raw) return "—";
  if (looksLikeBlob) return "Mensagem";
  return raw;
}
