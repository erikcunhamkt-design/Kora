// Generates an AI reply (Vertex AI / Google Gemini / Lovable AI Gateway) for an inbound WhatsApp message
// and sends it back via uazapi. Invoked fire-and-forget by whatsapp-webhook.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { applySendTemplate } from "../_shared/botFlowTemplate.ts";
import { authorizeIsTestCaller } from "../_shared/isTestAuth.ts";
import { decideRateLimitOutcome } from "../_shared/rateLimit.ts";
import { fetchWithRetry } from "../_shared/retry.ts";
import { buildAnthropicMessages, parseAnthropicReply } from "../_shared/anthropicParser.ts";
import { composeSystemInstruction } from "../_shared/brainComposer.ts";

interface BotFlowNodeProperties {
  respondAll?: boolean;
  instruction?: string;
  provider?: string;
  model?: string;
  geminiApiKey?: string;
  gcpProjectId?: string;
  gcpRegion?: string;
  gcpServiceAccount?: string;
  template?: string;
  assignTo?: string;
}

interface BotFlowNode {
  id: string;
  type: "trigger" | "ai" | "send" | "handover";
  enabled: boolean;
  properties?: BotFlowNodeProperties;
}

interface BotSettingsRow {
  is_active: boolean | null;
  flow_data: unknown;
  system_instruction: string | null;
  provider: string | null;
  model_name: string | null;
  gemini_api_key: string | null;
  gcp_project_id: string | null;
  gcp_region: string | null;
  gcp_service_account: string | null;
  respond_all: boolean;
}

interface ConversationRow {
  id: string;
  instance_id: string;
  contact_phone: string;
  assigned_to: string | null;
}

interface InstanceRow {
  instance_token: string;
  status: string;
  subdomain: string | null;
}

interface MessageHistoryRow {
  direction: string;
  content: string | null;
  body: string | null;
  type: string | null;
  timestamp: string | null;
  created_at: string;
}

interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
}

interface BotReplyHistoryItem {
  role: string;
  text: string;
}

interface AiBrainProfileRow {
  tone: string | null;
  talk_about: string | null;
  dont_talk_about: string | null;
  products_services: string | null;
  limits: string | null;
}

interface BotReplyRequestBody {
  isTest?: boolean;
  conversationId?: string;
  workspaceId?: string;
  systemInstruction?: string;
  provider?: string;
  modelName?: string;
  geminiApiKey?: string;
  gcpProjectId?: string;
  gcpRegion?: string;
  gcpServiceAccount?: string;
  history?: BotReplyHistoryItem[];
  messageText?: string;
  flowData?: unknown;
}

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

function baseForStoredSubdomain(input: string | null | undefined): string {
  const raw = (input ?? SUBDOMAIN ?? "free").trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const host = raw.split("/")[0] || "free";
  if (host.includes(".")) return `https://${host}`;
  return `https://${host}.uazapi.com`;
}

// Model ID is configuration, not code: Google has retired the default flash model
// twice in ~5 months (1.5-flash -> 2.0-flash -> 2.5-flash, and now 2.5-flash itself
// returns "no longer available to new users" ahead of its own documented Oct/2026
// shutdown). GEMINI_MODEL lets the operator fix this from Supabase secrets, no code
// deploy needed — see docs/qa/etapa-6-g5-rate-limit.md ("model ID é configuração").
const DEFAULT_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-3.6-flash";
const LOVABLE_DEFAULT_MODEL = "google/gemini-2.5-flash";
// claude-haiku-4-5: modelo Claude atual mais barato ($1/$5 por MTok) — o
// pedido original citava "claude-3-5-haiku", um ID já aposentado (retirado
// em 19/02/2026); Haiku 4.5 é o substituto direto na tabela de migração.
// Mesmo padrão do GEMINI_MODEL acima: configurável via secret, sem deploy.
const ANTHROPIC_DEFAULT_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-haiku-4-5";
const MAX_HISTORY = 12;

function normalizeGoogleModel(modelName: string, provider: string): string {
  const raw = (modelName || "").trim().replace(/^google\//i, "");
  const model = !raw || raw === "custom" ? DEFAULT_MODEL : raw;
  const supportedAliases: Record<string, string> = {
    "gemini-1.5-flash": DEFAULT_MODEL,
    "gemini-1.5-flash-001": DEFAULT_MODEL,
    "gemini-1.5-flash-002": DEFAULT_MODEL,
    "gemini-1.5-pro": "gemini-2.5-pro",
    "gemini-1.5-pro-001": "gemini-2.5-pro",
    "gemini-1.5-pro-002": "gemini-2.5-pro",
    "gemini-2.0-flash": DEFAULT_MODEL,
    "gemini-2.0-flash-001": DEFAULT_MODEL,
    "gemini-2.5-flash": DEFAULT_MODEL,
    "gemini-2.5-flash-001": DEFAULT_MODEL,
    "gemini-2.5-pro-001": "gemini-2.5-pro",
  };
  return supportedAliases[model] || model;
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
  let adminClient: SupabaseClient | null = null;

  try {
    const body = (await req.json().catch(() => ({}))) as BotReplyRequestBody;
    const isTest = Boolean(body.isTest);

    conversationId = body.conversationId;
    workspaceId = body.workspaceId;

    // workspaceId is required in both modes (G5: isTest with no attribution at all was
    // callable with just the public anon key, an unlimited free AI proxy on Kora's own
    // credentials — see docs/qa/etapa-6-g5-rate-limit.md §4.1).
    if (!workspaceId || (!isTest && !conversationId)) {
      return json({ error: "missing params" }, 400);
    }

    // isTest is called directly from the browser (simulator), so workspaceId alone is
    // just an input value, not proof of identity — it can be forged. Require a real user
    // JWT and verify workspace membership through it, closing the G18/G5 gap where the
    // public anon key + isTest was an unauthenticated, unlimited, Kora-paid AI proxy (see
    // docs/qa/etapa-6-g5-rate-limit.md §4.1). The webhook path (isTest=false) is
    // server-to-server with its own trust boundary (SERVICE_ROLE bearer) and never reaches
    // this block.
    if (isTest) {
      const auth = req.headers.get("Authorization");
      let user: { id: string } | null = null;
      let isMember = false;

      if (auth?.startsWith("Bearer ")) {
        const userClient = createClient(SUPABASE_URL, ANON_KEY, {
          global: { headers: { Authorization: auth } },
        });
        const { data: userData } = await userClient.auth.getUser();
        user = userData?.user ?? null;

        if (user) {
          const { data: membership } = await userClient
            .from("workspace_members")
            .select("workspace_id")
            .eq("workspace_id", workspaceId)
            .eq("user_id", user.id)
            .maybeSingle();
          isMember = Boolean(membership);
        }
      }

      const authResult = authorizeIsTestCaller(auth, user, isMember);
      if (!authResult.ok) return json({ error: authResult.error }, authResult.status!);
    }

    adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    // G5 Parte 2: per-workspace rate limit before any per-request work (bot settings,
    // conversation, history — all skipped if blocked). Key is (workspace_id, bucket) —
    // workspace is the actual cost/credential unit, and separating "webhook" (real
    // traffic) from "isTest" (simulator) keeps a testing spree from ever throttling
    // real customer replies. See docs/qa/etapa-6-g5-rate-limit.md §10/§11.
    const rateLimitBucket = isTest ? "isTest" : "webhook";
    const rateLimitMax = isTest ? 10 : 20;
    const { data: withinLimitRaw, error: rateLimitErr } = await adminClient.rpc(
      "check_and_increment_ai_rate_limit",
      { p_workspace_id: workspaceId, p_bucket: rateLimitBucket, p_max: rateLimitMax, p_window_s: 60 },
    );
    if (rateLimitErr) {
      console.error("[bot-reply] rate limit check failed, failing open:", rateLimitErr.message);
    }
    const rateLimitOutcome = decideRateLimitOutcome(Boolean(rateLimitErr), withinLimitRaw === true, isTest);
    if (!rateLimitOutcome.allowed) {
      return json(rateLimitOutcome.body, rateLimitOutcome.status);
    }

    // Bot settings & details
    let bot: BotSettingsRow | null = null;
    let systemInstruction = "Você é um atendente cordial e prestativo. Responda de forma clara, breve e em português.";
    let provider = "gemini_api_key";
    let modelName = DEFAULT_MODEL;
    let geminiApiKey: string | null = null;
    let gcpProjectId: string | null = null;
    let gcpRegion = "us-central1";
    let gcpServiceAccount: string | null = null;
    let contents: GeminiContent[] = [];
    let conv: ConversationRow | null = null;
    let instance: InstanceRow | null = null;
    let flowNodes: BotFlowNode[] = [];

    if (isTest) {
      // Direct testing mode from UI playground
      systemInstruction = body.systemInstruction || systemInstruction;
      provider = body.provider || "gemini_api_key";
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

      // Optional flow preview: lets the simulator exercise the Send Node template
      if (body.flowData) {
        try {
          flowNodes = (typeof body.flowData === "string"
            ? JSON.parse(body.flowData)
            : body.flowData) as BotFlowNode[];
        } catch (err) {
          console.error("[bot-reply] failed to parse test flowData:", err);
        }
      }

      // Build test contents
      const testHistory = body.history || [];
      if (testHistory.length > 0) {
        contents = testHistory.map((h) => ({
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

      bot = botData as BotSettingsRow | null;
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

      conv = convData as ConversationRow | null;
      if (convErr) {
        console.error("[bot-reply] conv query error:", convErr);
        throw new Error(`Erro ao buscar conversa: ${convErr.message}`);
      }
      if (!conv) {
        return json({ error: "conversation not found" }, 404);
      }

      // Respect respond_all setting (parsed from trigger node if available)
      try {
        if (bot.flow_data) {
          flowNodes = (typeof bot.flow_data === "string"
            ? JSON.parse(bot.flow_data)
            : bot.flow_data) as BotFlowNode[];
        }
      } catch (err) {
        console.error("[bot-reply] failed to parse flow_data:", err);
      }

      const triggerNode = flowNodes.find((n) => n.type === "trigger" && n.enabled);
      const aiNode = flowNodes.find((n) => n.type === "ai" && n.enabled);
      const handoverNode = flowNodes.find((n) => n.type === "handover" && n.enabled);

      const respondAll = triggerNode ? triggerNode.properties?.respondAll : bot.respond_all;

      // Respect respond_all setting
      const isUnrestricted = respondAll ?? true;
      if (!isUnrestricted && conv.assigned_to) {
        return json({ ok: true, skipped: "assigned and respond_all is false" });
      }

      // Check if AI node is disabled in custom flow
      const hasFlowData = flowNodes.length > 0;
      if (hasFlowData && !aiNode) {
        return json({ ok: true, skipped: "AI node disabled in visual flow" });
      }

      // Instance
      const { data: instData, error: instErr } = await adminClient
        .from("whatsapp_instances")
        .select("instance_token, status, subdomain")
        .eq("id", conv.instance_id)
        .maybeSingle();

      instance = instData as InstanceRow | null;
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

      const ordered = ((history ?? []) as MessageHistoryRow[]).slice().reverse();

      // Check for human handover condition if handover node is enabled
      if (handoverNode) {
        const lastMsg = ordered.findLast((m) => m.direction === "inbound")?.content || "";
        const handoverKeywords = ["atendente", "humano", "pessoa", "falar com", "suporte", "ajuda", "atendimento"];
        if (handoverKeywords.some(keyword => lastMsg.toLowerCase().includes(keyword))) {
          const handoverText = "Encaminhando o seu contato para o atendimento humano. Um de nossos colaboradores irá te atender em instantes! Obrigado por aguardar.";
          console.log(`[bot-reply] Handover triggered. Sending text to ${conv.contact_phone}...`);
          
          const activeUazBase = baseForStoredSubdomain(instance.subdomain);
          const sendRes = await fetch(`${activeUazBase}/send/text`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instance.instance_token },
            body: JSON.stringify({ number: conv.contact_phone, text: handoverText }),
          });

          if (sendRes.ok) {
            await adminClient.from("whatsapp_messages").insert({
              workspace_id: workspaceId,
              instance_id: conv.instance_id,
              conversation_id: conversationId,
              direction: "outbound",
              type: "text",
              content: handoverText,
              body: handoverText,
              status: "sent",
              timestamp: new Date().toISOString(),
            });

            await adminClient.from("whatsapp_conversations").update({
              last_message: handoverText,
              last_message_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              unread_count: 1
            }).eq("id", conversationId);
          }
          
          return json({ ok: true, handover: true });
        }
      }

      if (aiNode) {
        systemInstruction = aiNode.properties?.instruction || systemInstruction;
        provider = aiNode.properties?.provider || "gemini_api_key";
        modelName = aiNode.properties?.model || DEFAULT_MODEL;
        geminiApiKey = aiNode.properties?.geminiApiKey || null;
        gcpProjectId = aiNode.properties?.gcpProjectId || null;
        gcpRegion = aiNode.properties?.gcpRegion || gcpRegion;
        gcpServiceAccount = aiNode.properties?.gcpServiceAccount || null;
      } else {
        // Fallback to table root columns
        systemInstruction = bot.system_instruction || systemInstruction;
        provider = bot.provider || "gemini_api_key";
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
      }

      contents = ordered
        .map((m) => ({
          role: m.direction === "inbound" ? "user" : "model",
          parts: [{ text: m.content || m.body || (m.type ? `[${m.type}]` : "") }],
        }))
        .filter((m) => m.parts[0].text);
    }

    // Etapa 9 · item 2 — "Cérebro" do robô: composição provider-agnóstica,
    // ponto único, ANTES de qualquer branch de provider (docs/architecture/
    // etapa-9-item2-cerebro-fase-a.md §3.1) — os 4 providers abaixo recebem
    // o systemInstruction já composto, sem nenhuma mudança nos seus branches.
    //
    // Gate real é a EXISTÊNCIA de uma linha em ai_brain_profiles pro
    // workspace — não a flag kora.ai.brain.enabled (essa é só do navegador,
    // localStorage; esta function roda no Deno, não tem acesso a ela e não
    // deveria — a flag só decide se a UI de EDIÇÃO aparece em Configurações).
    // Falha ao buscar (ex.: migration ainda não aplicada pelo operador,
    // §8-b) nunca derruba a geração de resposta — fail-open pro
    // comportamento de hoje, sem cérebro.
    const { data: brainRow, error: brainErr } = await adminClient
      .from("ai_brain_profiles")
      .select("tone, talk_about, dont_talk_about, products_services, limits")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (brainErr) {
      console.warn("[bot-reply] brain profile fetch failed, composing without it:", brainErr.message);
    }
    const brain = !brainErr && brainRow ? (brainRow as AiBrainProfileRow) : null;
    systemInstruction = composeSystemInstruction(
      brain
        ? {
            tone: brain.tone,
            talkAbout: brain.talk_about,
            dontTalkAbout: brain.dont_talk_about,
            productsServices: brain.products_services,
            limits: brain.limits,
          }
        : null,
      systemInstruction,
    );

    // Default environment variables (fallback)
    const GEMINI_API_KEY = geminiApiKey || Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VERTEX_API_KEY") || null;
    const GCP_SERVICE_ACCOUNT = gcpServiceAccount || Deno.env.get("GCP_SERVICE_ACCOUNT") || null;
    const GCP_PROJECT_ID = gcpProjectId || Deno.env.get("GCP_PROJECT_ID") || null;
    const GCP_REGION = gcpRegion;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || null;
    // Mesmo padrão do LOVABLE_API_KEY: secret de projeto (não por-workspace),
    // sem override via body/aiNode.properties (item 1 não expõe campo de key
    // na UI - ver WhatsAppBotConfig.tsx, molde estrutural = branch lovable).
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || null;

    let reply = "";
    // Auto-map removed Google models to a currently supported Gemini model.
    const rawModel = normalizeGoogleModel(modelName, provider);

    if (provider === "vertex_ai" && GCP_SERVICE_ACCOUNT && GCP_PROJECT_ID) {
      // 1. Google Cloud Vertex AI Mode
      console.log(`[bot-reply] Using Vertex AI mode with model: ${rawModel}`);
      const token = await getGCPToken(GCP_SERVICE_ACCOUNT);
      const vertexUrl = `https://${GCP_REGION}-aiplatform.googleapis.com/v1/projects/${GCP_PROJECT_ID}/locations/${GCP_REGION}/publishers/google/models/${rawModel}:generateContent`;

      const bodyPayload: GeminiRequestBody = { contents };
      if (systemInstruction) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const { res: aiRes, attempts } = await fetchWithRetry(vertexUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        console.warn(`[bot-reply] Vertex AI API failed after ${attempts} attempt(s), attempting fallback to Generative Language API...`, aiRes.status, detail);

        const fallbackToken = await getGCPToken(GCP_SERVICE_ACCOUNT, "https://www.googleapis.com/auth/generative-language");
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${rawModel}:generateContent`;
        const { res: fallbackRes, attempts: fallbackAttempts } = await fetchWithRetry(fallbackUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${fallbackToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
        });

        if (!fallbackRes.ok) {
          const fallbackDetail = await fallbackRes.text();
          console.error(`[bot-reply] Fallback Generative Language API failed as well after ${fallbackAttempts} attempt(s):`, fallbackRes.status, fallbackDetail);
          throw new Error(`Vertex AI falhou após ${attempts} tentativa(s) (${aiRes.status}: ${detail}) e Generative Language API falhou após ${fallbackAttempts} tentativa(s) (${fallbackRes.status}: ${fallbackDetail})`);
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

      const bodyPayload: GeminiRequestBody = { contents };
      if (systemInstruction) {
        bodyPayload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        };
      }

      const { res: aiRes, attempts } = await fetchWithRetry(geminiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyPayload),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        console.error(`[bot-reply] Gemini Developer API error after ${attempts} attempt(s)`, aiRes.status, detail);
        throw new Error(`Gemini Developer API retornou status ${aiRes.status} após ${attempts} tentativa(s): ${detail}`);
      }

      const aiData = await aiRes.json();
      reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    } else if (provider === "lovable" && LOVABLE_API_KEY) {
      // 3. Lovable AI Gateway Mode
      let modelToUse = normalizeGoogleModel(modelName, provider);
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

      const { res: aiRes, attempts } = await fetchWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
        console.error(`[bot-reply] Lovable AI Gateway error after ${attempts} attempt(s)`, aiRes.status, detail);
        if (aiRes.status === 429) throw new Error(`Limite de requisições excedido no Lovable AI Gateway (429) após ${attempts} tentativa(s).`);
        if (aiRes.status === 402) throw new Error("Créditos esgotados no Lovable AI Gateway (402).");
        throw new Error(`Lovable AI Gateway retornou status ${aiRes.status} após ${attempts} tentativa(s): ${detail}`);
      }

      const aiData = await aiRes.json() as { choices?: Array<{ message?: { content?: string } }> };
      reply = aiData.choices?.[0]?.message?.content?.trim() || "";
    } else if (provider === "anthropic" && ANTHROPIC_API_KEY) {
      // 4. Anthropic Claude API Mode — Etapa 9 item 1, paridade estrita com
      // os 3 providers acima (sem streaming, sem tool-use, sem contagem de
      // token). Molde estrutural: branch lovable (contents -> messages),
      // NUNCA o gemini nativo (conforme docs/architecture/etapa-9-item1-parser-map.md).
      // Diferença de protocolo do lovable: aqui `system` é campo top-level
      // da requisição, não a primeira mensagem do array.
      const anthropicModel = (modelName || "").trim() || ANTHROPIC_DEFAULT_MODEL;
      console.log(`[bot-reply] Using Anthropic Claude API mode with model: ${anthropicModel}`);

      const anthropicMessages = buildAnthropicMessages(contents);

      const { res: aiRes, attempts } = await fetchWithRetry("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: anthropicModel,
          max_tokens: 1024,
          system: systemInstruction || undefined,
          messages: anthropicMessages,
        }),
      });

      if (!aiRes.ok) {
        const detail = await aiRes.text();
        console.error(`[bot-reply] Anthropic API error after ${attempts} attempt(s)`, aiRes.status, detail);
        if (aiRes.status === 429) throw new Error(`Limite de requisições excedido na API Anthropic (429) após ${attempts} tentativa(s).`);
        if (aiRes.status === 529) throw new Error(`API Anthropic sobrecarregada (529) após ${attempts} tentativa(s).`);
        throw new Error(`API Anthropic retornou status ${aiRes.status} após ${attempts} tentativa(s): ${detail}`);
      }

      const aiData = await aiRes.json();
      reply = parseAnthropicReply(aiData);
    } else {
      console.error("[bot-reply] Error: Provider configuration is invalid or missing keys.");
      throw new Error(`Configuração do provedor '${provider}' inválida ou chaves/credenciais não preenchidas.`);
    }

    // Format reply using Send Node template if available (G8 fix: flowNodes is
    // now declared in the outer scope, so it's actually in scope here — see
    // docs/qa/etapa-6-g8-flownodes.md)
    const finalReply = applySendTemplate(flowNodes, reply);

    if (isTest) {
      return json({ ok: true, reply: finalReply });
    }

    // Send via uazapi
    const activeUazBase = baseForStoredSubdomain(instance.subdomain);
    console.log(`[bot-reply] Sending reply to ${conv.contact_phone} using uazapi at ${activeUazBase}...`);
    const sendRes = await fetch(`${activeUazBase}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instance.instance_token },
      body: JSON.stringify({ number: conv.contact_phone, text: finalReply }),
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
      content: finalReply,
      body: finalReply,
      status: "sent",
      timestamp: new Date().toISOString(),
    });

    await adminClient.from("whatsapp_conversations").update({
      last_message: finalReply,
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
