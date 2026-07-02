import { describe, it, expect } from "vitest";

import {
  formatPhoneBR,
  isLikelyValidBrazilianPhone,
  normalizeBrazilianPhone,
  validateBrazilianPhone,
} from "@/lib/whatsapp/phone";

describe("normalizeBrazilianPhone", () => {
  it("adds the 55 country code to a bare 11-digit mobile", () => {
    expect(normalizeBrazilianPhone("51999999999")).toBe("5551999999999");
  });

  it("adds 55 to a bare 10-digit landline", () => {
    expect(normalizeBrazilianPhone("5133334444")).toBe("555133334444");
  });

  it("strips punctuation and keeps an existing 55 prefix", () => {
    expect(normalizeBrazilianPhone("+55 (11) 98765-4321")).toBe("5511987654321");
    expect(normalizeBrazilianPhone("5551999999999")).toBe("5551999999999");
  });

  it("returns an empty string for empty or whitespace-only input", () => {
    expect(normalizeBrazilianPhone("")).toBe("");
    expect(normalizeBrazilianPhone("   ")).toBe("");
  });

  it("returns just the digits for lengths it cannot classify", () => {
    expect(normalizeBrazilianPhone("123")).toBe("123");
  });
});

describe("validateBrazilianPhone / isLikelyValidBrazilianPhone", () => {
  // Casos BR documentados na Etapa 0.
  const validInputs = [
    "(51) 99999-9999",
    "51999999999",
    "5551999999999",
    "+55 (11) 98765-4321",
  ];
  const invalidInputs = ["99999-9999", "123", ""];

  it.each(validInputs)("accepts %j", (input) => {
    expect(validateBrazilianPhone(input).valid).toBe(true);
    expect(isLikelyValidBrazilianPhone(input)).toBe(true);
  });

  it.each(invalidInputs)("rejects %j", (input) => {
    expect(validateBrazilianPhone(input).valid).toBe(false);
    expect(isLikelyValidBrazilianPhone(input)).toBe(false);
  });

  it("rejects a non-existent DDD (00)", () => {
    expect(validateBrazilianPhone("5500999999999").valid).toBe(false);
  });

  it("rejects a 13-digit number whose mobile digit is not 9", () => {
    expect(validateBrazilianPhone("5511887654321").valid).toBe(false);
  });

  it("returns a human-readable reason on failure", () => {
    expect(validateBrazilianPhone("").reason).toBeTruthy();
    expect(validateBrazilianPhone("5500999999999").reason).toContain("DDD");
  });
});

describe("formatPhoneBR", () => {
  it("formats a 13-digit mobile as +55 (DD) 9XXXX-XXXX", () => {
    expect(formatPhoneBR("5511987654321")).toBe("+55 (11) 98765-4321");
  });

  it("formats a 12-digit landline as +55 (DD) XXXX-XXXX", () => {
    expect(formatPhoneBR("555133334444")).toBe("+55 (51) 3333-4444");
  });

  it("normalizes bare input before formatting", () => {
    expect(formatPhoneBR("51999999999")).toBe("+55 (51) 99999-9999");
  });

  it("returns the original input when it cannot be formatted", () => {
    expect(formatPhoneBR("123")).toBe("123");
    expect(formatPhoneBR("")).toBe("");
  });
});
