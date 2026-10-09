// Etapa 9 · item 3 — fonte da categoria A ("itens já orçados") e SANITIZAÇÃO
// (docs/qa/etapa-9-item3-r1-base-conhecimento-liga.md). O ponto central: o nome
// de um item é TEXTO LIVRE e pode carregar nome de cliente — nada disso pode
// chegar ao prompt. Na dúvida o item NÃO entra.
import { describe, expect, it } from "vitest";
import {
  QUOTED_ITEMS_MIN_QUOTES,
  QUOTED_ITEM_MAX_NAME_CHARS,
  aggregateQuotedItems,
  buildClientTerms,
  collectClientNames,
  flattenQuotedItems,
  formatQuotedItem,
  normalizeForMatch,
  quotedItemLines,
  sanitizeItemName,
} from "../knowledgeSources";

const q = (id: string, status: string, items: Array<{ name: unknown; unit_price: unknown }>, extra: Record<string, unknown> = {}) => ({
  id,
  status,
  archived: false,
  deleted_at: null,
  client_name: null,
  company: null,
  quote_items: items,
  ...extra,
});

describe("normalizeForMatch / buildClientTerms", () => {
  it("minúsculas, sem acento, espaços colapsados", () => {
    expect(normalizeForMatch("  Gestão   DE Tráfego ")).toBe("gestao de trafego");
  });

  it("termos: frase inteira + cada palavra de 4+ letras; palavras curtas ficam de fora", () => {
    const terms = buildClientTerms(["Maria da Silva", "Farmácia São João Ltda"]);
    expect(terms).toEqual(expect.arrayContaining(["maria da silva", "maria", "silva", "farmacia sao joao ltda", "farmacia", "joao", "ltda"]));
    expect(terms).not.toContain("da");
    expect(terms).not.toContain("sao"); // 3 letras
  });

  it("ignora entradas inválidas e nomes curtíssimos", () => {
    expect(buildClientTerms([null, undefined, "", "ab", 42 as unknown as string])).toEqual([]);
  });
});

describe("sanitizeItemName — camada 1 (forma) e camada 2 (cliente)", () => {
  it("nome de serviço normal passa, com espaços colapsados", () => {
    expect(sanitizeItemName("  Landing   Page ")).toBe("Landing Page");
    expect(sanitizeItemName("Gestão de Tráfego Mensal")).toBe("Gestão de Tráfego Mensal");
  });

  it("não-string, vazio e só-espaço -> rejeitado", () => {
    for (const bad of [null, undefined, 42, {}, "", "   "]) expect(sanitizeItemName(bad)).toBeNull();
  });

  it("e-mail, @handle e URL -> rejeitado", () => {
    expect(sanitizeItemName("Site para contato@empresa.com")).toBeNull();
    expect(sanitizeItemName("Gestão do @loja_da_maria")).toBeNull();
    expect(sanitizeItemName("Landing em www.cliente.com.br")).toBeNull();
    expect(sanitizeItemName("Redesign https://exemplo.io/x")).toBeNull();
    expect(sanitizeItemName("Hospedagem meusite.com")).toBeNull();
  });

  it("telefone / CPF / CNPJ (8+ dígitos) -> rejeitado; ano e quantidade pequena passam", () => {
    expect(sanitizeItemName("Contato 11 99999-8888")).toBeNull();
    expect(sanitizeItemName("Projeto 123.456.789-09")).toBeNull();
    expect(sanitizeItemName("Pacote 12 posts")).toBe("Pacote 12 posts");
    expect(sanitizeItemName("Calendário 2026")).toBe("Calendário 2026");
  });

  it("nome longo demais (descrição, não serviço) -> rejeitado", () => {
    expect(sanitizeItemName("x".repeat(QUOTED_ITEM_MAX_NAME_CHARS))).not.toBeNull();
    expect(sanitizeItemName("x".repeat(QUOTED_ITEM_MAX_NAME_CHARS + 1))).toBeNull();
  });

  it("CLIENTE: nome do item que cita um cliente cadastrado é rejeitado (frase inteira OU primeiro nome com 4+ letras), sem acento/caixa", () => {
    const terms = buildClientTerms(["Maria Silva", "Farmácia São João"]);
    expect(sanitizeItemName("Landing Page para Maria", terms)).toBeNull();
    expect(sanitizeItemName("LANDING PAGE — MARIA SILVA", terms)).toBeNull();
    expect(sanitizeItemName("Identidade visual Farmacia Sao Joao", terms)).toBeNull();
    expect(sanitizeItemName("Social Media do Joao", terms)).toBeNull();
  });

  it("CLIENTE: palavra inteira — 'Mariana' não é bloqueada por cliente 'Maria' nem 'Silvana' por 'Silva'", () => {
    const terms = buildClientTerms(["Maria Silva"]);
    expect(sanitizeItemName("Pacote Mariana", terms)).toBe("Pacote Mariana");
    expect(sanitizeItemName("Kit Silvana", terms)).toBe("Kit Silvana");
  });

  it("sem clientes cadastrados, a camada 2 não rejeita nada por conta própria", () => {
    expect(sanitizeItemName("Landing Page para Maria", [])).toBe("Landing Page para Maria");
  });
});

describe("flattenQuotedItems (filtro reaplicado em código + forma defensiva)", () => {
  it("só orçamentos que JÁ SAÍRAM entram: rascunho, arquivado e excluído ficam fora", () => {
    const rows = flattenQuotedItems([
      q("a", "draft", [{ name: "X", unit_price: 1 }]),
      q("b", "sent", [{ name: "Y", unit_price: 1 }]),
      q("c", "approved", [{ name: "Z", unit_price: 1 }]),
      q("d", "rejected", [{ name: "W", unit_price: 1 }]),
      q("e", "sent", [{ name: "V", unit_price: 1 }], { archived: true }),
      q("f", "sent", [{ name: "U", unit_price: 1 }], { deleted_at: "2026-01-01" }),
    ]);
    expect(rows.map((r) => r.quoteId)).toEqual(["b", "c", "d"]);
  });

  it("forma inesperada (não-array, lixo, item sem quote_items) -> sem linhas, nunca lança", () => {
    expect(flattenQuotedItems(null)).toEqual([]);
    expect(flattenQuotedItems({})).toEqual([]);
    expect(flattenQuotedItems([null, 7, { id: 1 }, { id: "x", status: "sent" }])).toEqual([]);
  });

  it("archived null (coluna nullable) conta como NÃO arquivado", () => {
    expect(flattenQuotedItems([q("a", "sent", [{ name: "X", unit_price: 1 }], { archived: null })])).toHaveLength(1);
  });
});

describe("collectClientNames", () => {
  it("junta name/company de clientes e client_name/company dos orçamentos", () => {
    expect(
      collectClientNames({
        clients: [{ name: "Maria", company: "Silva ME" }, { name: "João" }],
        quotes: [{ client_name: "Pedro", company: "Loja X" }],
      }).sort(),
    ).toEqual(["João", "Loja X", "Maria", "Pedro", "Silva ME"]);
  });

  it("entradas inválidas -> []", () => {
    expect(collectClientNames({ clients: null, quotes: "x" })).toEqual([]);
  });
});

describe("aggregateQuotedItems — camada 3 (k-anonimato) e agregação", () => {
  it("agrega por nome (sem acento/caixa) contando ORÇAMENTOS distintos, com faixa de preço", () => {
    const rows = flattenQuotedItems([
      q("1", "approved", [{ name: "Landing Page", unit_price: 3800 }]),
      q("2", "sent", [{ name: "landing page", unit_price: 4500 }]),
      q("3", "sent", [{ name: "Landing Page", unit_price: 4200 }, { name: "Landing Page", unit_price: 4200 }]), // mesmo orçamento 2x = 1
    ]);
    const [item] = aggregateQuotedItems(rows, []);
    expect(item).toEqual({ name: "Landing Page", quotes: 3, minPrice: 3800, maxPrice: 4500 });
  });

  it("k-anonimato: item que aparece em UM orçamento só não entra (mínimo = 2)", () => {
    expect(QUOTED_ITEMS_MIN_QUOTES).toBe(2);
    const rows = flattenQuotedItems([
      q("1", "sent", [{ name: "Landing Page", unit_price: 1 }, { name: "Site institucional da Maria", unit_price: 9 }]),
      q("2", "sent", [{ name: "Landing Page", unit_price: 1 }]),
    ]);
    expect(aggregateQuotedItems(rows, []).map((i) => i.name)).toEqual(["Landing Page"]);
  });

  it("o mesmo item repetido DENTRO de um orçamento não burla o k-anonimato", () => {
    const rows = flattenQuotedItems([q("1", "sent", [{ name: "Item X", unit_price: 1 }, { name: "Item X", unit_price: 1 }])]);
    expect(aggregateQuotedItems(rows, [])).toEqual([]);
  });

  it("cliente cadastrado mascarado MESMO repetindo em 2 orçamentos (o caso que o k-anonimato sozinho não pega)", () => {
    const rows = flattenQuotedItems([
      q("1", "sent", [{ name: "Landing Page para Maria", unit_price: 1 }, { name: "Social Media", unit_price: 1 }]),
      q("2", "sent", [{ name: "Landing Page para Maria", unit_price: 1 }, { name: "Social Media", unit_price: 1 }]),
    ]);
    expect(aggregateQuotedItems(rows, ["Maria Souza"]).map((i) => i.name)).toEqual(["Social Media"]);
  });

  it("preço ausente/inválido não quebra: item entra sem faixa", () => {
    const rows = flattenQuotedItems([
      q("1", "sent", [{ name: "Consultoria", unit_price: null }]),
      q("2", "sent", [{ name: "Consultoria", unit_price: "abc" }]),
    ]);
    expect(aggregateQuotedItems(rows, [])).toEqual([{ name: "Consultoria", quotes: 2, minPrice: null, maxPrice: null }]);
  });

  it("ordem determinística: mais orçado primeiro, empate por nome", () => {
    const rows = flattenQuotedItems([
      q("1", "sent", [{ name: "Beta", unit_price: 1 }, { name: "Alfa", unit_price: 1 }, { name: "Gama", unit_price: 1 }]),
      q("2", "sent", [{ name: "Beta", unit_price: 1 }, { name: "Alfa", unit_price: 1 }, { name: "Gama", unit_price: 1 }]),
      q("3", "sent", [{ name: "Gama", unit_price: 1 }]),
    ]);
    expect(aggregateQuotedItems(rows, []).map((i) => i.name)).toEqual(["Gama", "Alfa", "Beta"]);
  });
});

describe("formatQuotedItem / quotedItemLines", () => {
  it("faixa de preço, preço único e sem preço", () => {
    expect(formatQuotedItem({ name: "Landing Page", quotes: 5, minPrice: 3800, maxPrice: 4500 })).toBe(
      "Já orçado: Landing Page — em 5 orçamentos, preço unitário de R$ 3.800 a R$ 4.500",
    );
    expect(formatQuotedItem({ name: "Logo", quotes: 2, minPrice: 900, maxPrice: 900 })).toBe(
      "Já orçado: Logo — em 2 orçamentos, preço unitário R$ 900",
    );
    expect(formatQuotedItem({ name: "Consultoria", quotes: 3, minPrice: null, maxPrice: null })).toBe(
      "Já orçado: Consultoria — em 3 orçamentos",
    );
  });

  it("centavos só quando existem; moeda inválida cai em BRL sem lançar", () => {
    expect(formatQuotedItem({ name: "X", quotes: 2, minPrice: 1250.5, maxPrice: 1250.5 })).toContain("R$ 1.250,50");
    expect(() => formatQuotedItem({ name: "X", quotes: 2, minPrice: 10, maxPrice: 10 }, "???")).not.toThrow();
  });

  it("ponta a ponta: cru -> linhas, sem NENHUM campo de cliente nem texto livre de orçamento no resultado", () => {
    const raw = [
      q("1", "approved", [{ name: "Landing Page", unit_price: 4000 }], {
        client_name: "Maria Souza", company: "Souza ME", title: "Proposta confidencial p/ Maria", notes: "ligar 11 98888-7777", description: "segredo",
      }),
      q("2", "sent", [{ name: "Landing Page", unit_price: 4400 }], { client_name: "João Lima" }),
    ];
    const lines = quotedItemLines(raw, collectClientNames({ quotes: raw }));
    expect(lines).toEqual(["Já orçado: Landing Page — em 2 orçamentos, preço unitário de R$ 4.000 a R$ 4.400"]);
    const out = lines.join("\n");
    for (const leaked of ["Maria", "Souza", "João", "Lima", "confidencial", "98888", "segredo"]) {
      expect(out).not.toContain(leaked);
    }
  });
});
