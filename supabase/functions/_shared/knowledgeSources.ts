// Etapa 9 · Item 3 (base de conhecimento) — FONTE da categoria A, "itens já
// orçados" (decisão Q1 do revisor; docs/qa/etapa-9-item3-r1-base-conhecimento-
// liga.md). Pure logic — sem Deno.*, sem npm: imports — mesmo padrão de
// brainComposer.ts/knowledgeConsent.ts, testável via vitest sem banco.
//
// O QUE É LIDO: só `quote_items.name` + `quote_items.unit_price`, agregados por
// nome entre orçamentos que JÁ SAÍRAM (enviado/aprovado/recusado). Nunca o texto
// livre de `quotes` (título, descrição, notas, nome/e-mail/whatsapp/empresa do
// cliente), nunca quantidades por cliente.
//
// O PROBLEMA QUE ESTE MÓDULO RESOLVE: `quote_items.name` TAMBÉM é texto livre
// digitado pelo operador ("Landing Page para a Maria") — nome de cliente pode
// estar DENTRO do nome do item. A sanitização é em camadas, conservadora (na
// dúvida, o item NÃO entra — bloco menor é aceitável, vazamento não):
//   1. forma:   sem e-mail/@handle/URL, sem sequência longa de dígitos (telefone,
//               CPF/CNPJ), sem nome longo (descrição, não nome de serviço);
//   2. cliente: sem nenhum nome/empresa de cliente CADASTRADO do workspace
//               (nome inteiro OU qualquer palavra do nome com 4+ letras);
//   3. k-anonimato: o item só entra se aparece em >= 2 ORÇAMENTOS distintos —
//               um nome que se repete é, quase sempre, nome de serviço; o texto
//               que aparece uma vez só é o que costuma carregar contexto de um
//               cliente específico.
// Limite técnico assumido (Fase A §1.3): texto livre não tem garantia total — o
// aviso na UI e o opt-in explícito cobrem o resto.

/** Orçamentos que "já saíram" — rascunho (inacabado) e arquivado/excluído ficam fora. */
export const QUOTED_STATUSES: readonly string[] = ["sent", "approved", "rejected"];

/** k-anonimato: item precisa aparecer em N orçamentos distintos pra entrar. */
export const QUOTED_ITEMS_MIN_QUOTES = 2;

/** Nome de item maior que isso é descrição/frase, não nome de serviço. */
export const QUOTED_ITEM_MAX_NAME_CHARS = 80;

// ---------------------------------------------------------------------------
// Normalização
// ---------------------------------------------------------------------------

// minúsculas, sem acento, espaços colapsados — chave de comparação e de agregação.
export function normalizeForMatch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// "palavra inteira" sem depender de \b (que não trata acentos): vizinhos
// precisam ser não-letra/não-dígito (o texto já vem normalizado, sem acento).
function containsWholePhrase(haystackNorm: string, needleNorm: string): boolean {
  if (!needleNorm) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(needleNorm)}($|[^a-z0-9])`).test(haystackNorm);
}

// ---------------------------------------------------------------------------
// Camada 2 — nomes de cliente
// ---------------------------------------------------------------------------

/**
 * Prepara os termos a mascarar a partir dos nomes/empresas de cliente do
 * workspace: a frase inteira (normalizada) e cada palavra com 4+ letras.
 * Palavras curtas ("de", "da", "ltda") ficam de fora — evita derrubar item por
 * stopword; custo aceito: nome de cliente curtíssimo (≤3 letras) só casa pela
 * frase inteira.
 */
export function buildClientTerms(clientNames: Array<string | null | undefined>): string[] {
  const terms = new Set<string>();
  for (const raw of clientNames) {
    if (typeof raw !== "string") continue;
    const norm = normalizeForMatch(raw);
    if (norm.length < 3) continue;
    terms.add(norm);
    for (const word of norm.split(/[^a-z0-9]+/)) {
      if (word.length >= 4) terms.add(word);
    }
  }
  return [...terms];
}

// ---------------------------------------------------------------------------
// Camadas 1 e 2 — sanitização de UM nome de item
// ---------------------------------------------------------------------------

const EMAIL_OR_HANDLE = /@/;
const URL_LIKE = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|br)\b)/i;

/**
 * Devolve o nome limpo (espaços colapsados) ou `null` se o item não pode entrar.
 * `clientTerms` vem de `buildClientTerms`.
 */
export function sanitizeItemName(raw: unknown, clientTerms: string[] = []): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (name.length === 0 || name.length > QUOTED_ITEM_MAX_NAME_CHARS) return null;

  if (EMAIL_OR_HANDLE.test(name)) return null;
  if (URL_LIKE.test(name)) return null;
  // 8+ dígitos no total = telefone/CPF/CNPJ/identificador (preço e ano não chegam lá)
  if (name.replace(/\D/g, "").length >= 8) return null;

  const norm = normalizeForMatch(name);
  for (const term of clientTerms) {
    if (containsWholePhrase(norm, term)) return null;
  }
  return name;
}

// ---------------------------------------------------------------------------
// Entrada crua -> linhas planas
// ---------------------------------------------------------------------------

export interface QuotedItemRow {
  quoteId: string;
  name: unknown;
  unitPrice: unknown;
}

export interface ClientNameSources {
  clients?: unknown;
  quotes?: unknown;
}

/**
 * Achata o resultado cru de `quotes` (com `quote_items` embutido) em linhas
 * (orçamento, item) — reaplicando em CÓDIGO o filtro de status/arquivado/excluído
 * (nunca confia só na query) — e extrai os nomes de cliente pra mascaramento.
 * Defensivo: forma inesperada vira "sem linhas", nunca lança.
 */
export function flattenQuotedItems(rawQuotes: unknown): QuotedItemRow[] {
  if (!Array.isArray(rawQuotes)) return [];
  const rows: QuotedItemRow[] = [];
  for (const q of rawQuotes) {
    if (!q || typeof q !== "object") continue;
    const quote = q as Record<string, unknown>;
    if (typeof quote.id !== "string") continue;
    if (typeof quote.status !== "string" || !QUOTED_STATUSES.includes(quote.status)) continue;
    if (quote.archived === true) continue;
    if (quote.deleted_at !== null && quote.deleted_at !== undefined) continue;
    if (!Array.isArray(quote.quote_items)) continue;
    for (const item of quote.quote_items) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      rows.push({ quoteId: quote.id, name: it.name, unitPrice: it.unit_price });
    }
  }
  return rows;
}

/** Nomes/empresas de cliente vistos nos orçamentos e no cadastro — SÓ pra mascarar, nunca saem. */
export function collectClientNames(sources: ClientNameSources): string[] {
  const out: string[] = [];
  const pick = (rows: unknown, keys: string[]) => {
    if (!Array.isArray(rows)) return;
    for (const r of rows) {
      if (!r || typeof r !== "object") continue;
      for (const k of keys) {
        const v = (r as Record<string, unknown>)[k];
        if (typeof v === "string") out.push(v);
      }
    }
  };
  pick(sources.clients, ["name", "company"]);
  pick(sources.quotes, ["client_name", "company"]);
  return out;
}

// ---------------------------------------------------------------------------
// Camada 3 — agregação com k-anonimato
// ---------------------------------------------------------------------------

export interface AggregatedItem {
  name: string;
  /** Orçamentos DISTINTOS em que o item aparece. */
  quotes: number;
  minPrice: number | null;
  maxPrice: number | null;
}

export function aggregateQuotedItems(
  rows: QuotedItemRow[],
  clientNames: Array<string | null | undefined>,
  minQuotes: number = QUOTED_ITEMS_MIN_QUOTES,
): AggregatedItem[] {
  const clientTerms = buildClientTerms(clientNames);
  const groups = new Map<
    string,
    { display: string; quoteIds: Set<string>; min: number | null; max: number | null }
  >();

  for (const row of rows) {
    const clean = sanitizeItemName(row.name, clientTerms);
    if (clean === null) continue;
    const key = normalizeForMatch(clean);
    let g = groups.get(key);
    if (!g) {
      g = { display: clean, quoteIds: new Set(), min: null, max: null };
      groups.set(key, g);
    }
    g.quoteIds.add(row.quoteId);
    const price = typeof row.unitPrice === "number" && Number.isFinite(row.unitPrice) && row.unitPrice >= 0 ? row.unitPrice : null;
    if (price !== null) {
      g.min = g.min === null ? price : Math.min(g.min, price);
      g.max = g.max === null ? price : Math.max(g.max, price);
    }
  }

  return [...groups.values()]
    .filter((g) => g.quoteIds.size >= minQuotes)
    .map((g) => ({ name: g.display, quotes: g.quoteIds.size, minPrice: g.min, maxPrice: g.max }))
    .sort((a, b) => b.quotes - a.quotes || a.name.localeCompare(b.name, "pt-BR"));
}

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

function formatMoney(value: number, currency: string): string {
  // inteiro -> sem casas ("R$ 4.200"); com centavos -> sempre 2 ("R$ 1.250,50", nunca "1.250,5")
  const fraction = Number.isInteger(value) ? 0 : 2;
  const options = { style: "currency", currency, minimumFractionDigits: fraction, maximumFractionDigits: fraction } as const;
  let text: string;
  try {
    text = new Intl.NumberFormat("pt-BR", options).format(value);
  } catch {
    // código de moeda inválido -> BRL (nunca lança)
    text = new Intl.NumberFormat("pt-BR", { ...options, currency: "BRL" }).format(value);
  }
  return text.replace(/\xa0/g, " ");
}

export function formatQuotedItem(item: AggregatedItem, currency: string = "BRL"): string {
  const count = `em ${item.quotes} orçamento${item.quotes === 1 ? "" : "s"}`;
  let price = "";
  if (item.minPrice !== null && item.maxPrice !== null) {
    price =
      item.minPrice === item.maxPrice
        ? `, preço unitário ${formatMoney(item.minPrice, currency)}`
        : `, preço unitário de ${formatMoney(item.minPrice, currency)} a ${formatMoney(item.maxPrice, currency)}`;
  }
  return `Já orçado: ${item.name} — ${count}${price}`;
}

/** Ponta a ponta (puro): cru -> linhas prontas pro `buildKnowledgeBlock`. */
export function quotedItemLines(
  rawQuotes: unknown,
  clientNames: Array<string | null | undefined>,
  currency: string = "BRL",
  minQuotes: number = QUOTED_ITEMS_MIN_QUOTES,
): string[] {
  return aggregateQuotedItems(flattenQuotedItems(rawQuotes), clientNames, minQuotes).map((i) =>
    formatQuotedItem(i, currency),
  );
}
