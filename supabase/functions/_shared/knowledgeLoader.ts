// Etapa 9 · Item 3 (base de conhecimento) — ORQUESTRAÇÃO: consentimento ->
// categorias ativas -> fonte -> bloco rotulado (docs/qa/etapa-9-item3-r1-base-
// conhecimento-liga.md). Pure logic — sem Deno.*, sem npm: imports. O acesso a
// dados é INJETADO (`KnowledgeDataAccess`): whatsapp-bot-reply passa funções que
// consultam o Supabase; os testes passam fakes — é isso que permite provar o
// gate, o teto e a degradação sem banco.
//
// Contrato de segurança (o que NUNCA muda sem decisão do revisor):
//  - default = nada entra: sem tabela, sem linha, erro de leitura -> bloco vazio,
//    bot byte a byte igual ao de antes (fail-open pro comportamento de hoje);
//  - o gate é REAPLICADO aqui (`activeCategories`) — a flag da UI não conta;
//  - só categorias com FONTE implementada são lidas (`IMPLEMENTED_*`): uma linha
//    de consentimento de C/D/E ou B (UI as bloqueia, mas o banco aceita) é
//    IGNORADA — o servidor nunca lê dado que ainda não tem leitura revisada.

import { buildKnowledgeBlock, KNOWLEDGE_BLOCK_MAX_TOKENS } from "./brainComposer.ts";
import {
  activeCategories,
  parseKnowledgeConsents,
  type KnowledgeCategory,
} from "./knowledgeConsent.ts";
import { collectClientNames, quotedItemLines } from "./knowledgeSources.ts";

/** Categorias com fonte implementada e revisada. Hoje só "catalog" (itens já orçados). */
export const IMPLEMENTED_KNOWLEDGE_CATEGORIES: readonly KnowledgeCategory[] = ["catalog"];

export interface DataResult {
  data: unknown;
  error: { message: string } | null;
}

export interface KnowledgeDataAccess {
  /** Linhas de `ai_knowledge_consents` do workspace (colunas snake_case). */
  fetchConsents(): Promise<DataResult>;
  /** `quotes` com `quote_items(name, unit_price)` embutido (+ client_name/company, só pra mascarar). */
  fetchQuotesWithItems(): Promise<DataResult>;
  /** `clients(name, company)` do workspace — só pra mascarar. */
  fetchClients(): Promise<DataResult>;
  /** `workspaces.currency` (ex.: "BRL"). */
  fetchCurrency(): Promise<DataResult>;
}

export interface KnowledgeResult {
  /** Bloco rotulado pronto ("" quando nada entrou). */
  block: string;
  /** Categorias cujo conteúdo REALMENTE entrou no bloco (vazio se o bloco ficou vazio). */
  categories: KnowledgeCategory[];
  included: number;
  /** Itens válidos que ficaram de fora pelo teto de tokens. */
  omitted: number;
}

export const EMPTY_KNOWLEDGE: KnowledgeResult = { block: "", categories: [], included: 0, omitted: 0 };

export interface LoadKnowledgeOptions {
  maxTokens?: number;
  /** Observabilidade (console.warn no handler); o loader nunca lança. */
  warn?: (message: string) => void;
}

export async function loadKnowledgeForPrompt(
  access: KnowledgeDataAccess,
  options: LoadKnowledgeOptions = {},
): Promise<KnowledgeResult> {
  const warn = options.warn ?? (() => {});
  const maxTokens = options.maxTokens ?? KNOWLEDGE_BLOCK_MAX_TOKENS;

  try {
    // 1. Consentimento. Erro (ex.: tabela ainda não existe — migration §8-b) ou
    //    linhas ruins = nenhuma categoria ativa = bot idêntico a hoje.
    const consents = await access.fetchConsents();
    if (consents.error) {
      warn(`knowledge consents unavailable, composing without knowledge: ${consents.error.message}`);
      return EMPTY_KNOWLEDGE;
    }
    const active = activeCategories(parseKnowledgeConsents(consents.data));
    const readable = active.filter((c) => IMPLEMENTED_KNOWLEDGE_CATEGORIES.includes(c));
    if (readable.length === 0) return EMPTY_KNOWLEDGE; // nenhuma leitura de dado de negócio

    // 2. Fonte (hoje só "catalog" = itens já orçados). Falha em qualquer leitura
    //    -> sem bloco (nunca um bloco parcial/sem máscara).
    const [quotes, clients, currency] = await Promise.all([
      access.fetchQuotesWithItems(),
      access.fetchClients(),
      access.fetchCurrency(),
    ]);
    if (quotes.error || clients.error) {
      warn(`knowledge source read failed, composing without knowledge: ${(quotes.error ?? clients.error)!.message}`);
      return EMPTY_KNOWLEDGE;
    }

    const clientNames = collectClientNames({ clients: clients.data, quotes: quotes.data });
    const currencyCode =
      !currency.error && currency.data && typeof currency.data === "object" &&
      typeof (currency.data as Record<string, unknown>).currency === "string"
        ? ((currency.data as Record<string, string>).currency)
        : "BRL";

    const lines = quotedItemLines(quotes.data, clientNames, currencyCode);
    const built = buildKnowledgeBlock(lines, maxTokens);
    if (built.included === 0) return { ...EMPTY_KNOWLEDGE, omitted: built.omitted };

    return {
      block: built.block,
      categories: ["catalog"],
      included: built.included,
      omitted: built.omitted,
    };
  } catch (e) {
    // Nunca derruba a resposta do robô por causa do conhecimento.
    warn(`knowledge loader failed, composing without knowledge: ${(e as Error).message}`);
    return EMPTY_KNOWLEDGE;
  }
}
