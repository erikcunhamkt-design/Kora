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

        // Register webhook
        const webhookUrl = `${SUPABASE_URL}/functions/v1/whatsapp-webhook?secret=${encodeURIComponent(WEBHOOK_SECRET)}&workspace=${workspaceId}`;
        await uaz("/webhook", {
          token: instToken,
          body: {
            url: webhookUrl,
            enabled: true,
            events: ["messages", "messages_update", "connection"],
          },
        }).catch(() => null);
      }

      // Request QR
      const connect = await uaz("/instance/connect", { token: instance.instance_token, body: {} });
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
      const st = await uaz("/instance/status", { token: existing.instance_token, method: "GET" });
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
      await uaz("/instance/disconnect", { token: existing.instance_token, body: {} }).catch(() => null);
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
      await uaz("/instance/delete", { admin: true, body: { token: existing.instance_token } }).catch(() => null);
      await admin.from("whatsapp_instances").delete().eq("id", existing.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("whatsapp-instance error", e);
    return json({ error: (e as Error).message }, 500);
  }
});
