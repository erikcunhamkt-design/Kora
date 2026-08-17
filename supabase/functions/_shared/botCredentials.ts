// Pure logic for resolving qual provider/model/credenciais o
// whatsapp-bot-reply deve usar — extraído do handler pra ficar testável sem
// Deno.serve (mesmo padrão de brainComposer.ts/botFlowTemplate.ts/retry.ts).
//
// G71: aiNode.properties (vindo de flow_data, jsonb) NUNCA é mais a fonte de
// geminiApiKey/gcpServiceAccount/gcpProjectId — mesmo com o nó "ai" presente
// e habilitado, credenciais sempre vêm das colunas dedicadas da própria
// linha whatsapp_bot_settings (bot.*), a fonte real gravada pelo produtor
// (WhatsAppBotConfig.tsx). instruction/provider/model continuam do nó
// visual quando presente — não são segredo, e o nó pode legitimamente
// escolher provider/model diferente do padrão salvo na linha.

export interface BotCredentialsRow {
  system_instruction: string | null;
  provider: string | null;
  model_name: string | null;
  gemini_api_key: string | null;
  gcp_project_id: string | null;
  gcp_region: string | null;
  gcp_service_account: string | null;
}

export interface AiFlowNodeProperties {
  instruction?: string;
  provider?: string;
  model?: string;
}

export interface ResolvedAiConfig {
  systemInstruction: string;
  provider: string;
  modelName: string;
  geminiApiKey: string | null;
  gcpProjectId: string | null;
  gcpRegion: string;
  gcpServiceAccount: string | null;
}

export function resolveAiConfig(
  bot: BotCredentialsRow,
  aiNodeProperties: AiFlowNodeProperties | undefined,
  fallbackInstruction: string,
  defaultModel: string,
  defaultRegion: string,
): ResolvedAiConfig {
  if (aiNodeProperties) {
    return {
      systemInstruction: aiNodeProperties.instruction || fallbackInstruction,
      provider: aiNodeProperties.provider || "gemini_api_key",
      modelName: aiNodeProperties.model || defaultModel,
      geminiApiKey: bot.gemini_api_key || null,
      gcpProjectId: bot.gcp_project_id || null,
      gcpRegion: bot.gcp_region || defaultRegion,
      gcpServiceAccount: bot.gcp_service_account || null,
    };
  }

  // Fallback legado (sem nó "ai" no fluxo visual): mesma lógica de
  // disambiguação por provider já existente antes do G71, intocada.
  let geminiApiKey = bot.gemini_api_key || null;
  let gcpProjectId = bot.gcp_project_id || null;
  let gcpRegion = bot.gcp_region || defaultRegion;
  let gcpServiceAccount = bot.gcp_service_account || null;
  const provider = bot.provider || "gemini_api_key";

  if (provider === "gemini_api_key" && bot.gemini_api_key) {
    geminiApiKey = bot.gemini_api_key;
    gcpServiceAccount = null;
    gcpProjectId = null;
  } else if (provider === "vertex_ai" && bot.gcp_service_account) {
    gcpServiceAccount = bot.gcp_service_account;
    try {
      const parsed = JSON.parse(gcpServiceAccount);
      gcpProjectId = parsed.project_id || bot.gcp_project_id || gcpProjectId;
    } catch {
      gcpProjectId = bot.gcp_project_id || gcpProjectId;
    }
    gcpRegion = bot.gcp_region || gcpRegion;
    geminiApiKey = null;
  }

  return {
    systemInstruction: bot.system_instruction || fallbackInstruction,
    provider,
    modelName: bot.model_name || defaultModel,
    geminiApiKey,
    gcpProjectId,
    gcpRegion,
    gcpServiceAccount,
  };
}
