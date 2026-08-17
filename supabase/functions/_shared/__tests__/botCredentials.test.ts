import { describe, expect, it } from "vitest";
import { resolveAiConfig, type BotCredentialsRow } from "../botCredentials";

const FALLBACK_INSTRUCTION = "instrucao padrao";
const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_REGION = "us-central1";

function makeBotRow(overrides: Partial<BotCredentialsRow> = {}): BotCredentialsRow {
  return {
    system_instruction: "instrucao da linha",
    provider: "gemini_api_key",
    model_name: "gemini-2.5-flash",
    gemini_api_key: "ROW-REAL-GEMINI-KEY",
    gcp_project_id: "row-project",
    gcp_region: "southamerica-east1",
    gcp_service_account: '{"project_id":"row-project","private_key":"ROW-REAL-PRIVATE-KEY"}',
    ...overrides,
  };
}

describe("resolveAiConfig — G71 (credenciais nunca vem do no visual)", () => {
  it("no 'ai' presente com geminiApiKey EMBUTIDA e diferente da coluna: usa a da LINHA, nao a do no", () => {
    const bot = makeBotRow();
    const resolved = resolveAiConfig(
      bot,
      { instruction: "instrucao do fluxo", provider: "gemini_api_key", model: "gemini-3.6-flash", geminiApiKey: "NODE-STALE-KEY-VINDA-DO-FLOW-DATA" } as never,
      FALLBACK_INSTRUCTION,
      DEFAULT_MODEL,
      DEFAULT_REGION,
    );
    expect(resolved.geminiApiKey).toBe("ROW-REAL-GEMINI-KEY");
    expect(resolved.geminiApiKey).not.toBe("NODE-STALE-KEY-VINDA-DO-FLOW-DATA");
  });

  it("no 'ai' presente com gcpServiceAccount EMBUTIDA e diferente da coluna: usa a da LINHA, nao a do no", () => {
    const bot = makeBotRow({ provider: "vertex_ai", gemini_api_key: null });
    const resolved = resolveAiConfig(
      bot,
      { instruction: "x", provider: "vertex_ai", model: "gemini-2.5-flash-001", gcpServiceAccount: '{"private_key":"NODE-STALE-PRIVATE-KEY"}' } as never,
      FALLBACK_INSTRUCTION,
      DEFAULT_MODEL,
      DEFAULT_REGION,
    );
    expect(resolved.gcpServiceAccount).toBe(bot.gcp_service_account);
    expect(resolved.gcpServiceAccount).not.toContain("NODE-STALE-PRIVATE-KEY");
    expect(resolved.gcpProjectId).toBe("row-project");
  });

  it("no 'ai' presente: instruction/provider/model NAO-segredo continuam vindo do no visual", () => {
    const bot = makeBotRow({ provider: "lovable", model_name: "outro-modelo" });
    const resolved = resolveAiConfig(
      bot,
      { instruction: "instrucao do fluxo visual", provider: "gemini_api_key", model: "gemini-2.5-pro" } as never,
      FALLBACK_INSTRUCTION,
      DEFAULT_MODEL,
      DEFAULT_REGION,
    );
    expect(resolved.systemInstruction).toBe("instrucao do fluxo visual");
    expect(resolved.provider).toBe("gemini_api_key");
    expect(resolved.modelName).toBe("gemini-2.5-pro");
  });

  it("no 'ai' ausente: cai no fallback legado (colunas da linha), comportamento pre-G71 intocado", () => {
    const bot = makeBotRow({ provider: "vertex_ai", gemini_api_key: null, gcp_project_id: null });
    const resolved = resolveAiConfig(bot, undefined, FALLBACK_INSTRUCTION, DEFAULT_MODEL, DEFAULT_REGION);
    expect(resolved.systemInstruction).toBe("instrucao da linha");
    expect(resolved.provider).toBe("vertex_ai");
    expect(resolved.gcpServiceAccount).toBe(bot.gcp_service_account);
    expect(resolved.gcpProjectId).toBe("row-project"); // extraido do JSON da service account
    expect(resolved.geminiApiKey).toBeNull();
  });

  it("no 'ai' ausente e linha sem nenhuma credencial preenchida: cai no fallback com instrucao padrao", () => {
    const bot = makeBotRow({
      system_instruction: null,
      provider: null,
      model_name: null,
      gemini_api_key: null,
      gcp_project_id: null,
      gcp_region: null,
      gcp_service_account: null,
    });
    const resolved = resolveAiConfig(bot, undefined, FALLBACK_INSTRUCTION, DEFAULT_MODEL, DEFAULT_REGION);
    expect(resolved.systemInstruction).toBe(FALLBACK_INSTRUCTION);
    expect(resolved.provider).toBe("gemini_api_key");
    expect(resolved.modelName).toBe(DEFAULT_MODEL);
    expect(resolved.gcpRegion).toBe(DEFAULT_REGION);
    expect(resolved.geminiApiKey).toBeNull();
    expect(resolved.gcpServiceAccount).toBeNull();
  });

  it("no 'ai' presente e bot.gcp_region vazio: cai no defaultRegion recebido", () => {
    const bot = makeBotRow({ gcp_region: null });
    const resolved = resolveAiConfig(
      bot,
      { instruction: "x", provider: "gemini_api_key", model: "m" } as never,
      FALLBACK_INSTRUCTION,
      DEFAULT_MODEL,
      DEFAULT_REGION,
    );
    expect(resolved.gcpRegion).toBe(DEFAULT_REGION);
  });
});
