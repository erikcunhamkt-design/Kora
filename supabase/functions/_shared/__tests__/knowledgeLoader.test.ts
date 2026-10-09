// Etapa 9 · item 3 — orquestração consentimento -> fonte -> bloco
// (docs/qa/etapa-9-item3-r1-base-conhecimento-liga.md). O acesso a dados é
// injetado: aqui se prova o gate do SERVIDOR, o teto, a degradação sem tabela e
// que nada é lido quando nenhuma categoria está ativa.
import { describe, expect, it, vi } from "vitest";
import {
  EMPTY_KNOWLEDGE,
  IMPLEMENTED_KNOWLEDGE_CATEGORIES,
  loadKnowledgeForPrompt,
  type KnowledgeDataAccess,
} from "../knowledgeLoader";
import { KNOWLEDGE_SECTION_HEADER, estimateTokens } from "../brainComposer";

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

const consent = (category: string, extra: Record<string, unknown> = {}) => ({
  category, enabled: true, legal_basis_ack: false, revoked_at: null, ...extra,
});

const quote = (id: string, items: Array<{ name: string; unit_price: number }>, extra: Record<string, unknown> = {}) => ({
  id, status: "sent", archived: false, deleted_at: null, client_name: null, company: null, quote_items: items, ...extra,
});

function makeAccess(overrides: Partial<KnowledgeDataAccess> = {}) {
  const access = {
    fetchConsents: vi.fn(() => ok([consent("catalog")])),
    fetchQuotesWithItems: vi.fn(() =>
      ok([
        quote("1", [{ name: "Landing Page", unit_price: 4000 }]),
        quote("2", [{ name: "Landing Page", unit_price: 4400 }]),
      ]),
    ),
    fetchClients: vi.fn(() => ok([])),
    fetchCurrency: vi.fn(() => ok({ currency: "BRL" })),
    ...overrides,
  } as unknown as KnowledgeDataAccess & Record<string, ReturnType<typeof vi.fn>>;
  return access;
}

describe("loadKnowledgeForPrompt — caminho feliz", () => {
  it("categoria A ativa: bloco rotulado com os itens já orçados + metadados", async () => {
    const result = await loadKnowledgeForPrompt(makeAccess());
    expect(result.block).toBe(
      `${KNOWLEDGE_SECTION_HEADER}\n- Já orçado: Landing Page — em 2 orçamentos, preço unitário de R$ 4.000 a R$ 4.400`,
    );
    expect(result.categories).toEqual(["catalog"]);
    expect(result.included).toBe(1);
    expect(result.omitted).toBe(0);
  });

  it("só a A tem fonte implementada (as outras categorias não são lidas)", () => {
    expect([...IMPLEMENTED_KNOWLEDGE_CATEGORIES]).toEqual(["catalog"]);
  });
});

describe("loadKnowledgeForPrompt — DEFAULT OFF e gate reaplicado no servidor", () => {
  it("sem linha de consentimento: bloco vazio e NENHUMA leitura de dado de negócio", async () => {
    const access = makeAccess({ fetchConsents: vi.fn(() => ok([])) } as never);
    const result = await loadKnowledgeForPrompt(access);
    expect(result).toEqual(EMPTY_KNOWLEDGE);
    expect(access.fetchQuotesWithItems).not.toHaveBeenCalled();
    expect(access.fetchClients).not.toHaveBeenCalled();
  });

  it("categoria desligada (enabled=false) ou revogada: nada entra, nada é lido", async () => {
    for (const row of [consent("catalog", { enabled: false }), consent("catalog", { revoked_at: "2026-10-01T00:00:00Z" })]) {
      const access = makeAccess({ fetchConsents: vi.fn(() => ok([row])) } as never);
      expect(await loadKnowledgeForPrompt(access)).toEqual(EMPTY_KNOWLEDGE);
      expect(access.fetchQuotesWithItems).not.toHaveBeenCalled();
    }
  });

  it("C/D/E ligadas SEM atesto (UPDATE direto): ignoradas — nada é lido", async () => {
    const access = makeAccess({
      fetchConsents: vi.fn(() => ok([consent("crm"), consent("conversations"), consent("financial")])),
    } as never);
    expect(await loadKnowledgeForPrompt(access)).toEqual(EMPTY_KNOWLEDGE);
    expect(access.fetchQuotesWithItems).not.toHaveBeenCalled();
  });

  it("C/D/E e B COM atesto/ligadas mas sem fonte implementada: o servidor NÃO lê (só 'catalog' tem leitor)", async () => {
    const access = makeAccess({
      fetchConsents: vi.fn(() =>
        ok([consent("crm", { legal_basis_ack: true }), consent("conversations", { legal_basis_ack: true }), consent("internal_ops")]),
      ),
    } as never);
    expect(await loadKnowledgeForPrompt(access)).toEqual(EMPTY_KNOWLEDGE);
    expect(access.fetchQuotesWithItems).not.toHaveBeenCalled();
  });

  it("A + C ligadas: lê só a A; C continua sem leitura", async () => {
    const access = makeAccess({
      fetchConsents: vi.fn(() => ok([consent("catalog"), consent("crm", { legal_basis_ack: true })])),
    } as never);
    const result = await loadKnowledgeForPrompt(access);
    expect(result.categories).toEqual(["catalog"]);
  });
});

describe("loadKnowledgeForPrompt — DEGRADAÇÃO (bot idêntico a hoje)", () => {
  it("tabela de consentimento ausente (erro de SELECT): bloco vazio, aviso, sem lançar", async () => {
    const warn = vi.fn();
    const access = makeAccess({ fetchConsents: vi.fn(() => fail('relation "ai_knowledge_consents" does not exist')) } as never);
    const result = await loadKnowledgeForPrompt(access, { warn });
    expect(result).toEqual(EMPTY_KNOWLEDGE);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(access.fetchQuotesWithItems).not.toHaveBeenCalled();
  });

  it("consentimento com lixo (não-array/linhas ruins): bloco vazio", async () => {
    for (const data of [null, "lixo", { category: "catalog" }, [null, 3, { category: "x" }]]) {
      const access = makeAccess({ fetchConsents: vi.fn(() => ok(data)) } as never);
      expect(await loadKnowledgeForPrompt(access)).toEqual(EMPTY_KNOWLEDGE);
    }
  });

  it("falha ao ler a fonte (quotes OU clients): bloco vazio — nunca um bloco sem a máscara de clientes", async () => {
    const warn = vi.fn();
    const quotesFail = makeAccess({ fetchQuotesWithItems: vi.fn(() => fail("boom")) } as never);
    expect(await loadKnowledgeForPrompt(quotesFail, { warn })).toEqual(EMPTY_KNOWLEDGE);
    const clientsFail = makeAccess({ fetchClients: vi.fn(() => fail("boom")) } as never);
    expect(await loadKnowledgeForPrompt(clientsFail, { warn })).toEqual(EMPTY_KNOWLEDGE);
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("exceção no acesso a dados: absorvida (bloco vazio), nunca derruba a resposta", async () => {
    const access = makeAccess({ fetchConsents: vi.fn(() => Promise.reject(new Error("rede"))) } as never);
    await expect(loadKnowledgeForPrompt(access)).resolves.toEqual(EMPTY_KNOWLEDGE);
  });

  it("falha só na moeda: segue com BRL (informação auxiliar não derruba o bloco)", async () => {
    const access = makeAccess({ fetchCurrency: vi.fn(() => fail("sem moeda")) } as never);
    const result = await loadKnowledgeForPrompt(access);
    expect(result.included).toBe(1);
    expect(result.block).toContain("R$ 4.000");
  });
});

describe("loadKnowledgeForPrompt — sanitização e teto fim a fim", () => {
  it("nome de cliente mascarado mesmo vindo do cadastro de clientes; nada de campo de cliente no bloco", async () => {
    const access = makeAccess({
      fetchQuotesWithItems: vi.fn(() =>
        ok([
          quote("1", [{ name: "Site para Maria", unit_price: 1 }, { name: "Social Media", unit_price: 1 }], { client_name: "Maria Souza" }),
          quote("2", [{ name: "Site para Maria", unit_price: 1 }, { name: "Social Media", unit_price: 1 }], { client_name: "Maria Souza" }),
        ]),
      ),
      fetchClients: vi.fn(() => ok([{ name: "Maria Souza", company: "Souza ME" }])),
    } as never);
    const result = await loadKnowledgeForPrompt(access);
    expect(result.block).toContain("Social Media");
    expect(result.block).not.toMatch(/Maria|Souza/);
  });

  it("TETO: com muitos itens o bloco respeita o limite de tokens, item inteiro ou nada, e conta os omitidos", async () => {
    const many = Array.from({ length: 400 }, (_, i) => ({ name: `Serviço número ${i} de exemplo`, unit_price: 100 + i }));
    const access = makeAccess({
      fetchQuotesWithItems: vi.fn(() => ok([quote("1", many), quote("2", many)])),
    } as never);
    const result = await loadKnowledgeForPrompt(access, { maxTokens: 500 });
    expect(estimateTokens(result.block)).toBeLessThanOrEqual(500);
    expect(result.included).toBeGreaterThan(0);
    expect(result.omitted).toBeGreaterThan(0);
    expect(result.included + result.omitted).toBe(400);
    // cada linha incluída está inteira (termina no padrão do formato)
    for (const line of result.block.split("\n").slice(1)) {
      expect(line).toMatch(/^- Já orçado: .+ — em 2 orçamentos, preço unitário R\$ [\d.]+$/);
    }
  });

  it("teto default = 2.500 tokens", async () => {
    const many = Array.from({ length: 2000 }, (_, i) => ({ name: `Serviço ${i} descrição curta`, unit_price: 10 }));
    const access = makeAccess({ fetchQuotesWithItems: vi.fn(() => ok([quote("1", many), quote("2", many)])) } as never);
    const result = await loadKnowledgeForPrompt(access);
    expect(estimateTokens(result.block)).toBeLessThanOrEqual(2500);
    expect(result.omitted).toBeGreaterThan(0);
  });

  it("A ativa mas sem item elegível (k-anonimato/sanitização esvaziam): bloco vazio e categories vazio (o simulador não mostra selo)", async () => {
    const access = makeAccess({
      fetchQuotesWithItems: vi.fn(() => ok([quote("1", [{ name: "Item único", unit_price: 1 }])])),
    } as never);
    const result = await loadKnowledgeForPrompt(access);
    expect(result.block).toBe("");
    expect(result.categories).toEqual([]);
    expect(result.included).toBe(0);
  });
});
