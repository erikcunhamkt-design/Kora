import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("UAZAPI_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");
    const workspaceId = url.searchParams.get("workspace");
    if (!secret || secret !== WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json().catch(() => ({} as Record<string, unknown>));
    const event = String((payload as Record<string, unknown>).event ?? "");
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Case-insensitive event matching: the API sends lowercase ("message")
    if (event.toLowerCase() !== "message") {
      // Not a message event — ack and exit (we may handle connection/messages_update later)
      return new Response(JSON.stringify({ ok: true, ignored: true, event }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist incoming message minimally; refine schema as needed
    await admin.from("whatsapp_messages").insert({
      workspace_id: workspaceId,
      payload,
    }).select().maybeSingle().then(() => null).catch(() => null);

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
