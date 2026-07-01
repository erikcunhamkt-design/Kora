// Processes whatsapp_queue (campaign rows) with anti-ban pacing.
//
// Design (Batch 3): the 30-90s anti-ban gap is enforced at the DB via a
// per-instance gate (whatsapp_instances.campaign_next_send_at), NOT by
// sleeping inside this function. Each cron tick (every minute) calls
// claim_campaign_messages(), which atomically hands back at most ONE due
// message per workspace whose gate is open, flips it to 'sending', and
// closes that instance's gate for a random 30-90s. We send those messages
// and return in seconds — no long-running invocation, no rows stranded in
// 'sending'. A reaper resets anything stuck (crash / legacy sleep-loop rows).
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";
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

// Anti-ban tuning. MIN/MAX delay is enforced DB-side (the gate); kept here to
// pass into the claim RPC. BATCH caps distinct-workspace sends per invocation
// so wall-clock stays bounded (BATCH x typing <= a few seconds).
const MIN_DELAY_S = 30;
const MAX_DELAY_S = 90;
const BATCH = 8;
const STUCK_CUTOFF_S = 300; // reset 'sending' rows older than 5min
const TYPING_MIN_MS = 1200;
const TYPING_MAX_MS = 2800;

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

interface ClaimedRow {
  id: string;
  campaign_id: string;
  workspace_id: string;
  phone: string;
  recipient_name: string | null;
  variables: Record<string, unknown> | null;
  instance_id: string;
  instance_token: string;
}

async function refreshCampaignCounts(admin: SupabaseClient, campaignId: string) {
  const [{ count: sentCount }, { count: failedCount }] = await Promise.all([
    admin.from("whatsapp_queue").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId).eq("status", "sent"),
    admin.from("whatsapp_queue").select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId).eq("status", "failed"),
  ]);
  await admin.from("whatsapp_campaigns").update({
    sent_contacts: sentCount ?? 0,
    failed_contacts: failedCount ?? 0,
    status: "running",
  }).eq("id", campaignId);
}

async function completeIfDrained(admin: SupabaseClient, campaignId: string) {
  const { count } = await admin
    .from("whatsapp_queue")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "sending"]);
  if ((count ?? 0) === 0) {
    await admin.from("whatsapp_campaigns").update({ status: "completed" }).eq("id", campaignId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) Self-heal: return rows stuck in 'sending' back to 'pending'.
    const { data: reaped } = await admin.rpc("reap_stuck_campaign_messages", {
      p_cutoff_s: STUCK_CUTOFF_S,
    });

    // 2) Claim at most one due message per workspace (gate-paced, atomic).
    const { data: claimed, error: claimErr } = await admin.rpc("claim_campaign_messages", {
      p_max_workspaces: BATCH,
      p_min_delay_s: MIN_DELAY_S,
      p_max_delay_s: MAX_DELAY_S,
    });
    if (claimErr) return json({ error: claimErr.message }, 500);

    const rows = (claimed ?? []) as ClaimedRow[];
    if (rows.length === 0) return json({ ok: true, processed: 0, reaped: reaped ?? 0 });

    const templateCache = new Map<string, string>();
    let sent = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        // Campaign template (cached per invocation).
        let template = templateCache.get(row.campaign_id);
        if (template === undefined) {
          const { data: c } = await admin
            .from("whatsapp_campaigns")
            .select("message_template")
            .eq("id", row.campaign_id)
            .maybeSingle();
          if (!c) throw new Error("campaign not found");
          template = c.message_template ?? "";
          templateCache.set(row.campaign_id, template);
        }

        const text = renderTemplate(template, row.variables, row.recipient_name);
        const cleanPhone = String(row.phone).replace(/\D/g, "");
        if (!cleanPhone) throw new Error("invalid phone");

        // Short typing presence (bounded; not the old 30-90s loop).
        const typingMs = rand(TYPING_MIN_MS, TYPING_MAX_MS);
        try {
          await fetch(`${UAZ_BASE}/send/presence`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: row.instance_token },
            body: JSON.stringify({ number: cleanPhone, presence: "composing", delay: typingMs }),
          });
        } catch { /* best effort */ }
        await sleep(typingMs);

        const sendRes = await fetch(`${UAZ_BASE}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: row.instance_token },
          body: JSON.stringify({ number: cleanPhone, text }),
        });
        const sendText = await sendRes.text();
        if (!sendRes.ok) throw new Error(`uazapi ${sendRes.status}: ${sendText.slice(0, 200)}`);

        let sendData: Record<string, unknown> = {};
        try { sendData = JSON.parse(sendText); } catch { /* keep */ }
        const waMessageId = (sendData.messageid as string) || (sendData.id as string) || null;

        // Ensure conversation + log outbound message.
        const { data: conv } = await admin
          .from("whatsapp_conversations")
          .select("id")
          .eq("instance_id", row.instance_id)
          .eq("contact_phone", cleanPhone)
          .maybeSingle();

        let conversationId = conv?.id as string | undefined;
        const nowIso = new Date().toISOString();
        if (!conversationId) {
          const { data: newConv } = await admin
            .from("whatsapp_conversations")
            .insert({
              workspace_id: row.workspace_id,
              instance_id: row.instance_id,
              contact_phone: cleanPhone,
              contact_name: row.recipient_name,
              last_message: text,
              last_message_at: nowIso,
              unread_count: 0,
              status: "open",
            })
            .select("id")
            .single();
          conversationId = newConv?.id;
        } else {
          await admin.from("whatsapp_conversations").update({
            last_message: text,
            last_message_at: nowIso,
            updated_at: nowIso,
          }).eq("id", conversationId);
        }

        if (conversationId) {
          await admin.from("whatsapp_messages").upsert({
            workspace_id: row.workspace_id,
            instance_id: row.instance_id,
            conversation_id: conversationId,
            wa_message_id: waMessageId,
            direction: "outbound",
            type: "text",
            content: text,
            body: text,
            status: "sent",
            timestamp: nowIso,
          }, { onConflict: "instance_id,wa_message_id", ignoreDuplicates: true });
        }

        await admin.from("whatsapp_queue").update({
          status: "sent",
          sent_at: nowIso,
          locked_at: null,
        }).eq("id", row.id);

        await refreshCampaignCounts(admin, row.campaign_id);
        sent++;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        console.error("[campaign] send error", row.id, msg);
        await admin.from("whatsapp_queue").update({
          status: "failed",
          error_message: msg.slice(0, 500),
          locked_at: null,
        }).eq("id", row.id);
        await refreshCampaignCounts(admin, row.campaign_id);
        failed++;
      }
    }

    // Mark drained campaigns completed.
    const campaignIds = Array.from(new Set(rows.map((r) => r.campaign_id)));
    for (const cid of campaignIds) {
      await completeIfDrained(admin, cid);
    }

    return json({ ok: true, processed: rows.length, sent, failed, reaped: reaped ?? 0 });
  } catch (e) {
    console.error("[campaign] fatal", e);
    return json({ error: (e as Error).message }, 500);
  }
});
