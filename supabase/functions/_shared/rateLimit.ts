// G5 Parte 2: pure decision logic for the per-workspace AI rate limit. The actual
// counting/atomicity lives in Postgres (RPC check_and_increment_ai_rate_limit,
// migration 20260802010000_g5_ai_rate_limit.sql) — this only decides the HTTP-level
// outcome from an already-resolved RPC result, so the decision matrix (fail-open on
// RPC error, allowed/blocked per bucket, isTest vs webhook response shape) has a
// CI-executable regression test. See docs/qa/etapa-6-g5-rate-limit.md §10/§11.

// Mirrors the SQL RPC's own boundary rule (`v_count <= p_max`) as a tested,
// living spec of what "within limit" means — count == max is still allowed
// (inclusive boundary), count == max + 1 is the first blocked call.
export function isWithinLimit(count: number, max: number): boolean {
  return count <= max;
}

export interface RateLimitOutcome {
  allowed: boolean;
  status: number;
  body: Record<string, unknown>;
}

// Fail-open on rpcError by design: a broken/missing rate-limit check (e.g. the
// migration hasn't been applied yet, a transient DB error) should not take down
// bot replies entirely — this is a cost-control safety net, not a security
// boundary, so an availability regression here is worse than briefly
// under-enforcing the cap. Contrast with isTestAuth.ts, which fails CLOSED
// because that gate protects against an unauthenticated free AI proxy, a much
// worse failure mode than "the rate limit didn't apply for a moment".
export function decideRateLimitOutcome(
  rpcError: boolean,
  withinLimit: boolean,
  isTest: boolean,
): RateLimitOutcome {
  if (rpcError || withinLimit) {
    return { allowed: true, status: 200, body: {} };
  }
  if (isTest) {
    return { allowed: false, status: 429, body: { error: "rate_limited" } };
  }
  // webhook bucket: 200+skipped, not 429 — see docs/qa/etapa-6-g5-rate-limit.md
  // §11.3 for why (pattern-consistency with the file's other skip branches, not
  // "avoid retry storm" — verified that whatsapp-webhook's own response to the
  // caller never depends on this status, so that original justification didn't
  // actually hold).
  return { allowed: false, status: 200, body: { ok: true, skipped: "rate_limited" } };
}
