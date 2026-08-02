import { describe, expect, it } from "vitest";
import { decideRateLimitOutcome, isWithinLimit } from "../rateLimit";

describe("isWithinLimit (G5 Parte 2 - matriz sob/no/sobre o limite)", () => {
  it("sob o limite -> true", () => {
    expect(isWithinLimit(5, 20)).toBe(true);
    expect(isWithinLimit(1, 10)).toBe(true);
  });

  it("exatamente no limite -> true (fronteira inclusiva, mesma regra do RPC v_count <= p_max)", () => {
    expect(isWithinLimit(20, 20)).toBe(true);
    expect(isWithinLimit(10, 10)).toBe(true);
  });

  it("sobre o limite -> false", () => {
    expect(isWithinLimit(21, 20)).toBe(false);
    expect(isWithinLimit(11, 10)).toBe(false);
  });

  it("buckets separados (webhook max=20, isTest max=10) nao se misturam", () => {
    expect(isWithinLimit(15, 20)).toBe(true); // dentro do bucket webhook
    expect(isWithinLimit(15, 10)).toBe(false); // mesma contagem, estouraria o bucket isTest
  });
});

describe("decideRateLimitOutcome (G5 Parte 2)", () => {
  it("erro na RPC -> fail-open, sempre permite", () => {
    const outcome = decideRateLimitOutcome(true, false, false);
    expect(outcome.allowed).toBe(true);
    expect(outcome.status).toBe(200);
  });

  it("dentro do limite -> permite, independente do bucket", () => {
    expect(decideRateLimitOutcome(false, true, true).allowed).toBe(true);
    expect(decideRateLimitOutcome(false, true, false).allowed).toBe(true);
  });

  it("estourou + isTest -> bloqueia com 429 explicito", () => {
    const outcome = decideRateLimitOutcome(false, false, true);
    expect(outcome.allowed).toBe(false);
    expect(outcome.status).toBe(429);
    expect(outcome.body).toEqual({ error: "rate_limited" });
  });

  it("estourou + webhook -> bloqueia com 200 + skipped (nao 429)", () => {
    const outcome = decideRateLimitOutcome(false, false, false);
    expect(outcome.allowed).toBe(false);
    expect(outcome.status).toBe(200);
    expect(outcome.body).toEqual({ ok: true, skipped: "rate_limited" });
  });
});
