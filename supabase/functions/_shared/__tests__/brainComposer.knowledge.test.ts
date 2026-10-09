// Etapa 9 · item 3 (base de conhecimento) — slot de composição ROTULADO no
// ponto único de composição (docs/architecture/etapa-9-item3-base-conhecimento-
// fase-a.md §4; docs/qa/etapa-9-item3-r1-base-conhecimento-fundacao.md).
// Arquivo separado de brainComposer.test.ts (cérebro, item 2) de propósito: o
// que já existia não foi editado — prova de que o 3º parâmetro é aditivo.
import { describe, expect, it } from "vitest";
import {
  BRAIN_SECTION_HEADER,
  KNOWLEDGE_BLOCK_MAX_CHARS,
  KNOWLEDGE_SECTION_HEADER,
  buildKnowledgeBlock,
  composeSystemInstruction,
} from "../brainComposer";

const ORIGINAL = "Instrução do fluxo.";
const KNOWLEDGE = `${KNOWLEDGE_SECTION_HEADER}\n- Landing Page: a partir de R$ 4.200`;

describe("composeSystemInstruction — 3º parâmetro (bloco de conhecimento)", () => {
  it("sem o 3º parâmetro / null / undefined / vazio / só-espaço: saída IDÊNTICA à de antes (zero regressão)", () => {
    const brain = { tone: "formal" };
    const before = composeSystemInstruction(brain, ORIGINAL);
    expect(composeSystemInstruction(brain, ORIGINAL, undefined)).toBe(before);
    expect(composeSystemInstruction(brain, ORIGINAL, null)).toBe(before);
    expect(composeSystemInstruction(brain, ORIGINAL, "")).toBe(before);
    expect(composeSystemInstruction(brain, ORIGINAL, "  \n\t ")).toBe(before);
    expect(composeSystemInstruction(null, ORIGINAL, "")).toBe(ORIGINAL);
  });

  it("ordem fixa: [cérebro, conhecimento, instrução do fluxo]", () => {
    const result = composeSystemInstruction({ tone: "formal" }, ORIGINAL, KNOWLEDGE);
    expect(result).toBe(`${BRAIN_SECTION_HEADER}\n- Tom: formal\n\n${KNOWLEDGE}\n\n${ORIGINAL}`);
  });

  it("blocos ROTULADOS e distintos: cada cabeçalho aparece uma vez, nunca misturados", () => {
    const result = composeSystemInstruction({ tone: "formal" }, ORIGINAL, KNOWLEDGE);
    expect(result.split(BRAIN_SECTION_HEADER)).toHaveLength(2);
    expect(result.split(KNOWLEDGE_SECTION_HEADER)).toHaveLength(2);
    expect(BRAIN_SECTION_HEADER).not.toBe(KNOWLEDGE_SECTION_HEADER);
  });

  it("exclusão seletiva (revogação): tirar SÓ o conhecimento deixa o preâmbulo do cérebro intacto", () => {
    const withKnowledge = composeSystemInstruction({ tone: "formal" }, ORIGINAL, KNOWLEDGE);
    const withoutKnowledge = composeSystemInstruction({ tone: "formal" }, ORIGINAL);
    expect(withoutKnowledge).toBe(`${BRAIN_SECTION_HEADER}\n- Tom: formal\n\n${ORIGINAL}`);
    expect(withKnowledge.replace(`${KNOWLEDGE}\n\n`, "")).toBe(withoutKnowledge);
  });

  it("conhecimento sem cérebro: bloco + instrução, sem separador sobrando", () => {
    expect(composeSystemInstruction(null, ORIGINAL, KNOWLEDGE)).toBe(`${KNOWLEDGE}\n\n${ORIGINAL}`);
    expect(composeSystemInstruction(null, "", KNOWLEDGE)).toBe(KNOWLEDGE);
  });

  it("espaços em volta do bloco são aparados", () => {
    expect(composeSystemInstruction(null, ORIGINAL, `  \n${KNOWLEDGE}\n  `)).toBe(`${KNOWLEDGE}\n\n${ORIGINAL}`);
  });
});

describe("buildKnowledgeBlock", () => {
  it("monta o bloco rotulado, um item por linha, na ordem do chamador", () => {
    const { block, included, omitted } = buildKnowledgeBlock(["Landing Page — R$ 4.200", "Social Media — R$ 1.800"]);
    expect(block).toBe(`${KNOWLEDGE_SECTION_HEADER}\n- Landing Page — R$ 4.200\n- Social Media — R$ 1.800`);
    expect(included).toBe(2);
    expect(omitted).toBe(0);
  });

  it("sem itens utilizáveis -> bloco VAZIO (nunca só o cabeçalho)", () => {
    const empties: Array<Array<string | null | undefined>> = [[], ["", "   ", null, undefined]];
    for (const items of empties) {
      expect(buildKnowledgeBlock(items)).toEqual({ block: "", included: 0, omitted: 0 });
    }
  });

  it("descarta itens vazios no meio e apara espaços", () => {
    const { block, included } = buildKnowledgeBlock(["  a  ", "", null, "b"]);
    expect(block).toBe(`${KNOWLEDGE_SECTION_HEADER}\n- a\n- b`);
    expect(included).toBe(2);
  });

  it("teto: entra item INTEIRO ou não entra; para no primeiro que estoura e conta os omitidos", () => {
    const items = ["x".repeat(30), "y".repeat(30), "z".repeat(30)];
    // cabeçalho (30) + 1 item ("- " + 30 + quebra = 33) = 63; o 2º levaria a 96 > 70
    const { block, included, omitted } = buildKnowledgeBlock(items, 70);
    expect(included).toBe(1);
    expect(omitted).toBe(2);
    expect(block).toBe(`${KNOWLEDGE_SECTION_HEADER}\n- ${"x".repeat(30)}`);
    expect(block.length).toBeLessThanOrEqual(70);
  });

  it("um único item maior que o teto: NÃO é cortado no meio — bloco vazio, omitted conta", () => {
    expect(buildKnowledgeBlock(["w".repeat(500)], 100)).toEqual({ block: "", included: 0, omitted: 1 });
  });

  it("teto default é o provisório da Fase A/R7 e o bloco nunca o ultrapassa", () => {
    const many = Array.from({ length: 500 }, (_, i) => `Item ${i} com descrição razoavelmente longa para encher o bloco`);
    const { block, omitted } = buildKnowledgeBlock(many);
    expect(KNOWLEDGE_BLOCK_MAX_CHARS).toBe(2000);
    expect(block.length).toBeLessThanOrEqual(KNOWLEDGE_BLOCK_MAX_CHARS);
    expect(omitted).toBeGreaterThan(0);
  });
});
