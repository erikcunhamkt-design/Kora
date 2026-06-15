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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // GET = verification handshake from Meta
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

  const entries = payload?.entry ?? [];
  for (const entry of entries) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      const metadata = value.metadata ?? {};
      const phoneNumberId = metadata.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: cred } = await admin
        .from("whatsapp_official_credentials")
        .select("id, workspace_id, app_secret")
        .eq("phone_number_id", phoneNumberId)
        .maybeSingle();
      if (!cred) continue;

      if (cred.app_secret) {
        const ok = await verifySignature(raw, req.headers.get("x-hub-signature-256"), cred.app_secret);
        if (!ok) {
          console.warn("[wa-official-webhook] invalid signature", phoneNumberId);
          continue;
        }
      }

      for (const msg of value.messages ?? []) {
        const from = msg.from as string;
        const messageId = msg.id as string;
        const ts = new Date(Number(msg.timestamp) * 1000).toISOString();
        const text = msg.text?.body ?? msg[msg.type]?.caption ?? null;

        // Upsert conversation by phone
        const { data: conv } = await admin
          .from("whatsapp_conversations")
          .upsert({
            workspace_id: cred.workspace_id,
            phone: from,
            last_message_at: ts,
            last_message_preview: text?.slice(0, 200) ?? `[${msg.type}]`,
          }, { onConflict: "workspace_id,phone" })
          .select("id")
          .single();

        if (conv) {
          await admin.from("whatsapp_messages").insert({
            workspace_id: cred.workspace_id,
            conversation_id: conv.id,
            external_id: messageId,
            direction: "inbound",
            type: msg.type ?? "text",
            content: text,
            status: "received",
            sent_at: ts,
          });
        }
      }
    }
  }

  return new Response("ok", { status: 200 });
});
