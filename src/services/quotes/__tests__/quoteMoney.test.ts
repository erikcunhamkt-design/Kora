import { describe, it, expect } from "vitest";
import {
  roundMoney,
  roundQuantity,
  isFractionalQuantity,
  sumItemsTotal,
  inspectQuoteMoney,
} from "@/services/quotes/quoteMoney";
import type { QuoteItem } from "@/hooks/useQuotes";

const item = (quantity: number, unitPrice: number): QuoteItem =>
  ({ id: "x", name: "srv", quantity, unitPrice } as QuoteItem);

describe("roundMoney", () => {
  it("quantiza a 2 casas e mata artefato de float", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3); // 0.30000000000000004 → 0.3
    expect(roundMoney(1.239)).toBe(1.24);
    expect(roundMoney(1.005)).toBe(1.01); // borda clássica, corrigida pelo EPSILON
    expect(roundMoney(1000)).toBe(1000);
  });
  it("aceita string numérica e devolve 0 para não-finito", () => {
    expect(roundMoney("12.349")).toBe(12.35);
    expect(roundMoney("abc")).toBe(0);
    expect(roundMoney(NaN)).toBe(0);
    expect(roundMoney(undefined)).toBe(0);
  });
});

describe("roundQuantity", () => {
  it("preserva fração, quantizada a 3 casas (Q5b: schema é numeric)", () => {
    expect(roundQuantity(1.5)).toBe(1.5);
    expect(roundQuantity(2.4)).toBe(2.4);
    expect(roundQuantity(1.23456)).toBe(1.235); // arredonda na 3ª casa
    expect(roundQuantity(3)).toBe(3);
    expect(roundQuantity("4.5")).toBe(4.5);
    expect(roundQuantity(NaN)).toBe(0);
  });
});

describe("isFractionalQuantity", () => {
  it("detecta quantidade fracionária", () => {
    expect(isFractionalQuantity(1.5)).toBe(true);
    expect(isFractionalQuantity("2.5")).toBe(true);
    expect(isFractionalQuantity(2)).toBe(false);
    expect(isFractionalQuantity("3")).toBe(false);
    expect(isFractionalQuantity(NaN)).toBe(false);
  });
});

describe("sumItemsTotal", () => {
  it("soma Σ(qty×unit) quantizado", () => {
    expect(sumItemsTotal([item(2, 10), item(1, 5.5)])).toBe(25.5);
    expect(sumItemsTotal([item(3, 0.1)])).toBe(0.3); // 3×0.1 float → 0.3
  });
  it("lida com lista vazia/ausente", () => {
    expect(sumItemsTotal([])).toBe(0);
    expect(sumItemsTotal(undefined)).toBe(0);
    expect(sumItemsTotal(null)).toBe(0);
  });
});

describe("inspectQuoteMoney", () => {
  it("não acusa divergência quando total = Σ itens − desconto", () => {
    const r = inspectQuoteMoney({ items: [item(2, 50)], discount: 10, total: 90 });
    expect(r.itemsSum).toBe(100);
    expect(r.expectedTotal).toBe(90);
    expect(r.diff).toBe(0);
    expect(r.totalMismatch).toBe(false);
    expect(r.fractionalQuantities).toBe(0);
  });

  it("acusa divergência > 1 centavo (reporta, não conserta)", () => {
    const r = inspectQuoteMoney({ items: [item(2, 50)], discount: 0, total: 95 });
    expect(r.itemsSum).toBe(100);
    expect(r.expectedTotal).toBe(100);
    expect(r.total).toBe(95); // total local preservado, NÃO sobrescrito
    expect(r.diff).toBe(5);
    expect(r.totalMismatch).toBe(true);
  });

  it("conta quantidades fracionárias", () => {
    const r = inspectQuoteMoney({ items: [item(1.5, 10), item(2, 10)], discount: 0, total: 35 });
    expect(r.fractionalQuantities).toBe(1);
  });
});
