// Q5 — Precisão monetária da migração de quotes (Etapa 5 · Fatia 3).
//
// Regras (todas na ENTRADA da migração local → Supabase):
//   • Dinheiro é quantizado a 2 casas (centavos) antes de ir para colunas `numeric`,
//     evitando que artefatos de float do JS (ex.: 0.1 + 0.2) virem lixo no banco.
//   • `quote_items.quantity` é `numeric` no schema (Q5b, promovido de `integer` em
//     2026-07-19 — migration 20260719001350): quantidade fracionária local é
//     PRESERVADA, quantizada a 3 casas — não é mais arredondada/achatada.
//   • A consistência `total vs Σ(qty×unit) − discount` é VALIDADA e REPORTADA quando
//     diverge > 1 centavo. NUNCA é "consertada" em silêncio: o total local é a fonte;
//     o relatório apenas alerta o operador antes do clique de import.

import type { Quote, QuoteItem } from "@/hooks/useQuotes";

/** Arredonda um valor monetário a `decimals` casas (default centavos). Não-finito → 0. */
export function roundMoney(value: unknown, decimals = 2): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  // +Number.EPSILON afasta o valor da borda de arredondamento (ex.: 1.005 → 1.01).
  return Math.round((n + Number.EPSILON) * factor) / factor;
}

/** Quantiza uma quantidade a `decimals` casas (default 3 — schema `quote_items.quantity` é `numeric`, Q5b). Não-finito → 0. */
export function roundQuantity(value: unknown, decimals = 3): number {
  return roundMoney(value, decimals);
}

/** `true` quando a quantidade local é fracionária (informativo — preservada desde Q5b, não é mais lossy). */
export function isFractionalQuantity(value: unknown): boolean {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && !Number.isInteger(n);
}

/** Σ(quantity × unit_price) dos itens, quantizado a centavos. */
export function sumItemsTotal(items: readonly QuoteItem[] | undefined | null): number {
  const sum = (items ?? []).reduce(
    (acc, it) => acc + Number(it?.quantity ?? 0) * Number(it?.unitPrice ?? 0),
    0,
  );
  return roundMoney(sum);
}

export interface QuoteMoneyReport {
  /** Σ(qty×unit) quantizado — deveria bater com o subtotal. */
  itemsSum: number;
  /** Desconto local quantizado. */
  discount: number;
  /** Total esperado = itemsSum − discount (quantizado). */
  expectedTotal: number;
  /** Total local quantizado (a fonte; não é sobrescrito). */
  total: number;
  /** |total − expectedTotal| quantizado. */
  diff: number;
  /** `true` quando diff > 0.01 (1 centavo) — reporta, não conserta. */
  totalMismatch: boolean;
  /** Quantos itens tinham quantidade fracionária local (informativo desde Q5b). */
  fractionalQuantities: number;
}

/**
 * Inspeciona a saúde monetária de um orçamento local para a migração.
 * Só REPORTA — não altera o total local (que segue como fonte de verdade).
 */
export function inspectQuoteMoney(quote: Pick<Quote, "items" | "discount" | "total">): QuoteMoneyReport {
  const itemsSum = sumItemsTotal(quote.items);
  const discount = roundMoney(quote.discount);
  const expectedTotal = roundMoney(itemsSum - discount);
  const total = roundMoney(quote.total);
  const diff = roundMoney(Math.abs(total - expectedTotal));
  const fractionalQuantities = (quote.items ?? []).filter((it) => isFractionalQuantity(it?.quantity)).length;
  return {
    itemsSum,
    discount,
    expectedTotal,
    total,
    diff,
    totalMismatch: diff > 0.01,
    fractionalQuantities,
  };
}
