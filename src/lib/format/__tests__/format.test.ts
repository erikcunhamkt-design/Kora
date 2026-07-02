import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatDate,
  formatDateTime,
  formatPhone,
} from "@/lib/format";

describe("formatCurrency", () => {
  it("renders USD in en-US", () => {
    expect(formatCurrency(1234.5, { locale: "en-US", currency: "USD" })).toBe("$1,234.50");
  });

  it("renders BRL in pt-BR", () => {
    const out = formatCurrency(1234.5, { locale: "pt-BR", currency: "BRL" });
    expect(out).toContain("R$");
    expect(out).toContain("1.234,50");
  });

  it("renders EUR in pt-PT", () => {
    const out = formatCurrency(1000, { locale: "pt-PT", currency: "EUR" });
    expect(out).toContain("€");
    expect(out).toContain("1000");
  });

  it("coerces non-finite input to zero", () => {
    expect(formatCurrency(null, { locale: "en-US", currency: "USD" })).toBe("$0.00");
    expect(formatCurrency(undefined, { locale: "en-US", currency: "USD" })).toBe("$0.00");
    expect(formatCurrency(NaN, { locale: "en-US", currency: "USD" })).toBe("$0.00");
  });

  it("honors fraction-digit overrides (drop-in for minimumFractionDigits:0)", () => {
    expect(formatCurrency(1000, { locale: "en-US", currency: "USD", minimumFractionDigits: 0 })).toBe(
      "$1,000",
    );
  });
});

describe("formatNumber / formatPercent", () => {
  it("groups thousands per locale", () => {
    expect(formatNumber(1234567, { locale: "en-US" })).toBe("1,234,567");
    expect(formatNumber(1234567, { locale: "pt-BR" })).toBe("1.234.567");
  });

  it("formats a ratio as percent", () => {
    expect(formatPercent(0.25, { locale: "en-US" })).toBe("25%");
  });

  it("formats a whole-number percent", () => {
    expect(formatPercent(25, { locale: "en-US", whole: true })).toBe("25%");
  });
});

describe("formatDate / formatDateTime", () => {
  it("uses locale-specific ordering", () => {
    expect(formatDate("2026-07-02", { locale: "en-US", timeZone: "UTC" })).toBe("07/02/2026");
    expect(formatDate("2026-07-02", { locale: "pt-BR", timeZone: "UTC" })).toBe("02/07/2026");
  });

  it("returns empty string for invalid input", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate("")).toBe("");
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDateTime(undefined)).toBe("");
  });
});

describe("formatPhone", () => {
  it("formats Brazilian mobile with DDI", () => {
    expect(formatPhone("5511987654321")).toBe("+55 (11) 98765-4321");
  });

  it("formats Brazilian landline (8-digit) with DDI", () => {
    expect(formatPhone("551132654321")).toBe("+55 (11) 3265-4321");
  });

  it("passes through generic international numbers", () => {
    expect(formatPhone("+14155552671")).toBe("+14155552671");
  });

  it("returns empty for empty input", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone(null)).toBe("");
  });
});
