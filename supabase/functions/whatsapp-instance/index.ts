import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN")!;
const SUBDOMAIN = Deno.env.get("UAZAPI_SUBDOMAIN")!;
const WEBHOOK_SECRET = Deno.env.get("UAZAPI_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Allow UAZAPI_SUBDOMAIN to be either a bare subdomain ("free") or a full URL
// ("https://free.uazapi.com"). uazapi returns "host not mapped" when the
// subdomain doesn't exist on their infra, so normalize defensively.
const UAZ_BASE = (() => {
  const raw = (SUBDOMAIN ?? "").trim().replace(/\/+$/, "");
  if (!raw) return "https://free.uazapi.com";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.includes(".")) return `https://${raw}`;
  return `https://${raw}.uazapi.com`;
})();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function uaz(path: string, opts: { token?: string; admin?: boolean; method?: string; body?: unknown }) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.admin) headers["admintoken"] = ADMIN_TOKEN;
  if (opts.token) headers["token"] = opts.token;
  const res = await fetch(`${UAZ_BASE}${path}`, {
    method: opts.method ?? "POST",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
  try { data = JSON.parse(text); } catch { /* keep text */ }
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const { action, workspaceId } = body as { action?: string; workspaceId?: string };
    if (!workspaceId) return json({ error: "workspaceId is required" }, 400);

    // Normaliza subdomain ("free" | "free.uazapi.com" | "https://free.uazapi.com") => "free"
    const normalizeSubdomain = (input: string | undefined | null): string => {
      const raw = (input ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
      if (!raw) return SUBDOMAIN || "free";
      const host = raw.split("/")[0];
      if (host.endsWith(".uazapi.com")) return host.replace(/\.uazapi\.com$/, "");
      if (host.includes(".")) return host;
      return host;
    };
    const baseForSubdomain = (sub: string) =>
      /\./.test(sub) ? `https://${sub}` : `https://${sub}.uazapi.com`;

    // Verify membership
    const { data: member } = await userClient
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!member) return json({ error: "Forbidden" }, 403);

    // Load existing instance
    const { data: existing } = await admin
      .from("whatsapp_instances")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (action === "create" || action === "connect") {
      let instance = existing;

      // Create on uazapi if no instance yet
      if (!instance) {
        const init = await uaz("/instance/init", {
          admin: true,
          body: { name: `ws-${workspaceId.slice(0, 8)}`, systemName: "Orbyt" },
        });
        if (!init.ok) return json({ error: "uazapi init failed", detail: init.data }, 502);
        const initData = init.data as Record<string, unknown>;
        const instToken = (initData.token ?? (initData.instance as Record<string, unknown>)?.token) as string;
        if (!instToken) return json({ error: "uazapi did not return token", detail: initData }, 502);

        const { data: inserted, error: insertErr } = await admin
          .from("whatsapp_instances")
          .insert({
            workspace_id: workspaceId,
            instance_token: instToken,
            instance_name: `ws-${workspaceId.slice(0, 8)}`,
            subdomain: SUBDOMAIN,
            status: "connecting",
            created_by: userId,
          })
          .select()
          .single();
        if (insertErr) return json({ error: insertErr.message }, 500);
        instance = inserted;

      }

      // Always (re)register webhook on connect/create to keep URL + secret in sync
      const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?secret=${encodeURIComponent(WEBHOOK_SECRET)}&workspace=${workspaceId}`;
      await uaz("/webhook", {
        token: instance.instance_token,
        body: {
          webhookURL: webhookUrl,
          url: webhookUrl,
          enabled: true,
          events: ["messages", "messages_update", "connection"],
        },
      }).catch(() => null);

      // Request QR
      const connect = await uaz("/instance/connect", { token: instance.instance_token, body: {} });
      const cdata = (connect.data ?? {}) as Record<string, unknown>;
      const qr = (cdata.qrcode ?? cdata.qr ?? (cdata.instance as Record<string, unknown>)?.qrcode) as string | undefined;
      const status = ((cdata.status ?? (cdata.instance as Record<string, unknown>)?.status) as string | undefined) ?? "connecting";

      const { data: updated } = await admin
        .from("whatsapp_instances")
        .update({
          qr_code: qr ?? null,
          status,
          last_status_at: new Date().toISOString(),
        })
        .eq("id", instance.id)
        .select()
        .single();

      return json({ instance: updated });
    }

    if (action === "status") {
      if (!existing) return json({ instance: null });
      const st = await uaz("/instance/status", { token: existing.instance_token, method: "GET" });
      const sd = (st.data ?? {}) as Record<string, unknown>;
      const inst = (sd.instance ?? sd) as Record<string, unknown>;
      const status = (inst.status as string | undefined) ?? existing.status;
      const phone = (inst.owner as string | undefined) ?? (inst.phone as string | undefined) ?? existing.phone;
      const phoneName = (inst.profileName as string | undefined) ?? (inst.name as string | undefined) ?? existing.phone_name;
      const qr = (inst.qrcode as string | undefined) ?? null;

      const patch: Record<string, unknown> = {
        status,
        phone,
        phone_name: phoneName,
        last_status_at: new Date().toISOString(),
      };
      if (status === "connected") {
        patch.qr_code = null;
        if (!existing.connected_at) patch.connected_at = new Date().toISOString();
      } else if (qr) {
        patch.qr_code = qr;
      }

      const { data: updated } = await admin
        .from("whatsapp_instances")
        .update(patch)
        .eq("id", existing.id)
        .select()
        .single();
      return json({ instance: updated });
    }

    if (action === "disconnect") {
      if (!existing) return json({ instance: null });
      await uaz("/instance/disconnect", { token: existing.instance_token, body: {} }).catch(() => null);
      const { data: updated } = await admin
        .from("whatsapp_instances")
        .update({ status: "disconnected", qr_code: null, last_status_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      return json({ instance: updated });
    }

    if (action === "delete") {
      if (!existing) return json({ ok: true });
      await uaz("/instance/delete", { admin: true, body: { token: existing.instance_token } }).catch(() => null);
      await admin.from("whatsapp_instances").delete().eq("id", existing.id);
      return json({ ok: true });
    }

    if (action === "sync") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      // Fetch chat list from uazapi and upsert conversations
      const list = await uaz("/chat/find", {
        token: existing.instance_token,
        body: { operator: "AND", sort: "-wa_lastMsgTimestamp" },
      });
      if (!list.ok) {
        console.error("sync /chat/find failed", list.status, list.data);
        return json({ error: "uazapi /chat/find failed", status: list.status, detail: list.data }, 502);
      }
      const chats = Array.isArray(list.data)
        ? (list.data as Record<string, unknown>[])
        : Array.isArray((list.data as Record<string, unknown>)?.chats)
          ? ((list.data as Record<string, unknown>).chats as Record<string, unknown>[])
          : [];
      console.log("sync: received chats", chats.length);
      let synced = 0;
      const errors: string[] = [];
      for (const chat of chats) {
        try {
          if ((chat.wa_isGroup as boolean) || (chat.isGroup as boolean)) continue;
          const rawPhone = (chat.phone as string) || (chat.wa_chatid as string) || (chat.id as string) || "";
          const phone = String(rawPhone).split("@")[0].replace(/\D/g, "");
          if (!phone) continue;
          const name = (chat.wa_contactName as string) || (chat.name as string) || (chat.wa_name as string) || null;
          const avatar = (chat.imagePreview as string) || (chat.image as string) || (chat.wa_profilePicUrl as string) || (chat.profilePicUrl as string) || null;
          const lastMessage = (chat.wa_lastMessageTextVote as string) || (chat.lastMessage as string) || null;
          const rawTs = Number(chat.wa_lastMsgTimestamp ?? chat.lastMessageTimestamp ?? 0);
          // uazapi sometimes returns seconds, sometimes ms — normalize to ms
          const tsMs = rawTs > 1e12 ? rawTs : rawTs * 1000;
          const lastAt = tsMs ? new Date(tsMs).toISOString() : null;
          const unread = Number(chat.wa_unreadCount ?? chat.unreadCount ?? 0);

          const { data: existingConv } = await admin
            .from("whatsapp_conversations")
            .select("id")
            .eq("instance_id", existing.id)
            .eq("contact_phone", phone)
            .maybeSingle();

          if (existingConv) {
            const { error: updErr } = await admin.from("whatsapp_conversations").update({
              contact_name: name,
              avatar_url: avatar,
              last_message: lastMessage,
              last_message_at: lastAt,
              unread_count: unread,
              updated_at: new Date().toISOString(),
            }).eq("id", existingConv.id);
            if (updErr) throw updErr;
          } else {
            const { error: insErr } = await admin.from("whatsapp_conversations").insert({
              workspace_id: workspaceId,
              instance_id: existing.id,
              contact_phone: phone,
              contact_name: name,
              avatar_url: avatar,
              last_message: lastMessage,
              last_message_at: lastAt,
              unread_count: unread,
              status: "open",
            });
            if (insErr) throw insErr;
          }
          synced++;
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          console.error("sync chat error", msg, chat.wa_chatid ?? chat.id);
          errors.push(msg);
        }
      }
      return json({ ok: true, total: chats.length, synced, errors: errors.slice(0, 5) });
    }

    if (action === "load_messages") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      const { conversationId, limit } = body as { conversationId?: string; limit?: number };
      if (!conversationId) return json({ error: "conversationId is required" }, 400);
      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!conv) return json({ error: "Conversation not found" }, 404);

      const chatid = `${conv.contact_phone}@s.whatsapp.net`;
      // Try to fetch profile picture (best-effort)
      try {
        const pic = await uaz("/chat/GetNameAndImageURL", {
          token: existing.instance_token,
          body: { number: conv.contact_phone },
        });
        const pd = (pic.data ?? {}) as Record<string, unknown>;
        const url = (pd.image as string) || (pd.imageUrl as string) || (pd.profilePicUrl as string) || null;
        const nm = (pd.name as string) || null;
        if (url || nm) {
          await admin.from("whatsapp_conversations").update({
            ...(url ? { avatar_url: url } : {}),
            ...(nm && !conv.contact_name ? { contact_name: nm } : {}),
          }).eq("id", conversationId);
        }
      } catch (_e) { /* ignore */ }

      const msgRes = await uaz("/message/find", {
        token: existing.instance_token,
        body: {
          operator: "AND",
          chatid,
          limit: limit ?? 50,
          sort: "-messageTimestamp",
        },
      });
      if (!msgRes.ok) {
        console.error("load_messages /message/find failed", msgRes.status, msgRes.data);
        return json({ error: "uazapi /message/find failed", status: msgRes.status, detail: msgRes.data }, 502);
      }
      const rawList = Array.isArray(msgRes.data)
        ? (msgRes.data as Record<string, unknown>[])
        : Array.isArray((msgRes.data as Record<string, unknown>)?.messages)
          ? ((msgRes.data as Record<string, unknown>).messages as Record<string, unknown>[])
          : [];
      console.log("load_messages: received", rawList.length);

      let saved = 0;
      const errors: string[] = [];
      // Process oldest -> newest
      const ordered = [...rawList].reverse();
      for (const m of ordered) {
        try {
          const waId = (m.messageid as string) || (m.id as string) || (m.key_id as string) || null;
          if (!waId) continue;
          const { data: dup } = await admin
            .from("whatsapp_messages")
            .select("id")
            .eq("conversation_id", conversationId)
            .eq("wa_message_id", waId)
            .maybeSingle();
          if (dup) continue;

          const fromMe = Boolean(m.fromMe ?? m.fromme ?? m.key_fromMe);
          const direction = fromMe ? "outbound" : "inbound";
          const type = (m.messageType as string) || (m.type as string) || "text";
          const content = (m.text as string)
            || (m.content as string)
            || (m.body as string)
            || (m.caption as string)
            || null;
          const mediaUrl = (m.mediaUrl as string) || (m.fileURL as string) || null;
          const rawTs = Number(m.messageTimestamp ?? m.timestamp ?? 0);
          const tsMs = rawTs > 1e12 ? rawTs : rawTs * 1000;
          const createdAt = tsMs ? new Date(tsMs).toISOString() : new Date().toISOString();

          const { error: insErr } = await admin.from("whatsapp_messages").insert({
            workspace_id: workspaceId,
            instance_id: existing.id,
            conversation_id: conversationId,
            wa_message_id: waId,
            direction,
            type,
            content,
            media_url: mediaUrl,
            status: "sent",
            created_at: createdAt,
          });
          if (insErr) throw insErr;
          saved++;
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          console.error("load_messages msg error", msg);
          errors.push(msg);
        }
      }
      return json({ ok: true, total: rawList.length, saved, errors: errors.slice(0, 5) });
    }

    if (action === "send") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      const { conversationId, text } = body as { conversationId?: string; text?: string };
      if (!conversationId || !text?.trim()) return json({ error: "conversationId and text are required" }, 400);
      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!conv) return json({ error: "Conversation not found" }, 404);

      const send = await uaz("/send/text", {
        token: existing.instance_token,
        body: { number: conv.contact_phone, text },
      });
      const sd = (send.data ?? {}) as Record<string, unknown>;
      const waMessageId = (sd.messageid as string) || (sd.id as string) || null;

      const { data: inserted } = await admin.from("whatsapp_messages").insert({
        workspace_id: workspaceId,
        instance_id: existing.id,
        conversation_id: conversationId,
        wa_message_id: waMessageId,
        direction: "outbound",
        type: "text",
        content: text,
        status: send.ok ? "sent" : "error",
        error: send.ok ? null : JSON.stringify(sd).slice(0, 500),
      }).select().single();

      await admin.from("whatsapp_conversations").update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      return json({ ok: send.ok, message: inserted });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("whatsapp-instance error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
