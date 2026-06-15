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

function genVerifyToken() {
  return crypto.randomUUID().replace(/-/g, "");
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

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const { action, workspaceId } = body as { action?: string; workspaceId?: string };
    if (!action || !workspaceId) return json({ error: "Missing action or workspaceId" }, 400);

    // Verify membership using user-scoped client (RLS)
    const { data: member } = await userClient
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", claims.claims.sub)
      .maybeSingle();
    if (!member) return json({ error: "Forbidden" }, 403);
    const isAdmin = member.role === "owner" || member.role === "admin";

    if (action === "get") {
      const { data } = await admin
        .from("whatsapp_official_credentials")
        .select("id, workspace_id, phone_number_id, waba_id, display_phone_number, verified_name, verify_token, status, last_verified_at, created_at, updated_at, app_secret")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      // Never return access_token. app_secret only as boolean presence.
      const safe = data
        ? { ...data, has_app_secret: !!data.app_secret, app_secret: undefined }
        : null;
      return json({ credentials: safe });
    }

    if (!isAdmin) return json({ error: "Admin role required" }, 403);

    if (action === "upsert") {
      const { phone_number_id, waba_id, access_token, app_secret } = body as {
        phone_number_id?: string;
        waba_id?: string;
        access_token?: string;
        app_secret?: string | null;
      };
      if (!phone_number_id || !waba_id) return json({ error: "phone_number_id and waba_id are required" }, 400);

      const { data: existing } = await admin
        .from("whatsapp_official_credentials")
        .select("id, verify_token, access_token, app_secret")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      const payload: Record<string, unknown> = {
        workspace_id: workspaceId,
        phone_number_id,
        waba_id,
        verify_token: existing?.verify_token ?? genVerifyToken(),
        access_token: access_token && access_token.length > 0 ? access_token : existing?.access_token,
        app_secret: app_secret === undefined ? existing?.app_secret ?? null : (app_secret || null),
        status: "configured",
      };
      if (!payload.access_token) return json({ error: "access_token is required" }, 400);

      const { data: saved, error: upErr } = await admin
        .from("whatsapp_official_credentials")
        .upsert(payload, { onConflict: "workspace_id" })
        .select("id, workspace_id, phone_number_id, waba_id, display_phone_number, verified_name, verify_token, status, last_verified_at, created_at, updated_at, app_secret")
        .single();
      if (upErr) return json({ error: upErr.message }, 400);

      return json({
        credentials: { ...saved, has_app_secret: !!saved.app_secret, app_secret: undefined },
      });
    }

    if (action === "delete") {
      const { error: delErr } = await admin
        .from("whatsapp_official_credentials")
        .delete()
        .eq("workspace_id", workspaceId);
      if (delErr) return json({ error: delErr.message }, 400);
      // also unset provider on instance if set to official
      await admin
        .from("whatsapp_instances")
        .update({ provider: "uazapi" })
        .eq("workspace_id", workspaceId)
        .eq("provider", "official");
      return json({ credentials: null });
    }

    if (action === "verify") {
      const { data: row } = await admin
        .from("whatsapp_official_credentials")
        .select("phone_number_id, access_token")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (!row) return json({ error: "Credenciais não encontradas" }, 404);

      const res = await fetch(
        `${GRAPH_BASE}/${row.phone_number_id}?fields=display_phone_number,verified_name`,
        { headers: { Authorization: `Bearer ${row.access_token}` } },
      );
      const data = await res.json();
      if (!res.ok) {
        return json({ error: data?.error?.message ?? "Falha ao verificar", details: data }, 400);
      }
      const { data: updated } = await admin
        .from("whatsapp_official_credentials")
        .update({
          display_phone_number: data.display_phone_number ?? null,
          verified_name: data.verified_name ?? null,
          status: "verified",
          last_verified_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspaceId)
        .select("id, workspace_id, phone_number_id, waba_id, display_phone_number, verified_name, verify_token, status, last_verified_at, created_at, updated_at, app_secret")
        .single();
      return json({
        credentials: { ...updated!, has_app_secret: !!updated!.app_secret, app_secret: undefined },
      });
    }

    if (action === "set_active") {
      // Mark this workspace's whatsapp_instances row as provider=official
      const { data: inst } = await admin
        .from("whatsapp_instances")
        .select("id")
        .eq("workspace_id", workspaceId)
        .maybeSingle();
      if (inst) {
        await admin.from("whatsapp_instances").update({ provider: "official" }).eq("id", inst.id);
      } else {
        await admin.from("whatsapp_instances").insert({
          workspace_id: workspaceId,
          provider: "official",
          status: "connected",
        });
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
