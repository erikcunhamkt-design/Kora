import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = signatureHeader.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return hex === expected;
}

async function ensureOfficialInstance(workspaceId: string): Promise<string | null> {
  const { data: existing } = await admin
    .from("whatsapp_instances")
    .select("id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (existing) return existing.id;
  const { data: created } = await admin
    .from("whatsapp_instances")
    .insert({ workspace_id: workspaceId, provider: "official", status: "connected" })
    .select("id")
    .single();
  return created?.id ?? null;
}

async function upsertConversation(workspaceId: string, instanceId: string, phone: string, preview: string, ts: string) {
  const { data: existing } = await admin
    .from("whatsapp_conversations")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("contact_phone", phone)
    .maybeSingle();
  if (existing) {
    await admin
      .from("whatsapp_conversations")
      .update({ last_message: preview, last_message_at: ts })
      .eq("id", existing.id);
    return existing.id;
  }
  const { data: created } = await admin
    .from("whatsapp_conversations")
    .insert({
      workspace_id: workspaceId,
      instance_id: instanceId,
      contact_phone: phone,
      last_message: preview,
      last_message_at: ts,
    })
    .select("id")
    .single();
  return created?.id ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode !== "subscribe" || !token) return new Response("Bad Request", { status: 400 });
    const { data } = await admin
      .from("whatsapp_official_credentials")
      .select("id")
      .eq("verify_token", token)
      .maybeSingle();
    if (!data) return new Response("Forbidden", { status: 403 });
    return new Response(challenge ?? "", { status: 200 });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const phoneNumberId = value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: cred } = await admin
        .from("whatsapp_official_credentials")
        .select("workspace_id, app_secret")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!cred) continue;

      if (!cred.app_secret) {
        console.warn("missing app_secret; refusing webhook entry", phoneNumberId);
        continue;
      }
      const ok = await verifySignature(raw, req.headers.get("x-hub-signature-256"), cred.app_secret);
      if (!ok) { console.warn("invalid signature", phoneNumberId); continue; }

      const instanceId = await ensureOfficialInstance(cred.workspace_id);
      if (!instanceId) continue;

      for (const msg of value.messages ?? []) {
        const from = msg.from as string;
        const messageId = msg.id as string;
        const ts = new Date(Number(msg.timestamp) * 1000).toISOString();
        const text = msg.text?.body ?? msg[msg.type]?.caption ?? null;
        const preview = text?.slice(0, 200) ?? `[${msg.type}]`;
        const convId = await upsertConversation(cred.workspace_id, instanceId, from, preview, ts);
        if (!convId) continue;
        await admin.from("whatsapp_messages").insert({
          workspace_id: cred.workspace_id,
          instance_id: instanceId,
          conversation_id: convId,
          wa_message_id: messageId,
          direction: "inbound",
          type: msg.type ?? "text",
          body: text,
          content: text,
          status: "received",
          timestamp: ts,
          raw_payload: msg,
        });
      }
    }
  }

  return new Response("ok", { status: 200 });
});
