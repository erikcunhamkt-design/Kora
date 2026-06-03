// Generates an AI reply (Vertex AI / Google Gemini / Lovable AI Gateway) for an inbound WhatsApp message
// and sends it back via uazapi. Invoked fire-and-forget by whatsapp-webhook.
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

const DEFAULT_MODEL = "gemini-2.5-flash";
const LOVABLE_DEFAULT_MODEL = "google/gemini-3-flash-preview";
const MAX_HISTORY = 12;

function normalizeGoogleModel(modelName: string): string {
  const raw = (modelName || DEFAULT_MODEL).trim().replace(/^google\//i, "");
  const deprecatedModels = new Set([
    "gemini-1.5-flash",
    "gemini-1.5-flash-001",
    "gemini-1.5-flash-002",
    "gemini-1.5-pro",
    "gemini-1.5-pro-001",
    "gemini-1.5-pro-002",
    "gemini-2.0-flash",
    "gemini-2.0-flash-001",
  ]);

  return deprecatedModels.has(raw) ? DEFAULT_MODEL : raw;
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Helpers for Base64URL encoding
function base64url(arr: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < arr.byteLength; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function strToBase64url(str: string): string {
  return base64url(new TextEncoder().encode(str));
}

// Sign a JWT claim using RS256 with a PEM private key
async function signRS256(pem: string, payload: Record<string, unknown>): Promise<string> {
  const cleanPem = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  
  const binaryDer = Uint8Array.from(atob(cleanPem), (c) => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const header = { alg: "RS256", typ: "JWT" };
  const input = `${strToBase64url(JSON.stringify(header))}.${strToBase64url(JSON.stringify(payload))}`;
  
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(input)
  );

  return `${input}.${base64url(new Uint8Array(signature))}`;
}

// Generate GCP Access Token using Service Account credentials
async function getGCPToken(serviceAccountJson: string, scope = "https://www.googleapis.com/auth/cloud-platform"): Promise<string> {
  const creds = JSON.parse(serviceAccountJson) as {
    client_email: string;
    private_key: string;
  };
  
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: creds.client_email,
    scope: scope,
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const jwt = await signRS256(creds.private_key, claims);
  
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to exchange JWT for GCP access token: ${errText}`);
  }

  const data = await res.json() as { access_token: string };
  return data.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let conversationId: string | undefined;
  let workspaceId: string | undefined;
  let adminClient: any = null;

  try {
    const body = await req.json().catch(() => ({}));
    const isTest = Boolean(body.isTest);
    
    conversationId = body.conversationId;
    workspaceId = body.workspaceId;

    if (!isTest && (!conversationId || !workspaceId)) {
      return json({ error: "missing params" }, 400);
    }

    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Bot settings & details
    let bot: any = null;
    let systemInstruction = "Você é um atendente cordial e prestativo. Responda de forma clara, breve e em português.";
    let provider = "lovable";
    let modelName = DEFAULT_MODEL;
    let geminiApiKey: string | null = null;
    let gcpProjectId: string | null = null;
    let gcpRegion = "us-central1";
    let gcpServiceAccount: string | null = null;
    let contents: any[] = [];
    let conv: any = null;
    let instance: any = null;

    if (isTest) {
      // Direct testing mode from UI playground
      systemInstruction = body.systemInstruction || systemInstruction;
      provider = body.provider || "lovable";
      modelName = body.modelName || DEFAULT_MODEL;
      geminiApiKey = body.geminiApiKey || null;
      gcpProjectId = body.gcpProjectId || null;
      gcpRegion = body.gcpRegion || "us-central1";
      gcpServiceAccount = body.gcpServiceAccount || null;
      
      // Auto-extract project_id from Service Account JSON if available
      if (gcpServiceAccount) {
        try {
          const parsed = JSON.parse(gcpServiceAccount);
          gcpProjectId = parsed.project_id || gcpProjectId;
        } catch {
          // ignore
        }
      }
      
      // Build test contents
      const testHistory = body.history || [];
      if (testHistory.length > 0) {
        contents = testHistory.map((h: any) => ({
          role: h.role,
          parts: [{ text: h.text }]
        }));
      } else {
        contents = [{
          role: "user",
          parts: [{ text: body.messageText || "Olá, tudo bem?" }]
        }];
      }
    } else {
      // Normal execution mode triggered by webhook
      const { data: botData } = await adminClient
        .from("whatsapp_bot_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      bot = botData;
      if (!bot) {
        return json({ ok: true, skipped: "no bot settings found" });
      }

      if (!bot.is_active) {
        return json({ ok: true, skipped: "bot inactive" });
      }

      // Conversation
      const { data: convData, error: convErr } = await adminClient
        .from("whatsapp_conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

      conv = convData;
      if (convErr) {
        console.error("[bot-reply] conv query error:", convErr);
        throw new Error(`Erro ao buscar conversa: ${convErr.message}`);
      }
      if (!conv) {
        return json({ error: "conversation not found" }, 404);
      }

      // Respect respond_all setting
      if (!bot.respond_all && conv.assigned_to) {
        return json({ ok: true, skipped: "assigned and respond_all is false" });
      }

      // Instance
      const { data: instData, error: instErr } = await adminClient
        .from("whatsapp_instances")
        .select("instance_token, status")
        .eq("id", conv.instance_id)
        .maybeSingle();

      instance = instData;
      if (instErr) {
        console.error("[bot-reply] instance query error:", instErr);
        throw new Error(`Erro ao buscar instância: ${instErr.message}`);
      }
      if (!instance || instance.status !== "connected") {
        return json({ ok: true, skipped: "instance not connected or missing" });
      }

      // Load recent message history
      const { data: history } = await adminClient
        .from("whatsapp_messages")
        .select("direction, content, body, type, timestamp, created_at")
        .eq("conversation_id", conversationId)
        .order("timestamp", { ascending: false, nullsFirst: false })
        .limit(MAX_HISTORY);

      const ordered = (history ?? []).slice().reverse();
      systemInstruction = bot.system_instruction || systemInstruction;
      provider = bot.provider || "lovable";
      modelName = bot.model_name || DEFAULT_MODEL;
      geminiApiKey = bot.gemini_api_key || null;
      gcpProjectId = bot.gcp_project_id || null;
      gcpRegion = bot.gcp_region || gcpRegion;
      gcpServiceAccount = bot.gcp_service_account || null;

      // Apply database-level custom keys if configured
      if (provider === "gemini_api_key" && bot.gemini_api_key) {
        geminiApiKey = bot.gemini_api_key;
        gcpServiceAccount = null;
        gcpProjectId = null;
      } else if (provider === "vertex_ai" && bot.gcp_service_account) {
        gcpServiceAccount = bot.gcp_service_account;
        // Extract project ID from Service Account JSON if available
        try {
          const parsed = JSON.parse(gcpServiceAccount);
          gcpProjectId = parsed.project_id || bot.gcp_project_id || gcpProjectId;
        } catch {
          gcpProjectId = bot.gcp_project_id || gcpProjectId;
        }
        gcpRegion = bot.gcp_region || gcpRegion;
        geminiApiKey = null;
      }

      contents = ordered
        .map((m) => ({
          role: m.direction === "inbound" ? "user" : "model",
          parts: [{ text: m.content || m.body || (m.type ? `[${m.type}]` : "") }],
        }))
        .filter((m) => m.parts[0].text);
    }

    // Default environment variables (fallback)
    let GEMINI_API_KEY = geminiApiKey || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VERTEX_API_KEY") || null;
    let GCP_SERVICE_ACCOUNT = gcpServiceAccount || Deno.env.get("GCP_SERVICE_ACCOUNT") || null;
    let GCP_PROJECT_ID = gcpProjectId || Deno.env.get("GCP_PROJECT_ID") || null;
    let GCP_REGION = gcpRegion;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || null;

    let reply = "";
    // Auto-map removed Google models to a currently supported Gemini model.
    let rawModel = normalizeGoogleModel(modelName);

    if (provider === "vertex_ai" && GCP_SERVICE_ACCOUNT && GCP_PROJECT_ID) {
      // 1. Google Cloud Vertex AI Mode
      console.log(`[bot-reply] Using Vertex AI mode with model: ${rawModel}`);
      const token = await getGCPToken(GCP_SERVICE_ACCOUNT);
      const vertexUrl = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/publishers/google/models/${rawModel}:generateContent`;

      const bodyPayload: Record<string, any> = { contents };
      if (systemInstruction) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      let aiRes = await fetch(vertexUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        console.warn("[bot-reply] Vertex AI API failed, attempting fallback to Generative Language API...", aiRes.status, detail);
        
        const fallbackToken = await getGCPToken(GCP_SERVICE_ACCOUNT, "https://www.googleapis.com/auth/generative-language");
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${fallbackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!fallbackRes.ok) {
          const fallbackDetail = await fallbackRes.text();
          console.error("[bot-reply] Fallback Generative Language API failed as well:", fallbackRes.status, fallbackDetail);
          throw new Error(`Vertex AI falhou (${aiRes.status}: ${detail}) e Generative Language API falhou (${fallbackRes.status}: ${fallbackDetail})`);
        }

        const aiData = await fallbackRes.json();
        reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      } else {
        const aiData = await aiRes.json();
        reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
    } else if (provider === "gemini_api_key" && GEMINI_API_KEY) {
      // 2. Google AI Studio (Gemini) Mode
      console.log(`[bot-reply] Using Gemini AI Studio mode with model: ${rawModel}`);
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent?key=${GEMINI_API_KEY}`;

      const bodyPayload: Record<string, any> = { contents };
      if (systemInstruction) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const aiRes = await fetch(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        console.error("[bot-reply] Gemini Developer API error", aiRes.status, detail);
        throw new Error(`Gemini Developer API retornou status ${aiRes.status}: ${detail}`);
      }

      const aiData = await aiRes.json();
      reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else if (provider === "lovable" && LOVABLE_API_KEY) {
      // 3. Lovable AI Gateway Mode
      let modelToUse = modelName;
      // Auto-prefix gemini models for Lovable AI gateway if they don't have a prefix
      if (modelToUse.startsWith("gemini-") && !modelToUse.includes("/")) {
        modelToUse = `google/${modelToUse}`;
      }
      console.log(`[bot-reply] Using Lovable AI Gateway with model: ${modelToUse}`);

      const messages = [
        { role: "system", content: systemInstruction },
        ...contents.map((c) => ({
          role: c.role === "user" ? "user" : "assistant",
          content: c.parts[0].text,
        })),
      ];

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelToUse,
          messages,
        }),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        console.error("[bot-reply] Lovable AI Gateway error", aiRes.status, detail);
        if (aiRes.status === 429) throw new Error("Limite de requisições excedido no Lovable AI Gateway (429).");
        if (aiRes.status === 402) throw new Error("Créditos esgotados no Lovable AI Gateway (402).");
        throw new Error(`Lovable AI Gateway retornou status ${aiRes.status}: ${detail}`);
      }

      const aiData = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      reply = aiData.choices?.[0]?.message?.content?.trim() || "";
    } else {
      console.error("[bot-reply] Error: Provider configuration is invalid or missing keys.");
      throw new Error(`Configuração do provedor '${provider}' inválida ou chaves/credenciais não preenchidas.`);
    }

    if (isTest) {
      return json({ ok: true, reply });
    }

    // Send via uazapi
    console.log(`[bot-reply] Sending reply to ${conv.contact_phone} using uazapi...`);
    const sendRes = await fetch(`${UAZ_BASE}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instance.instance_token },
      body: JSON.stringify({ number: conv.contact_phone, text: reply }),
    });
    const sendText = await sendRes.text();
    let sendData: Record<string, unknown> = {};
    try { sendData = JSON.parse(sendText); } catch { /* keep */ }
    const waMessageId = (sendData.messageid as string) || (sendData.id as string) || null;

    if (!sendRes.ok) {
      console.error("[bot-reply] Failed to send via uazapi:", sendRes.status, sendText);
      throw new Error(`Falha no disparo do WhatsApp (uazapi) [Status ${sendRes.ok ? 200 : sendRes.status}]: ${sendText}`);
    }

    // Persist sent message in DB
    await adminClient.from("whatsapp_messages").insert({
      workspace_id: workspaceId,
      instance_id: conv.instance_id,
      conversation_id: conversationId,
      wa_message_id: waMessageId,
      direction: "outbound",
      type: "text",
      content: reply,
      body: reply,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    await adminClient.from("whatsapp_conversations").update({
      last_message: reply,
      last_message_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", conversationId);

    console.log("[bot-reply] Reply sent and saved successfully!");
    return json({ ok: true, reply });

  } catch (e) {
    console.error("[bot-reply] Fatal handler error:", e);
    // Write error log to database if we can
    if (adminClient && conversationId && workspaceId) {
      try {
        const { data: conv } = await adminClient
          .from("whatsapp_conversations")
          .select("instance_id")
          .eq("id", conversationId)
          .maybeSingle();

        await adminClient.from("whatsapp_messages").insert({
          workspace_id: workspaceId,
          instance_id: conv?.instance_id || null,
          conversation_id: conversationId,
          direction: "outbound",
          type: "text",
          content: `⚠️ Erro do Assistente Virtual: ${(e as Error).message}`,
          body: `⚠️ Erro do Assistente Virtual: ${(e as Error).message}`,
          status: "error",
          error: (e as Error).stack || (e as Error).message,
          timestamp: new Date().toISOString(),
        });
      } catch (dbErr) {
        console.error("[bot-reply] Failed to write error details to whatsapp_messages table:", dbErr);
      }
    }
    return json({ error: (e as Error).message }, 500);
  }
});
