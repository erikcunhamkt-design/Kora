// Generates an AI reply for an inbound WhatsApp message.
// If the workspace has configured its own Vertex AI credentials, uses Vertex.
// Otherwise falls back to Lovable AI Gateway (Gemini).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  callVertexGenerate,
  type VertexChatMessage,
  type VertexServiceAccount,
} from "../_shared/vertex.ts";

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

const DEFAULT_LOVABLE_MODEL = "google/gemini-3-flash-preview";
const DEFAULT_VERTEX_MODEL = "gemini-2.0-flash-001";
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

    const { data: bot, error: botErr } = await admin
      .from("whatsapp_bot_settings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (botErr) console.error("[bot-reply] bot settings query error", botErr);
    if (!bot || !bot.is_active) {
      console.log("[bot-reply] skip: bot inactive", { workspaceId, hasRow: !!bot });
      return json({ ok: true, skipped: "bot inactive" });
    }

    const { data: conv, error: convErr } = await admin
      .from("whatsapp_conversations")
      .select("id, workspace_id, instance_id, contact_phone, assigned_to")
      .eq("id", conversationId)
      .maybeSingle();
    if (convErr) console.error("[bot-reply] conv query error", convErr);
    if (!conv) {
      console.log("[bot-reply] skip: conversation not found", { conversationId });
      return json({ error: "conversation not found" }, 404);
    }
    if (conv.assigned_to) {
      console.log("[bot-reply] skip: assigned to human", { conversationId, assigned_to: conv.assigned_to });
      return json({ ok: true, skipped: "assigned" });
    }

    const { data: instance, error: instErr } = await admin
      .from("whatsapp_instances")
      .select("id, instance_token, status")
      .eq("id", (conv as { instance_id: string }).instance_id)
      .maybeSingle();
    if (instErr) console.error("[bot-reply] instance query error", instErr);
    if (!instance) {
      console.log("[bot-reply] skip: instance not found", { instance_id: (conv as { instance_id: string }).instance_id });
      return json({ ok: true, skipped: "instance not found" });
    }
    if (instance.status !== "connected") {
      console.log("[bot-reply] skip: instance not connected", { status: instance.status });
      return json({ ok: true, skipped: "instance not connected" });
    }

    // Opt-out check
    const { data: optOut } = await admin
      .from("whatsapp_opt_outs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("normalized_phone", (conv as { contact_phone: string }).contact_phone)
      .maybeSingle();
    if (optOut) {
      console.log("[bot-reply] skip: contact opted out");
      return json({ ok: true, skipped: "opt-out" });
    }

    // Debounce: don't reply if we already sent something in the last 4 seconds
    const { data: lastOut } = await admin
      .from("whatsapp_messages")
      .select("created_at")
      .eq("conversation_id", conversationId)
      .eq("direction", "outbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastOut && Date.now() - new Date(lastOut.created_at as string).getTime() < 4000) {
      console.log("[bot-reply] skip: debounce (recent outbound)");
      return json({ ok: true, skipped: "debounce" });
    }

    const { data: history } = await admin
      .from("whatsapp_messages")
      .select("direction, content, body, type, timestamp, created_at")
      .eq("conversation_id", conversationId)
      .order("timestamp", { ascending: false, nullsFirst: false })
      .limit(MAX_HISTORY);

    const ordered = (history ?? []).slice().reverse();
    const systemPrompt = bot.system_instruction ||
      "Você é um atendente cordial e prestativo. Responda de forma clara, breve e em português.";

    const messages: VertexChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...ordered.map((m) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.content || m.body || (m.type ? `[${m.type}]` : ""),
      })).filter((m) => m.content),
    ];

    // Check for workspace Vertex credentials
    const { data: vertexCreds } = await admin
      .from("workspace_ai_credentials")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", "vertex")
      .eq("is_active", true)
      .maybeSingle();

    let reply: string | undefined;
    let provider = "lovable";

    if (vertexCreds) {
      try {
        const sa = vertexCreds.credentials_json as unknown as VertexServiceAccount;
        // When Vertex is active, always use the model chosen in the Vertex integration card.
        // The bot's model_name (e.g. "gemini-1.5-flash") may not be a valid Vertex model id.
        const model = vertexCreds.default_model || DEFAULT_VERTEX_MODEL;
        console.log("[bot-reply] using Vertex AI", { model, location: vertexCreds.location });
        reply = await callVertexGenerate({
          serviceAccount: sa,
          location: vertexCreds.location || "us-central1",
          model,
          messages,
        });
        provider = "vertex";
      } catch (e) {
        console.error("[bot-reply] Vertex failed, falling back to Lovable:", (e as Error).message);
      }
    }

    if (!reply) {
      // Fallback to Lovable AI Gateway
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_LOVABLE_MODEL,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
      reply = aiData.choices?.[0]?.message?.content?.trim();
    }

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

    return json({ ok: sendRes.ok, reply, provider });
  } catch (e) {
    console.error("[bot-reply] error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
