import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("UAZAPI_WEBHOOK_SECRET")!;

type AnyRec = Record<string, unknown>;

function pickPhone(chat: AnyRec, message: AnyRec): string {
  const raw = (chat.phone as string) || (chat.wa_chatid as string) || (chat.id as string) || (message.chatid as string) || "";
  return String(raw).split("@")[0].replace(/\D/g, "");
}

function pickName(chat: AnyRec, message: AnyRec): string | null {
  return (
    (chat.wa_contactName as string) ||
    (chat.name as string) ||
    (chat.lead_name as string) ||
    (chat.lead_fullName as string) ||
    (message.senderName as string) ||
    null
  );
}

function pickText(message: AnyRec): string {
  if (typeof message.text === "string" && message.text) return message.text;
  if (typeof message.content === "string") return message.content;
  if (typeof message.body === "string") return message.body;
  if (typeof message.conversation === "string") return message.conversation;
  return "";
}

// Normalize uazapi/Baileys message type to internal kind
function normalizeKind(messageType: string, mime: string | null): string {
  const t = (messageType || "").toLowerCase();
  if (t.includes("sticker")) return "sticker";
  if (t.includes("image")) {
    if (mime && mime.toLowerCase() === "image/webp") return "sticker";
    return "image";
  }
  if (t.includes("video")) return "video";
  if (t.includes("audio") || t === "ptt") return "audio";
  if (t.includes("document")) return "document";
  if (t.includes("reaction")) return "reaction";
  if (t.includes("extendedtext") || t.includes("conversation") || t === "text") return "text";
  return t || "text";
}

const MEDIA_KEYS = [
  "imageMessage", "ImageMessage", "image",
  "stickerMessage", "StickerMessage", "sticker",
  "audioMessage", "AudioMessage", "audio",
  "videoMessage", "VideoMessage", "video",
  "documentMessage", "DocumentMessage", "document",
  "media",
];

// Find a media-like sub-object inside the message payload
function findMediaObject(message: AnyRec): AnyRec | null {
  for (const key of MEDIA_KEYS) {
    const v = message[key];
    if (v && typeof v === "object") return v as AnyRec;
  }
  // Try nested message.message (Baileys-style)
  const inner = message.message as AnyRec | undefined;
  if (inner && typeof inner === "object") {
    for (const key of MEDIA_KEYS) {
      const v = inner[key];
      if (v && typeof v === "object") return v as AnyRec;
    }
  }
  return null;
}

interface NormalizedMedia {
  media_id: string | null;
  temporary_url: string | null;
  mime_type: string | null;
  file_name: string | null;
  file_size: number | null;
  sha256: string | null;
  width: number | null;
  height: number | null;
}

function pickStr(o: AnyRec, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "string" && v) return v;
  }
  return null;
}

function pickNum(o: AnyRec, ...keys: string[]): number | null {
  for (const k of keys) {
    const v = o[k];
    if (typeof v === "number" && !isNaN(v)) return v;
    if (typeof v === "string" && v && !isNaN(Number(v))) return Number(v);
  }
  return null;
}

function extractMediaFromUazapiMessage(
  message: AnyRec,
  messageType: string,
): { kind: string; media: NormalizedMedia } | null {
  const t = (messageType || "").toLowerCase();
  const isMediaType =
    t.includes("image") || t.includes("sticker") || t.includes("audio") ||
    t.includes("video") || t.includes("document") || t === "ptt";

  let mediaObj = findMediaObject(message);

  // If type says media but no sub-object found, treat the message itself as the media holder
  if (!mediaObj && isMediaType) {
    mediaObj = message;
  }

  // Also: top-level message may have mediaUrl/mimetype directly
  const topMediaUrl = pickStr(message, "mediaUrl", "fileURL", "url");
  const topMime = pickStr(message, "mimetype", "mimeType", "mime_type");
  if (!mediaObj && (topMediaUrl || topMime) && isMediaType) {
    mediaObj = message;
  }

  if (!mediaObj) return null;

  const mime =
    pickStr(mediaObj, "mimetype", "mimeType", "mime_type") ||
    topMime ||
    null;

  const url =
    pickStr(mediaObj, "url", "URL", "mediaUrl", "fileURL", "directPath") ||
    topMediaUrl ||
    null;

  const fileName = pickStr(mediaObj, "fileName", "filename", "name");
  const fileSize = pickNum(mediaObj, "fileLength", "fileSize", "size");

  const shaRaw = mediaObj.fileSha256 ?? mediaObj.sha256;
  let sha: string | null = null;
  if (typeof shaRaw === "string") sha = shaRaw;
  else if (shaRaw && typeof shaRaw === "object") {
    try {
      const arr = new Uint8Array(shaRaw as ArrayBufferLike);
      sha = btoa(String.fromCharCode(...arr));
    } catch {
      sha = null;
    }
  }

  const mediaId =
    pickStr(mediaObj, "mediaId", "media_id", "id", "directPath") || url || null;

  const width = pickNum(mediaObj, "width");
  const height = pickNum(mediaObj, "height");

  const kind = normalizeKind(messageType, mime);

  // Need at least some evidence of media
  if (!mime && !url && !mediaId && !fileName && !fileSize) {
    return null;
  }

  return {
    kind,
    media: {
      media_id: mediaId,
      temporary_url: url,
      mime_type: mime,
      file_name: fileName,
      file_size: fileSize,
      sha256: sha,
      width,
      height,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const workspaceQ = url.searchParams.get("workspace");
    if (!secret || secret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json().catch(() => ({}))) as AnyRec;
    const eventRaw = String(payload.event ?? payload.EventType ?? "");
    const event = eventRaw.toLowerCase();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const instanceToken = (payload.token as string) || "";
    let instance: AnyRec | null = null;
    if (instanceToken) {
      const { data } = await admin
        .from("whatsapp_instances")
        .select("*")
        .eq("instance_token", instanceToken)
        .maybeSingle();
      instance = data as AnyRec | null;
    }
    if (!instance && workspaceQ) {
      const { data } = await admin
        .from("whatsapp_instances")
        .select("*")
        .eq("workspace_id", workspaceQ)
        .maybeSingle();
      instance = data as AnyRec | null;
    }
    if (!instance) {
      return new Response(JSON.stringify({ ok: true, ignored: "no-instance" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event.includes("connection") || event.includes("qrcode") || event === "status") {
      const patch: AnyRec = { last_status_at: new Date().toISOString() };
      const status = (payload.status as string) || (payload.state as string);
      if (status) patch.status = status;
      const qr = (payload.qrcode as string) || (payload.qr as string);
      if (qr) patch.qr_code = qr;
      await admin.from("whatsapp_instances").update(patch).eq("id", instance.id);
      return new Response(JSON.stringify({ ok: true, event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event.includes("message")) {
      return new Response(JSON.stringify({ ok: true, ignored: event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chat = (payload.chat as AnyRec) ?? {};
    const message = (payload.message as AnyRec) ?? {};
    const phone = pickPhone(chat, message);
    if (!phone) {
      return new Response(JSON.stringify({ ok: true, ignored: "no-phone" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const workspaceId = String(instance.workspace_id);
    const instanceId = String(instance.id);

    const { data: existingConv } = await admin
      .from("whatsapp_conversations")
      .select("*")
      .eq("instance_id", instanceId)
      .eq("contact_phone", phone)
      .maybeSingle();

    const text = pickText(message);
    const contactName = pickName(chat, message);
    const fromMe = Boolean(message.fromMe);
    const direction = fromMe ? "outbound" : "inbound";
    const ts = message.messageTimestamp
      ? new Date(Number(message.messageTimestamp) * 1000).toISOString()
      : new Date().toISOString();

    // Determine message type from any available field
    const rawType = String(
      (message.mediaType as string) ||
      (message.messageType as string) ||
      (message.type as string) ||
      "",
    );

    // Try extracting media early so we can use its mime for kind disambiguation
    const extracted = extractMediaFromUazapiMessage(message, rawType);
    const internalKind = normalizeKind(rawType, extracted?.media.mime_type ?? null);
    const type = internalKind;

    console.log("[whatsapp-webhook] messageType detected:", rawType, "->", internalKind);
    console.log("[whatsapp-webhook] media detected:", !!extracted, "kind:", extracted?.kind ?? "-", "has temporary url:", !!extracted?.media.temporary_url);

    const mediaUrl = extracted?.media.temporary_url ?? null;

    let previewText = text;
    if (!previewText) {
      if (internalKind === "image") previewText = "📷 Foto";
      else if (internalKind === "video") previewText = "🎥 Vídeo";
      else if (internalKind === "audio") previewText = "🎵 Áudio";
      else if (internalKind === "sticker") previewText = "🧩 Figurinha";
      else if (internalKind === "document") previewText = "📄 Documento";
      else if (internalKind === "reaction") previewText = "💬 Reação";
      else if (mediaUrl) previewText = "📎 Mídia";
    }

    let conversationId: string;
    if (existingConv) {
      conversationId = String(existingConv.id);
      const patch: AnyRec = {
        last_message: previewText || existingConv.last_message,
        last_message_at: ts,
        updated_at: new Date().toISOString(),
      };
      if (contactName && !existingConv.contact_name) patch.contact_name = contactName;
      if (!fromMe) patch.unread_count = Number(existingConv.unread_count ?? 0) + 1;
      await admin.from("whatsapp_conversations").update(patch).eq("id", conversationId);
    } else {
      const { data: inserted, error: convErr } = await admin
        .from("whatsapp_conversations")
        .insert({
          workspace_id: workspaceId,
          instance_id: instanceId,
          contact_phone: phone,
          contact_name: contactName,
          last_message: previewText,
          last_message_at: ts,
          unread_count: fromMe ? 0 : 1,
          status: "open",
        })
        .select()
        .single();
      if (convErr) throw convErr;
      conversationId = String(inserted.id);
    }

    const waMessageId = (message.id as string) || (message.messageid as string) || null;
    if (waMessageId) {
      const { data: dup } = await admin
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("wa_message_id", waMessageId)
        .maybeSingle();
      if (dup) {
        return new Response(JSON.stringify({ ok: true, deduped: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: dbMsg, error: dbMsgErr } = await admin.from("whatsapp_messages").insert({
      workspace_id: workspaceId,
      instance_id: instanceId,
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction,
      type,
      content: text,
      body: text,
      media_url: mediaUrl,
      status: "received",
      timestamp: ts,
      raw_payload: payload,
    }).select().single();

    if (dbMsgErr) throw dbMsgErr;

    if (extracted && dbMsg) {
      const { error: mediaErr } = await admin
        .from("whatsapp_message_media")
        .insert({
          workspace_id: workspaceId,
          message_id: dbMsg.id,
          media_id: extracted.media.media_id,
          mime_type: extracted.media.mime_type,
          file_name: extracted.media.file_name,
          file_size: extracted.media.file_size,
          sha256: extracted.media.sha256,
          temporary_url: extracted.media.temporary_url,
        });

      if (mediaErr) {
        console.error("[whatsapp-webhook] insert whatsapp_message_media error:", mediaErr.message);
      } else {
        console.log("[whatsapp-webhook] insert whatsapp_message_media success");
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("whatsapp-webhook error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
