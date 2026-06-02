// WhatsApp Campaign V2 Sender
// - Processes a single batch of recipients per invocation (MAX_BATCH_SIZE).
// - Validates campaign + template + workspace authorization server-side.
// - Idempotent: skips recipients already sent/delivered/read/replied or with provider_message_id.
// - Never accepts free body text for audience sends. Uses the linked message model body only.
// - Token never leaves the server.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUBDOMAIN = (Deno.env.get("UAZAPI_SUBDOMAIN") ?? "").trim().replace(/\/+$/, "");

const UAZ_BASE = (() => {
  if (!SUBDOMAIN) return "https://free.uazapi.com";
  if (/^https?:\/\//i.test(SUBDOMAIN)) return SUBDOMAIN;
  if (SUBDOMAIN.includes(".")) return `https://${SUBDOMAIN}`;
  return `https://${SUBDOMAIN}.uazapi.com`;
})();

// ---- Tunable constants ----
const MAX_BATCH_SIZE = 10;
const CAMPAIGN_SEND_MODE = "manual_batch";
const MIN_DELAY_MS = 30_000;
const MAX_DELAY_MS = 90_000;
const TYPING_MIN_MS = 1500;
const TYPING_MAX_MS = 4000;

const rand = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const VAR_PATTERN = /\{\{\s*([a-zA-ZÀ-ÿ_]+)\s*\}\}/g;
function renderTemplate(
  body: string,
  recipient: { name?: string | null; phone?: string | null },
  sampleValues: Record<string, string> | null,
): { text: string; missing: string[] } {
  const missing: string[] = [];
  const firstName = recipient.name?.split(" ")[0] ?? null;
  const ctx: Record<string, string> = {
    nome: recipient.name ?? sampleValues?.nome ?? "",
    primeiro_nome: firstName ?? sampleValues?.primeiro_nome ?? "",
    empresa: sampleValues?.empresa ?? "",
    serviço: sampleValues?.["serviço"] ?? "",
    data: sampleValues?.data ?? new Date().toLocaleDateString("pt-BR"),
    link: sampleValues?.link ?? "",
  };
  const text = body.replace(VAR_PATTERN, (_, key: string) => {
    const v = ctx[key] ?? sampleValues?.[key];
    if (v == null || v === "") {
      missing.push(key);
      return "";
    }
    return v;
  });
  return { text, missing };
}

interface SenderPayload {
  campaignId?: string;
  workspaceId?: string;
  action?: "send_batch" | "pause" | "cancel";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Authn — validate caller is a workspace member.
    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "missing_auth" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const payload = (await req.json().catch(() => ({}))) as SenderPayload;
    const campaignId = payload.campaignId;
    const workspaceId = payload.workspaceId;
    const action = payload.action ?? "send_batch";
    if (!campaignId || !workspaceId) return json({ error: "missing_params" }, 400);

    // Verify membership using the user's RLS context.
    const { data: membership } = await userClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!membership) return json({ error: "forbidden" }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Load campaign + template
    const { data: campaign, error: cErr } = await admin
      .from("whatsapp_campaigns_v2")
      .select("*")
      .eq("id", campaignId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (cErr) return json({ error: cErr.message }, 500);
    if (!campaign) return json({ error: "campaign_not_found" }, 404);

    // Action: pause / cancel
    if (action === "pause") {
      await admin.from("whatsapp_campaigns_v2").update({ status: "paused" }).eq("id", campaignId);
      return json({ ok: true, status: "paused" });
    }
    if (action === "cancel") {
      if (["completed", "cancelled"].includes(campaign.status)) {
        return json({ ok: true, status: campaign.status });
      }
      await admin
        .from("whatsapp_campaigns_v2")
        .update({ status: "cancelled" })
        .eq("id", campaignId);
      await admin
        .from("whatsapp_campaign_recipients")
        .update({ status: "skipped", skip_reason: "campaign_cancelled" })
        .eq("campaign_id", campaignId)
        .in("status", ["pending", "queued"]);
      return json({ ok: true, status: "cancelled" });
    }

    if (["completed", "cancelled"].includes(campaign.status)) {
      return json({ error: "campaign_finalized", status: campaign.status }, 409);
    }

    const { data: template } = await admin
      .from("whatsapp_templates")
      .select("id, status, body, sample_values, workspace_id, deleted_at")
      .eq("id", campaign.template_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!template) return json({ error: "template_not_found" }, 404);
    // Removido: bloqueio por "template_not_approved".
    // Aceita modelos ativos (approved) e rascunhos enviáveis (active). Bloqueia apenas:
    // deletado, arquivado (paused) ou corpo vazio.
    if (template.deleted_at) return json({ error: "template_deleted" }, 409);
    if (template.status === "paused") return json({ error: "template_archived" }, 409);
    if (!template.body || !String(template.body).trim()) {
      return json({ error: "template_empty" }, 409);
    }

    // Ensure instance connected
    const { data: instance } = await admin
      .from("whatsapp_instances")
      .select("id, instance_token, status")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!instance || instance.status !== "connected") {
      return json({ error: "instance_not_connected" }, 412);
    }

    // Mark campaign as sending
    if (campaign.status !== "sending") {
      await admin
        .from("whatsapp_campaigns_v2")
        .update({ status: "sending" })
        .eq("id", campaignId);
    }

    // Queue eligible pending → queued (idempotent)
    await admin
      .from("whatsapp_campaign_recipients")
      .update({ status: "queued" })
      .eq("campaign_id", campaignId)
      .eq("workspace_id", workspaceId)
      .eq("status", "pending");

    // Pick batch — only queued recipients (skipped/sent/etc. are immutable)
    const { data: batch, error: bErr } = await admin
      .from("whatsapp_campaign_recipients")
      .select("id, phone, normalized_phone, name, status, provider_message_id")
      .eq("campaign_id", campaignId)
      .eq("workspace_id", workspaceId)
      .eq("status", "queued")
      .is("provider_message_id", null)
      .limit(MAX_BATCH_SIZE);
    if (bErr) return json({ error: bErr.message }, 500);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < (batch ?? []).length; i++) {
      const r = batch![i];

      // Idempotency lock: only proceed if still queued.
      const { data: locked } = await admin
        .from("whatsapp_campaign_recipients")
        .update({ status: "sending" })
        .eq("id", r.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();
      if (!locked) continue;

      try {
        const { text, missing } = renderTemplate(
          template.body,
          { name: r.name, phone: r.normalized_phone },
          (template.sample_values ?? null) as Record<string, string> | null,
        );
        const required = ["nome", "primeiro_nome"];
        const blockingMissing = missing.filter((m) => required.includes(m) && !r.name);
        if (blockingMissing.length > 0) {
          throw new Error(`missing_variable:${blockingMissing.join(",")}`);
        }

        const phone = String(r.normalized_phone ?? r.phone).replace(/\D/g, "");
        if (!phone) throw new Error("invalid_phone");

        // Typing presence
        const typingMs = rand(TYPING_MIN_MS, TYPING_MAX_MS);
        try {
          await fetch(`${UAZ_BASE}/send/presence`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instance.instance_token },
            body: JSON.stringify({ number: phone, presence: "composing", delay: typingMs }),
          });
        } catch { /* best effort */ }
        await sleep(typingMs);

        const sendRes = await fetch(`${UAZ_BASE}/send/text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: instance.instance_token },
          body: JSON.stringify({ number: phone, text }),
        });
        const sendText = await sendRes.text();
        if (!sendRes.ok) throw new Error(`uazapi_${sendRes.status}:${sendText.slice(0, 180)}`);
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(sendText); } catch { /* keep */ }
        const providerId = (parsed.messageid as string) || (parsed.id as string) || null;

        await admin
          .from("whatsapp_campaign_recipients")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
            provider_message_id: providerId,
            error_message: null,
          })
          .eq("id", r.id);

        await admin.from("whatsapp_campaign_send_logs").insert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          recipient_id: r.id,
          phone,
          event: "sent",
          message: text.slice(0, 280),
          provider_message_id: providerId,
        });

        sent++;
      } catch (e) {
        const msg = (e as Error).message ?? String(e);
        await admin
          .from("whatsapp_campaign_recipients")
          .update({
            status: "failed",
            error_message: msg.slice(0, 500),
          })
          .eq("id", r.id);
        await admin.from("whatsapp_campaign_send_logs").insert({
          workspace_id: workspaceId,
          campaign_id: campaignId,
          recipient_id: r.id,
          phone: r.normalized_phone ?? r.phone,
          event: "failed",
          error_message: msg.slice(0, 500),
        });
        errors.push(msg);
        failed++;
      }

      // Anti-ban delay between sends (except after last in batch)
      if (i < (batch ?? []).length - 1) {
        await sleep(rand(MIN_DELAY_MS, MAX_DELAY_MS));
      }
    }

    // Refresh counters
    const { data: counts } = await admin
      .from("whatsapp_campaign_recipients")
      .select("status")
      .eq("campaign_id", campaignId);
    const tally = { sent: 0, failed: 0, queued: 0, pending: 0 };
    (counts ?? []).forEach((row) => {
      if (row.status === "sent") tally.sent++;
      else if (row.status === "failed") tally.failed++;
      else if (row.status === "queued" || row.status === "sending") tally.queued++;
      else if (row.status === "pending") tally.pending++;
    });

    const remaining = tally.queued + tally.pending;
    const newStatus = remaining === 0 ? "completed" : "sending";
    await admin
      .from("whatsapp_campaigns_v2")
      .update({
        status: newStatus,
        sent_count: tally.sent,
        failed_count: tally.failed,
      })
      .eq("id", campaignId);

    return json({
      ok: true,
      mode: CAMPAIGN_SEND_MODE,
      batchSize: MAX_BATCH_SIZE,
      processed: (batch ?? []).length,
      sent,
      failed,
      remaining,
      status: newStatus,
      errors: errors.slice(0, 5),
    });
  } catch (e) {
    console.error("[wa-sender] fatal", (e as Error).message);
    return json({ error: (e as Error).message ?? "internal_error" }, 500);
  }
});
