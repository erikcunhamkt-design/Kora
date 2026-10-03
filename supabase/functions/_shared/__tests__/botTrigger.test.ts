// whatsapp-webhook — não invocar whatsapp-bot-reply em conversa já entregue a
// humano (dívida da R4, doc §3: a chamada contava no rate-limit mesmo com a
// function respondendo `skipped`). Testes unitários do helper puro
// (shouldInvokeBotReply) + checagem de FIAÇÃO no fonte do webhook (que roda
// em Deno.serve, sem harness aqui): o webhook precisa decidir pelo helper
// ANTES do fetch pra whatsapp-bot-reply, usando o handover_at da conversa.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { shouldInvokeBotReply } from "../botTrigger";

const inbound = { fromMe: false, kind: "text" };

describe("shouldInvokeBotReply · conversa entregue a humano", () => {
  it("entregue (handover_at ISO preenchido) → NÃO invoca o bot", () => {
    expect(shouldInvokeBotReply({ ...inbound, handoverAt: "2026-10-02T12:00:00.000Z" })).toBe(false);
  });

  it("não entregue (handover_at null — nunca entregue ou já devolvida) → invoca", () => {
    expect(shouldInvokeBotReply({ ...inbound, handoverAt: null })).toBe(true);
  });

  it("coluna ausente (handover_at undefined — migration §8-b pendente / conversa nova) → invoca (degradação, comportamento de antes)", () => {
    expect(shouldInvokeBotReply({ ...inbound, handoverAt: undefined })).toBe(true);
  });

  it("valor não-string / string vazia conta como NÃO entregue — nunca derruba o webhook", () => {
    expect(shouldInvokeBotReply({ ...inbound, handoverAt: "" })).toBe(true);
    expect(shouldInvokeBotReply({ ...inbound, handoverAt: 123 })).toBe(true);
    expect(shouldInvokeBotReply({ ...inbound, handoverAt: {} })).toBe(true);
  });
});

describe("shouldInvokeBotReply · regras que já existiam (regressão)", () => {
  it("mensagem outbound (fromMe) nunca invoca, mesmo não entregue", () => {
    expect(shouldInvokeBotReply({ fromMe: true, kind: "text", handoverAt: null })).toBe(false);
  });

  it("reação nunca invoca, mesmo não entregue", () => {
    expect(shouldInvokeBotReply({ fromMe: false, kind: "reaction", handoverAt: null })).toBe(false);
  });

  it("mídia inbound em conversa não entregue continua invocando", () => {
    expect(shouldInvokeBotReply({ fromMe: false, kind: "image", handoverAt: null })).toBe(true);
  });
});

describe("whatsapp-webhook · fiação (fonte)", () => {
  // CRLF → LF: o arquivo do webhook usa CRLF no working tree (Windows).
  const src = readFileSync(resolve(__dirname, "../../whatsapp-webhook/index.ts"), "utf8").split("\r\n").join("\n");

  it("importa o helper e decide por ele com o handover_at da conversa existente", () => {
    expect(src).toContain('import { shouldInvokeBotReply } from "../_shared/botTrigger.ts"');
    expect(src).toMatch(/shouldInvokeBotReply\(\{[^}]*handoverAt:\s*existingConv\?\.handover_at/);
  });

  it("a decisão vem ANTES do fetch pra whatsapp-bot-reply (não só depois da chamada)", () => {
    const decision = src.indexOf("shouldInvokeBotReply({");
    const invocation = src.indexOf("functions/v1/whatsapp-bot-reply");
    expect(decision).toBeGreaterThan(-1);
    expect(invocation).toBeGreaterThan(decision);
  });

  it("não sobrou a condição antiga que invocava sempre que !fromMe", () => {
    expect(src).not.toContain('if (!fromMe && internalKind !== "reaction") {\n      try {\n        const { data: bot }');
  });
});
