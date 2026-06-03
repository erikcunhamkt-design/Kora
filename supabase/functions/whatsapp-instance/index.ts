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

function baseForStoredSubdomain(input: string | null | undefined) {
  const raw = (input ?? SUBDOMAIN ?? "free").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const host = raw.split("/")[0] || "free";
  if (host.includes(".")) return `https://${host}`;
  return `https://${host}.uazapi.com`;
}

async function uazForInstance(instance: Record<string, unknown>, path: string, opts: { method?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    token: String(instance.instance_token ?? ""),
  };
  const res = await fetch(`${baseForStoredSubdomain(instance.subdomain as string | null | undefined)}${path}`, {
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
      await uazForInstance(instance, "/webhook", {
        body: {
          webhookURL: webhookUrl,
          url: webhookUrl,
          enabled: true,
          events: ["messages", "messages_update", "connection"],
        },
      }).catch(() => null);

      // Request QR
      const connect = await uazForInstance(instance, "/instance/connect", { body: {} });
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
      const st = await uazForInstance(existing, "/instance/status", { method: "GET" });
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
      await uazForInstance(existing, "/instance/disconnect", { body: {} }).catch(() => null);
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
      await uazForInstance(existing, "/instance/disconnect", { body: {} }).catch(() => null);
      await uaz("/instance/delete", { admin: true, body: { token: existing.instance_token } }).catch(() => null);
      await admin.from("whatsapp_instances").delete().eq("id", existing.id);
      return json({ ok: true });
    }

    if (action === "import") {
      const { token: importToken, subdomain: importSubdomain } = body as {
        token?: string;
        subdomain?: string;
      };
      if (!importToken || importToken.trim().length < 8) {
        return json({ error: "token é obrigatório" }, 400);
      }
      const sub = normalizeSubdomain(importSubdomain);
      const baseUrl = baseForSubdomain(sub);

      // Valida o token consultando /instance/status no servidor informado
      const statusRes = await fetch(`${baseUrl}/instance/status`, {
        method: "GET",
        headers: { "Content-Type": "application/json", token: importToken },
      });
      const statusText = await statusRes.text();
      let statusData: unknown = statusText;
      try { statusData = JSON.parse(statusText); } catch { /* keep */ }
      if (!statusRes.ok) {
        return json({ error: "uazapi /instance/status falhou", status: statusRes.status, detail: statusData }, 502);
      }
      const sd = (statusData ?? {}) as Record<string, unknown>;
      const inst = (sd.instance ?? sd) as Record<string, unknown>;
      const remoteStatus = (inst.status as string | undefined) ?? "disconnected";
      const phone = (inst.owner as string | undefined) ?? (inst.phone as string | undefined) ?? null;
      const phoneName = (inst.profileName as string | undefined) ?? (inst.name as string | undefined) ?? null;
      const instanceName = (inst.name as string | undefined) ?? `imported-${importToken.slice(0, 8)}`;
      // uazapi às vezes aceita o "id" da instância em /instance/status mas exige
      // o token real (devolvido em instance.token) nas demais rotas. Preferir esse.
      const resolvedToken =
        ((inst.token as string | undefined) ??
          (sd.token as string | undefined) ??
          importToken).trim();

      // Remove instância existente (se houver) sem deletar do uazapi (token é compartilhado/externo)
      if (existing) {
        await admin.from("whatsapp_instances").delete().eq("id", existing.id);
      }

      const { data: inserted, error: insertErr } = await admin
        .from("whatsapp_instances")
        .insert({
          workspace_id: workspaceId,
          instance_token: resolvedToken,
          instance_name: instanceName,
          subdomain: sub,
          status: remoteStatus,
          phone,
          phone_name: phoneName,
          connected_at: remoteStatus === "connected" ? new Date().toISOString() : null,
          last_status_at: new Date().toISOString(),
          created_by: userId,
        })
        .select()
        .single();
      if (insertErr) return json({ error: insertErr.message }, 500);

      // Registra webhook apontando para o nosso endpoint
      const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?secret=${encodeURIComponent(WEBHOOK_SECRET)}&workspace=${workspaceId}`;
      await fetch(`${baseUrl}/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: resolvedToken },
        body: JSON.stringify({
          webhookURL: webhookUrl,
          url: webhookUrl,
          enabled: true,
          events: ["messages", "messages_update", "connection"],
        }),
      }).catch(() => null);

      // Se desconectado, pede QR
      if (remoteStatus !== "connected") {
        const connectRes = await fetch(`${baseUrl}/instance/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: resolvedToken },
          body: JSON.stringify({}),
        });
        const cText = await connectRes.text();
        let cData: unknown = cText;
        try { cData = JSON.parse(cText); } catch { /* keep */ }
        const cdata = (cData ?? {}) as Record<string, unknown>;
        const qr = (cdata.qrcode ?? cdata.qr ?? (cdata.instance as Record<string, unknown>)?.qrcode) as string | undefined;
        const newStatus = ((cdata.status ?? (cdata.instance as Record<string, unknown>)?.status) as string | undefined) ?? "connecting";
        const { data: updated } = await admin
          .from("whatsapp_instances")
          .update({ qr_code: qr ?? null, status: newStatus, last_status_at: new Date().toISOString() })
          .eq("id", inserted.id)
          .select()
          .single();
        return json({ instance: updated, imported: true });
      }

      return json({ instance: inserted, imported: true });
    }


    if (action === "sync") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      // Fetch chat list from uazapi and upsert conversations
      const list = await uazForInstance(existing, "/chat/find", {
        body: { operator: "AND", sort: "-wa_lastMsgTimestamp" },
      });
      if (!list.ok) {
        console.error("sync /chat/find failed", list.status, list.data);
        if (list.status === 401) {
          // Token uazapi inválido — marcar como desconectado para forçar reconexão
          await admin
            .from("whatsapp_instances")
            .update({ status: "disconnected", last_status_at: new Date().toISOString() })
            .eq("id", existing.id);
          return json({ synced: 0, needs_reconnect: true, message: "Sessão WhatsApp expirou. Reconecte a instância." });
        }
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

    if (action === "refresh_avatars") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      const { limit, force } = body as { limit?: number; force?: boolean };
      const max = Math.min(Math.max(Number(limit ?? 200), 1), 500);
      let query = admin
        .from("whatsapp_conversations")
        .select("id, contact_phone, contact_name, avatar_url")
        .eq("instance_id", existing.id)
        .eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(max);
      if (!force) query = query.is("avatar_url", null);
      const { data: convs } = await query;
      const list = convs ?? [];
      let updated = 0;
      const concurrency = 6;
      let idx = 0;
      const worker = async () => {
        while (idx < list.length) {
          const i = idx++;
          const c = list[i];
          try {
            const pic = await uazForInstance(existing, "/chat/GetNameAndImageURL", {
              body: { number: c.contact_phone },
            });
            const pd = (pic.data ?? {}) as Record<string, unknown>;
            const url = (pd.image as string) || (pd.imageUrl as string) || (pd.profilePicUrl as string) || null;
            const nm = (pd.name as string) || null;
            const patch: Record<string, unknown> = {};
            if (url) patch.avatar_url = url;
            if (nm && !c.contact_name) patch.contact_name = nm;
            if (Object.keys(patch).length > 0) {
              await admin.from("whatsapp_conversations").update(patch).eq("id", c.id);
              if (url) updated++;
            }
          } catch (_e) { /* ignore individual failures */ }
        }
      };
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      console.log("refresh_avatars:", { total: list.length, updated });
      return json({ ok: true, total: list.length, updated });
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
        const pic = await uazForInstance(existing, "/chat/GetNameAndImageURL", {
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

      const msgRes = await uazForInstance(existing, "/message/find", {
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

      // Helper to extract a usable media URL from many shapes uazapi can return.
      const extractMediaUrl = (m: Record<string, unknown>): string | null => {
        const direct =
          (m.mediaUrl as string) ||
          (m.fileURL as string) ||
          (m.file_url as string) ||
          (m.url as string) ||
          null;
        if (direct) return direct;
        const message = (m.message as Record<string, unknown>) || {};
        const candidates = [
          (message.imageMessage as Record<string, unknown>)?.url,
          (message.videoMessage as Record<string, unknown>)?.url,
          (message.audioMessage as Record<string, unknown>)?.url,
          (message.documentMessage as Record<string, unknown>)?.url,
          (message.stickerMessage as Record<string, unknown>)?.url,
          (m.image as Record<string, unknown>)?.url,
          (m.video as Record<string, unknown>)?.url,
          (m.audio as Record<string, unknown>)?.url,
          (m.document as Record<string, unknown>)?.url,
        ];
        for (const c of candidates) {
          if (typeof c === "string" && c) return c;
        }
        return null;
      };

      // Process oldest -> newest
      const ordered = [...rawList].reverse();

      // Build candidate rows + collect ids for one batched dedupe query
      type Row = {
        workspace_id: string;
        instance_id: string;
        conversation_id: string;
        wa_message_id: string;
        direction: string;
        type: string;
        content: string | null;
        media_url: string | null;
        status: string;
        created_at: string;
      };
      const candidates: Row[] = [];
      for (const m of ordered) {
        const waId =
          (m.messageid as string) ||
          (m.id as string) ||
          (m.key_id as string) ||
          null;
        if (!waId) continue;
        const fromMe = Boolean(m.fromMe ?? m.fromme ?? m.key_fromMe);
        const direction = fromMe ? "outbound" : "inbound";
        const type = (m.messageType as string) || (m.type as string) || "text";
        const content =
          (m.text as string) ||
          (m.content as string) ||
          (m.body as string) ||
          (m.caption as string) ||
          null;
        const mediaUrl = extractMediaUrl(m);
        const rawTs = Number(m.messageTimestamp ?? m.timestamp ?? 0);
        const tsMs = rawTs > 1e12 ? rawTs : rawTs * 1000;
        const createdAt = tsMs ? new Date(tsMs).toISOString() : new Date().toISOString();
        candidates.push({
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
      }

      let saved = 0;
      const errors: string[] = [];
      if (candidates.length > 0) {
        const ids = candidates.map((c) => c.wa_message_id);
        const { data: dup } = await admin
          .from("whatsapp_messages")
          .select("wa_message_id")
          .eq("conversation_id", conversationId)
          .in("wa_message_id", ids);
        const existingIds = new Set((dup ?? []).map((d: { wa_message_id: string }) => d.wa_message_id));
        const toInsert = candidates.filter((c) => !existingIds.has(c.wa_message_id));
        if (toInsert.length > 0) {
          // Chunked bulk insert to avoid payload limits
          const CHUNK = 200;
          for (let i = 0; i < toInsert.length; i += CHUNK) {
            const slice = toInsert.slice(i, i + CHUNK);
            const { error: insErr, count } = await admin
              .from("whatsapp_messages")
              .insert(slice, { count: "exact" });
            if (insErr) {
              console.error("load_messages bulk insert error", insErr.message);
              errors.push(insErr.message);
            } else {
              saved += count ?? slice.length;
            }
          }
        }
      }
      return json({ ok: true, total: rawList.length, saved, errors: errors.slice(0, 5) });
    }


    if (action === "send") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      const { conversationId, text, replyMessageId } = body as {
        conversationId?: string;
        text?: string;
        replyMessageId?: string | null;
      };
      if (!conversationId || !text?.trim()) return json({ error: "conversationId and text are required" }, 400);
      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!conv) return json({ error: "Conversation not found" }, 404);

      let replyWaId: string | null = null;
      if (replyMessageId) {
        const { data: rep } = await admin
          .from("whatsapp_messages")
          .select("wa_message_id")
          .eq("id", replyMessageId)
          .eq("workspace_id", workspaceId)
          .maybeSingle();
        replyWaId = (rep?.wa_message_id as string | null) ?? null;
      }

      const sendPayload: Record<string, unknown> = { number: conv.contact_phone, text };
      if (replyWaId) sendPayload.replyid = replyWaId;
      const send = await uazForInstance(existing, "/send/text", { body: sendPayload });
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
        reply_to_message_id: replyMessageId ?? null,
      }).select().single();

      await admin.from("whatsapp_conversations").update({
        last_message: text,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      return json({ ok: send.ok, message: inserted });
    }

    if (action === "react_message") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      const { messageId, emoji } = body as { messageId?: string; emoji?: string | null };
      if (!messageId) return json({ error: "messageId is required" }, 400);
      const { data: msg } = await admin
        .from("whatsapp_messages")
        .select("*")
        .eq("id", messageId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!msg) return json({ error: "Message not found" }, 404);
      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("contact_phone")
        .eq("id", msg.conversation_id)
        .maybeSingle();
      if (msg.wa_message_id && conv?.contact_phone) {
        try {
          await uazForInstance(existing, "/message/react", {
            body: { number: conv.contact_phone, id: msg.wa_message_id, text: emoji ?? "" },
          });
        } catch (_e) { /* swallow */ }
      }
      const reactions = (msg.reactions ?? {}) as Record<string, string>;
      if (emoji) reactions[userId] = emoji;
      else delete reactions[userId];
      await admin.from("whatsapp_messages").update({ reactions }).eq("id", messageId);
      return json({ ok: true, reactions });
    }

    if (action === "pin_message") {
      const { messageId, pinned } = body as { messageId?: string; pinned?: boolean };
      if (!messageId) return json({ error: "messageId is required" }, 400);
      await admin
        .from("whatsapp_messages")
        .update({ pinned_at: pinned ? new Date().toISOString() : null })
        .eq("id", messageId)
        .eq("workspace_id", workspaceId);
      return json({ ok: true });
    }

    if (action === "delete_message") {
      const { messageId, forEveryone } = body as { messageId?: string; forEveryone?: boolean };
      if (!messageId) return json({ error: "messageId is required" }, 400);
      const { data: msg } = await admin
        .from("whatsapp_messages")
        .select("*, conversation:conversation_id(contact_phone)")
        .eq("id", messageId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!msg) return json({ error: "Message not found" }, 404);

      // Try to revoke on WhatsApp if outbound and forEveryone
      if (forEveryone && msg.direction === "outbound" && msg.wa_message_id && msg.conversation?.contact_phone && existing) {
        try {
          await uazForInstance(existing, "/message/delete", {
            body: { number: msg.conversation.contact_phone, id: msg.wa_message_id },
          });
        } catch (_e) { /* swallow */ }
      }

      await admin
        .from("whatsapp_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", messageId)
        .eq("workspace_id", workspaceId);
      return json({ ok: true });
    }

    if (action === "forward_message") {
      if (!existing) return json({ error: "Instance not found" }, 404);
      const { messageId, targetConversationId } = body as { messageId?: string; targetConversationId?: string };
      if (!messageId || !targetConversationId) {
        return json({ error: "messageId and targetConversationId are required" }, 400);
      }
      const { data: msg } = await admin
        .from("whatsapp_messages")
        .select("*")
        .eq("id", messageId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!msg) return json({ error: "Message not found" }, 404);
      const { data: targetConv } = await admin
        .from("whatsapp_conversations")
        .select("contact_phone")
        .eq("id", targetConversationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!targetConv) return json({ error: "Target conversation not found" }, 404);

      // Forward text via uazapi
      if (msg.content) {
        const fwdText = msg.content;
        const send = await uazForInstance(existing, "/send/text", {
          body: { number: targetConv.contact_phone, text: fwdText },
        });
        const sd = (send.data ?? {}) as Record<string, unknown>;
        const waMessageId = (sd.messageid as string) || (sd.id as string) || null;
        await admin.from("whatsapp_messages").insert({
          workspace_id: workspaceId,
          instance_id: existing.id,
          conversation_id: targetConversationId,
          wa_message_id: waMessageId,
          direction: "outbound",
          type: "text",
          content: fwdText,
          status: send.ok ? "sent" : "error",
          error: send.ok ? null : JSON.stringify(sd).slice(0, 500),
          raw_payload: { forwarded_from_message_id: messageId },
        });
        await admin.from("whatsapp_conversations").update({
          last_message: fwdText,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", targetConversationId);
      }

      // Forward media via uazapi (best-effort)
      if (msg.media_url && msg.type && msg.type !== "text") {
        const send = await uazForInstance(existing, "/send/media", {
          body: { number: targetConv.contact_phone, type: msg.type, file: msg.media_url },
        });
        const sd = (send.data ?? {}) as Record<string, unknown>;
        const waMessageId = (sd.messageid as string) || (sd.id as string) || null;
        await admin.from("whatsapp_messages").insert({
          workspace_id: workspaceId,
          instance_id: existing.id,
          conversation_id: targetConversationId,
          wa_message_id: waMessageId,
          direction: "outbound",
          type: msg.type,
          content: msg.content ?? null,
          media_url: msg.media_url,
          status: send.ok ? "sent" : "error",
          error: send.ok ? null : JSON.stringify(sd).slice(0, 500),
          raw_payload: { forwarded_from_message_id: messageId },
        });
        await admin.from("whatsapp_conversations").update({
          last_message: msg.content ?? `[${msg.type}]`,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq("id", targetConversationId);
      }

      return json({ ok: true });
    }

    if (action === "archive_conversation") {
      const { conversationId, archived } = body as { conversationId?: string; archived?: boolean };
      if (!conversationId) return json({ error: "conversationId is required" }, 400);
      await admin
        .from("whatsapp_conversations")
        .update({ status: archived ? "archived" : "open", updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId);
      return json({ ok: true });
    }

    if (action === "mark_unread") {
      const { conversationId, unread } = body as { conversationId?: string; unread?: boolean };
      if (!conversationId) return json({ error: "conversationId is required" }, 400);
      await admin
        .from("whatsapp_conversations")
        .update({
          unread_count: unread ? 1 : 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId);
      return json({ ok: true });
    }

    if (action === "assign_conversation") {
      const { conversationId, userId: assignUserId } = body as { conversationId?: string; userId?: string | null };
      if (!conversationId) return json({ error: "conversationId is required" }, 400);
      await admin
        .from("whatsapp_conversations")
        .update({ assigned_to: assignUserId ?? null, updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId);
      return json({ ok: true });
    }

    if (action === "update_conversation_tags") {
      const { conversationId, tags } = body as { conversationId?: string; tags?: string[] };
      if (!conversationId) return json({ error: "conversationId is required" }, 400);
      await admin
        .from("whatsapp_conversations")
        .update({ tags: tags ?? [], updated_at: new Date().toISOString() })
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId);
      return json({ ok: true });
    }

      if (!existing) return json({ error: "Instance not found" }, 404);
      const { conversationId, kind, base64, mimeType, fileName, caption } = body as {
        conversationId?: string;
        kind?: string;
        base64?: string;
        mimeType?: string;
        fileName?: string;
        caption?: string;
      };
      if (!conversationId || !kind || !base64) {
        return json({ error: "conversationId, kind and base64 are required" }, 400);
      }
      const validKinds = ["image", "video", "audio", "document", "sticker"];
      if (!validKinds.includes(kind)) return json({ error: "invalid kind" }, 400);

      const { data: conv } = await admin
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conversationId)
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!conv) return json({ error: "Conversation not found" }, 404);

      // Strip data URL prefix if present
      const pureB64 = base64.includes(",") ? base64.split(",")[1] : base64;
      const dataUrl = mimeType ? `data:${mimeType};base64,${pureB64}` : pureB64;

      // uazapi /send/media accepts: { number, type: "image"|"video"|"document"|"audio", file (URL or base64), text (caption), docName }
      // Stickers go through /send/sticker
      let path = "/send/media";
      const payload: Record<string, unknown> = {
        number: conv.contact_phone,
        type: kind,
        file: dataUrl,
      };
      if (caption) payload.text = caption;
      if (fileName && kind === "document") payload.docName = fileName;

      if (kind === "sticker") {
        path = "/send/sticker";
        delete payload.type;
        delete payload.text;
      } else if (kind === "audio") {
        path = "/send/media";
        payload.type = "audio";
      }

      const send = await uazForInstance(existing, path, { body: payload });
      const sd = (send.data ?? {}) as Record<string, unknown>;
      const waMessageId = (sd.messageid as string) || (sd.id as string) || null;
      const returnedUrl = (sd.fileURL as string) || (sd.mediaUrl as string) || (sd.url as string) || null;

      const dbType = kind;
      const { data: inserted } = await admin.from("whatsapp_messages").insert({
        workspace_id: workspaceId,
        instance_id: existing.id,
        conversation_id: conversationId,
        wa_message_id: waMessageId,
        direction: "outbound",
        type: dbType,
        content: caption ?? null,
        media_url: returnedUrl,
        status: send.ok ? "sent" : "error",
        error: send.ok ? null : JSON.stringify(sd).slice(0, 500),
      }).select().single();

      await admin.from("whatsapp_conversations").update({
        last_message: caption ?? `[${kind}]`,
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", conversationId);

      if (!send.ok) {
        console.error("send_media failed", send.status, sd);
        return json({ error: "uazapi send failed", detail: sd, status: send.status }, 502);
      }
      return json({ ok: true, message: inserted });
    }

    if (action === "list_favorite_stickers") {
      const { data } = await admin
        .from("whatsapp_favorite_stickers")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      return json({ ok: true, stickers: data ?? [] });
    }

    if (action === "toggle_favorite_sticker") {
      const { stickerUrl, mimeType, op } = body as { stickerUrl?: string; mimeType?: string; op?: string };
      if (!stickerUrl) return json({ error: "stickerUrl is required" }, 400);
      if (op === "remove") {
        await admin
          .from("whatsapp_favorite_stickers")
          .delete()
          .eq("workspace_id", workspaceId)
          .eq("sticker_url", stickerUrl);
        return json({ ok: true, removed: true });
      }
      const { error: insErr } = await admin.from("whatsapp_favorite_stickers").insert({
        workspace_id: workspaceId,
        sticker_url: stickerUrl,
        mime_type: mimeType ?? null,
        created_by: userId,
      });
      if (insErr && !insErr.message.includes("duplicate")) {
        return json({ error: insErr.message }, 500);
      }
      return json({ ok: true, added: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("whatsapp-instance error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
