import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("UAZAPI_WEBHOOK_SECRET")!;

type AnyRec = Record<string, unknown>;

function pickPhone(chat: AnyRec, message: AnyRec): string {
  const raw = (chat.phone as string) || (chat.wa_chatid as string) || (chat.id as string) || (message.chatid as string) || "";
  // strip @s.whatsapp.net / @g.us suffixes and any non-digits
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
  return "";
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

    // Resolve instance by token first, then fall back to workspace query
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

    // Update instance status on connection events
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

    // Only handle message events from here
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

    // Upsert conversation manually (lookup by instance+phone)
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

    let conversationId: string;
    if (existingConv) {
      conversationId = String(existingConv.id);
      const patch: AnyRec = {
        last_message: text || existingConv.last_message,
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
          last_message: text,
          last_message_at: ts,
          unread_count: fromMe ? 0 : 1,
          status: "open",
        })
        .select()
        .single();
      if (convErr) throw convErr;
      conversationId = String(inserted.id);
    }

    // Dedup by wa_message_id
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

    const mediaType = (message.mediaType as string) || "";
    const type = mediaType && mediaType !== "" ? mediaType : (message.type as string) || "text";
    const mediaUrl =
      (message.mediaUrl as string) ||
      (message.fileURL as string) ||
      (message.url as string) ||
      null;

    await admin.from("whatsapp_messages").insert({
      workspace_id: workspaceId,
      instance_id: instanceId,
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction,
      type,
      content: text,
      media_url: mediaUrl,
      status: "received",
    });

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
