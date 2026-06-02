// Generates an AI reply (Lovable AI / Gemini) for an inbound WhatsApp message
// and sends it back via uazapi. Invoked fire-and-forget by whatsapp-webhook.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUBDOMAIN = (Deno.env.get("UAZAPI_SUBDOMAIN") ?? "").trim().replace(/\/+$/, "");

const UAZ_BASE = (() => {
  if (!SUBDOMAIN) return "https://free.uazapi.com";
  if (/^https?:\/\//i.test(SUBDOMAIN)) return SUBDOMAIN;
  if (SUBDOMAIN.includes(".")) return `https://${SUBDOMAIN}`;
  return `https://${SUBDOMAIN}.uazapi.com`;
})();

const DEFAULT_MODEL = "google/gemini-3-flash-preview";
const MAX_HISTORY = 12;

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { conversationId, workspaceId } = await req.json() as {
      conversationId?: string;
      workspaceId?: string;
    };
    if (!conversationId || !workspaceId) return json({ error: "missing params" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Bot settings
    const { data: bot } = await admin
      .from("whatsapp_bot_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!bot || !bot.is_active) return json({ ok: true, skipped: "bot inactive" });

    // Conversation + instance
    const { data: conv } = await admin
      .from("whatsapp_conversations")
      .select("*, whatsapp_instances!inner(instance_token, status)")
      .eq("id", conversationId)
      .maybeSingle();
    if (!conv) return json({ error: "conversation not found" }, 404);

    // Don't auto-reply if an attendant took over
    if (conv.assigned_to) return json({ ok: true, skipped: "assigned" });

    const instance = (conv as { whatsapp_instances: { instance_token: string; status: string } }).whatsapp_instances;
    if (!instance || instance.status !== "connected") return json({ ok: true, skipped: "instance not connected" });

    // Load recent message history
    const { data: history } = await admin
      .from("whatsapp_messages")
      .select("direction, content, body, type, timestamp, created_at")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: false, nullsFirst: false })
      .limit(MAX_HISTORY);

    const ordered = (history ?? []).slice().reverse();
    const messages = [
      {
        role: "system",
        content: bot.system_instruction ||
          "Você é um atendente cordial e prestativo. Responda de forma clara, breve e em português.",
      },
      ...ordered.map((m) => ({
        role: m.direction === "inbound" ? "user" : "assistant",
        content: m.content || m.body || (m.type ? `[${m.type}]` : ""),
      })).filter((m) => m.content),
    ];

    // Call Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: bot.model_name || DEFAULT_MODEL,
        messages,
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      console.error("[bot-reply] AI error", aiRes.status, detail);
      if (aiRes.status === 429) return json({ error: "rate-limited" }, 429);
      if (aiRes.status === 402) return json({ error: "credits exhausted" }, 402);
      return json({ error: "ai gateway failed", status: aiRes.status }, 502);
    }

    const aiData = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
    const reply = aiData.choices?.[0]?.message?.content?.trim();
    if (!reply) return json({ ok: true, skipped: "empty reply" });

    // Send via uazapi
    const sendRes = await fetch(`${UAZ_BASE}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instance.instance_token },
      body: JSON.stringify({ number: conv.contact_phone, text: reply }),
    });
    const sendText = await sendRes.text();
    let sendData: Record<string, unknown> = {};
    try { sendData = JSON.parse(sendText); } catch { /* keep */ }
    const waMessageId = (sendData.messageid as string) || (sendData.id as string) || null;

    await admin.from("whatsapp_messages").insert({
      workspace_id: workspaceId,
      instance_id: (conv as { instance_id: string }).instance_id,
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction: "outbound",
      type: "text",
      content: reply,
      body: reply,
      status: sendRes.ok ? "sent" : "error",
      error: sendRes.ok ? null : sendText.slice(0, 500),
      timestamp: new Date().toISOString(),
    });

    await admin.from("whatsapp_conversations").update({
      last_message: reply,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);

    return json({ ok: sendRes.ok, reply });
  } catch (e) {
    console.error("[bot-reply] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
