// Processes whatsapp_queue (campaign rows) with anti-ban delays.
// Trigger via cron (e.g., every minute). Each invocation picks up to BATCH rows
// whose scheduled_at <= now() and status='pending', sends them with random
// 30-90s gaps, and schedules the next batch.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUBDOMAIN = (Deno.env.get("UAZAPI_SUBDOMAIN") ?? "").trim().replace(/\/+$/, "");

const UAZ_BASE = (() => {
  if (!SUBDOMAIN) return "https://free.uazapi.com";
  if (/^https?:\/\//i.test(SUBDOMAIN)) return SUBDOMAIN;
  if (SUBDOMAIN.includes(".")) return `https://${SUBDOMAIN}`;
  return `https://${SUBDOMAIN}.uazapi.com`;
})();

// Anti-ban tuning
const MIN_DELAY_MS = 30_000;   // 30s
const MAX_DELAY_MS = 90_000;   // 90s
const BATCH = 5;               // messages per invocation
const TYPING_MIN_MS = 1500;
const TYPING_MAX_MS = 4000;

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function renderTemplate(tpl: string, vars: Record<string, unknown> | null, recipientName?: string | null) {
  let out = tpl ?? "";
  const merged: Record<string, unknown> = { ...(vars ?? {}) };
  if (recipientName && merged.name == null) merged.name = recipientName;
  if (recipientName && merged.nome == null) merged.nome = recipientName;
  for (const [k, v] of Object.entries(merged)) {
    out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), String(v ?? ""));
  }
  return out;
}

interface QueueRow {
  id: string;
  campaign_id: string;
  workspace_id: string;
  phone: string;
  recipient_name: string | null;
  variables: Record<string, unknown> | null;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Fetch due rows
    const { data: rows, error: rowsErr } = await admin
      .from("whatsapp_queue")
      .select("*")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(BATCH);

    if (rowsErr) return json({ error: rowsErr.message }, 500);
    if (!rows || rows.length === 0) return json({ ok: true, processed: 0 });

    // Group by campaign for shared instance/template lookup
    const campaignCache = new Map<string, { template: string; workspace_id: string }>();
    const instanceCache = new Map<string, { id: string; instance_token: string; status: string } | null>();

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as QueueRow;

      // Mark as sending to avoid double pick-up by concurrent runs
      const { error: lockErr } = await admin
        .from("whatsapp_queue")
        .update({ status: "sending" })
        .eq("id", row.id)
        .eq("status", "pending");
      if (lockErr) {
        console.error("[campaign] lock error", lockErr.message);
        continue;
      }

      try {
        // Load campaign template
        let campaign = campaignCache.get(row.campaign_id);
        if (!campaign) {
          const { data: c } = await admin
            .from("whatsapp_campaigns")
            .select("message_template, workspace_id")
            .eq("id", row.campaign_id)
            .maybeSingle();
          if (!c) throw new Error("campaign not found");
          campaign = { template: c.message_template ?? "", workspace_id: c.workspace_id };
          campaignCache.set(row.campaign_id, campaign);
        }

        // Load workspace instance
        let instance = instanceCache.get(row.workspace_id);
        if (instance === undefined) {
          const { data: ins } = await admin
            .from("whatsapp_instances")
            .select("id, instance_token, status")
            .eq("workspace_id", row.workspace_id)
            .maybeSingle();
          instance = ins ?? null;
          instanceCache.set(row.workspace_id, instance);
        }
        if (!instance || instance.status !== "connected") {
          throw new Error("instance not connected");
        }

        const text = renderTemplate(campaign.template, row.variables, row.recipient_name);
        const cleanPhone = String(row.phone).replace(/\D/g, "");
        if (!cleanPhone) throw new Error("invalid phone");

        // Simulate typing (anti-ban)
        const typingMs = rand(TYPING_MIN_MS, TYPING_MAX_MS);
        try {
          await fetch(`${UAZ_BASE}/send/presence`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instance.instance_token },
            body: JSON.stringify({ number: cleanPhone, presence: "composing", delay: typingMs }),
          });
        } catch { /* best effort */ }
        await sleep(typingMs);

        // Send
        const sendRes = await fetch(`${UAZ_BASE}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: instance.instance_token },
          body: JSON.stringify({ number: cleanPhone, text }),
        });
        const sendText = await sendRes.text();

        if (!sendRes.ok) {
          throw new Error(`uazapi ${sendRes.status}: ${sendText.slice(0, 200)}`);
        }

        let sendData: Record<string, unknown> = {};
        try { sendData = JSON.parse(sendText); } catch { /* keep */ }
        const waMessageId = (sendData.messageid as string) || (sendData.id as string) || null;

        // Log as outbound message + ensure conversation exists
        const { data: conv } = await admin
          .from("whatsapp_conversations")
          .select("id")
          .eq("instance_id", instance.id)
          .eq("contact_phone", cleanPhone)
          .maybeSingle();

        let conversationId = conv?.id as string | undefined;
        if (!conversationId) {
          const { data: newConv } = await admin
            .from("whatsapp_conversations")
            .insert({
              workspace_id: row.workspace_id,
              instance_id: instance.id,
              contact_phone: cleanPhone,
              contact_name: row.recipient_name,
              last_message: text,
              last_message_at: new Date().toISOString(),
              unread_count: 0,
              status: "open",
            })
            .select("id")
            .single();
          conversationId = newConv?.id;
        } else {
          await admin.from("whatsapp_conversations").update({
            last_message: text,
            last_message_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", conversationId);
        }

        if (conversationId) {
          await admin.from("whatsapp_messages").insert({
            workspace_id: row.workspace_id,
            instance_id: instance.id,
            conversation_id: conversationId,
            wa_message_id: waMessageId,
            direction: "outbound",
            type: "text",
            content: text,
            body: text,
            status: "sent",
            timestamp: new Date().toISOString(),
          });
        }

        await admin.from("whatsapp_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", row.id);

        await admin.rpc("update_timestamp"); // no-op safety; ignore if not callable
        await admin.from("whatsapp_campaigns").update({
          sent_contacts: (await admin
            .from("whatsapp_queue")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", row.campaign_id)
            .eq("status", "sent")).count ?? 0,
          status: "running",
        }).eq("id", row.campaign_id);

        sent++;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        console.error("[campaign] send error", row.id, msg);
        await admin.from("whatsapp_queue").update({
          status: "failed",
          error_message: msg.slice(0, 500),
        }).eq("id", row.id);
        await admin.from("whatsapp_campaigns").update({
          failed_contacts: (await admin
            .from("whatsapp_queue")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", row.campaign_id)
            .eq("status", "failed")).count ?? 0,
        }).eq("id", row.campaign_id);
        failed++;
      }

      processed++;

      // Anti-ban random gap between sends (except after the last one)
      if (i < rows.length - 1) {
        await sleep(rand(MIN_DELAY_MS, MAX_DELAY_MS));
      }
    }

    // Mark campaigns as completed when no pending rows remain
    const campaignIds = Array.from(new Set(rows.map((r) => r.campaign_id)));
    for (const cid of campaignIds) {
      const { count: pendingCount } = await admin
        .from("whatsapp_queue")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", cid)
        .in("status", ["pending", "sending"]);
      if ((pendingCount ?? 0) === 0) {
        await admin.from("whatsapp_campaigns").update({ status: "completed" }).eq("id", cid);
      }
    }

    return json({ ok: true, processed, sent, failed });
  } catch (e) {
    console.error("[campaign] fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
