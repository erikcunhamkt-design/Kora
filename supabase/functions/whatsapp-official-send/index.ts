import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_BASE = "https://graph.facebook.com/v19.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { workspaceId, to, text } = body as { workspaceId: string; to: string; text: string };
    if (!workspaceId || !to || !text) return json({ error: "workspaceId, to and text are required" }, 400);

    const { data: member } = await userClient
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", claims.claims.sub)
      .maybeSingle();
    if (!member) return json({ error: "Forbidden" }, 403);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: cred } = await admin
      .from("whatsapp_official_credentials")
      .select("phone_number_id, access_token")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!cred) return json({ error: "Credenciais não configuradas" }, 400);

    const res = await fetch(`${GRAPH_BASE}/${cred.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const data = await res.json();
    if (!res.ok) return json({ error: data?.error?.message ?? "Falha ao enviar", details: data }, 400);

    const messageId = data?.messages?.[0]?.id ?? null;
    const nowIso = new Date().toISOString();

    // Ensure instance row
    let instanceId: string | null = null;
    const { data: inst } = await admin
      .from("whatsapp_instances")
      .select("id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (inst) instanceId = inst.id;
    else {
      const { data: created } = await admin
        .from("whatsapp_instances")
        .insert({ workspace_id: workspaceId, provider: "official", status: "connected" })
        .select("id").single();
      instanceId = created?.id ?? null;
    }
    if (!instanceId) return json({ ok: true, messageId, warning: "no instance row" });

    // Upsert conversation
    let convId: string | null = null;
    const { data: existingConv } = await admin
      .from("whatsapp_conversations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("contact_phone", to)
      .maybeSingle();
    if (existingConv) {
      convId = existingConv.id;
      await admin.from("whatsapp_conversations")
        .update({ last_message: text.slice(0, 200), last_message_at: nowIso })
        .eq("id", convId);
    } else {
      const { data: createdConv } = await admin
        .from("whatsapp_conversations")
        .insert({
          workspace_id: workspaceId,
          instance_id: instanceId,
          contact_phone: to,
          last_message: text.slice(0, 200),
          last_message_at: nowIso,
        })
        .select("id").single();
      convId = createdConv?.id ?? null;
    }

    if (convId) {
      await admin.from("whatsapp_messages").insert({
        workspace_id: workspaceId,
        instance_id: instanceId,
        conversation_id: convId,
        wa_message_id: messageId,
        direction: "outbound",
        type: "text",
        body: text,
        content: text,
        status: "sent",
        timestamp: nowIso,
      });
    }

    return json({ ok: true, messageId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
