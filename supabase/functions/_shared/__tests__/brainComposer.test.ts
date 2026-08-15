import { describe, expect, it } from "vitest";
import { BRAIN_SECTION_HEADER, composeSystemInstruction } from "../brainComposer";

describe("composeSystemInstruction", () => {
  it("cerebro null: devolve systemInstruction INALTERADO, byte-a-byte identico", () => {
    const original = "Você é um atendente cordial e prestativo. Responda de forma clara, breve e em português.";
    expect(composeSystemInstruction(null, original)).toBe(original);
  });

  it("cerebro undefined: idem, byte-a-byte identico", () => {
    const original = "Instrução qualquer do fluxo.";
    expect(composeSystemInstruction(undefined, original)).toBe(original);
  });

  it("cerebro com todos os campos vazios/so-espaco: idem, byte-a-byte identico", () => {
    const original = "Instrução qualquer do fluxo.";
    const empty = { tone: "", talkAbout: "   ", dontTalkAbout: null, productsServices: undefined, limits: "\n\t" };
    expect(composeSystemInstruction(empty, original)).toBe(original);
  });

  it("um campo preenchido: preambulo rotulado com so esse campo, cabecalho presente", () => {
    const original = "Instrução do fluxo.";
    const result = composeSystemInstruction({ tone: "formal e direto" }, original);
    expect(result).toBe(`${BRAIN_SECTION_HEADER}\n- Tom: formal e direto\n\n${original}`);
  });

  it("todos os campos preenchidos: preambulo com todos, na ordem tom/fala/nao-fala/produtos/limites", () => {
    const original = "Instrução do fluxo.";
    const result = composeSystemInstruction(
      {
        tone: "descontraído",
        talkAbout: "planos de assinatura",
        dontTalkAbout: "concorrentes",
        productsServices: "consultoria e SaaS",
        limits: "não fecha vendas, só qualifica",
      },
      original,
    );
    expect(result).toBe(
      [
        "Sobre a empresa:",
        "- Tom: descontraído",
        "- Fale sobre: planos de assinatura",
        "- Não fale sobre: concorrentes",
        "- Produtos/serviços: consultoria e SaaS",
        "- Limites: não fecha vendas, só qualifica",
        "",
        original,
      ].join("\n"),
    );
  });

  it("campos com espacos extras sao trimados no preambulo", () => {
    const result = composeSystemInstruction({ tone: "  formal  " }, "x");
    expect(result).toBe(`${BRAIN_SECTION_HEADER}\n- Tom: formal\n\nx`);
  });

  it("systemInstruction vazio + cerebro preenchido: so o preambulo, sem separador sobrando no final", () => {
    const result = composeSystemInstruction({ tone: "formal" }, "");
    expect(result).toBe(`${BRAIN_SECTION_HEADER}\n- Tom: formal`);
  });

  it("systemInstruction vazio + cerebro vazio: string vazia (nunca quebra, nunca undefined)", () => {
    expect(composeSystemInstruction(null, "")).toBe("");
  });
});
