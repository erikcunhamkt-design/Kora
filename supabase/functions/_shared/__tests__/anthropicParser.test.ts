import { describe, expect, it } from "vitest";
import { buildAnthropicMessages, parseAnthropicReply } from "../anthropicParser";

describe("buildAnthropicMessages", () => {
  it("mapeia role Gemini local (user/model) para role Anthropic (user/assistant)", () => {
    const contents = [
      { role: "user", parts: [{ text: "Oi" }] },
      { role: "model", parts: [{ text: "Olá! Como posso ajudar?" }] },
      { role: "user", parts: [{ text: "Quero saber o preço" }] },
    ];
    expect(buildAnthropicMessages(contents)).toEqual([
      { role: "user", content: "Oi" },
      { role: "assistant", content: "Olá! Como posso ajudar?" },
      { role: "user", content: "Quero saber o preço" },
    ]);
  });

  it("nao inclui campo system - separado por design da Anthropic Messages API", () => {
    const result = buildAnthropicMessages([{ role: "user", parts: [{ text: "Oi" }] }]);
    expect(result[0]).not.toHaveProperty("system");
    expect(Object.keys(result[0])).toEqual(["role", "content"]);
  });
});

describe("parseAnthropicReply", () => {
  it("resposta valida: extrai texto do unico bloco type:text", () => {
    const data = {
      content: [{ type: "text", text: "Olá! Tudo bem, e você?" }],
      stop_reason: "end_turn",
    };
    expect(parseAnthropicReply(data)).toBe("Olá! Tudo bem, e você?");
  });

  it("bloco nao-text: ignora blocos que nao sejam type:text, sem quebrar", () => {
    const data = {
      content: [
        { type: "thinking", text: "raciocinando..." },
        { type: "text", text: "Resposta final." },
      ],
      stop_reason: "end_turn",
    };
    expect(parseAnthropicReply(data)).toBe("Resposta final.");
  });

  it("todos os blocos nao-text: devolve string vazia, nao lanca erro", () => {
    const data = {
      content: [{ type: "tool_use", text: undefined }],
      stop_reason: "tool_use",
    };
    expect(parseAnthropicReply(data)).toBe("");
  });

  it("content ausente/nao-array: devolve string vazia", () => {
    expect(parseAnthropicReply({})).toBe("");
    expect(parseAnthropicReply({ content: undefined })).toBe("");
  });

  it("erro de API (corpo type:error): lanca com a mensagem do erro", () => {
    const data = {
      type: "error",
      error: { type: "overloaded_error", message: "Overloaded" },
    };
    expect(() => parseAnthropicReply(data)).toThrow(/Overloaded/);
  });

  it("erro de API (campo error sem type:error): lanca tambem", () => {
    const data = { error: { type: "invalid_request_error", message: "model: field required" } };
    expect(() => parseAnthropicReply(data)).toThrow(/model: field required/);
  });

  it("concatena multiplos blocos text (defensivo, ainda que operacao normal so produza um)", () => {
    const data = {
      content: [
        { type: "text", text: "Parte 1. " },
        { type: "text", text: "Parte 2." },
      ],
    };
    expect(parseAnthropicReply(data)).toBe("Parte 1. Parte 2.");
  });
});
