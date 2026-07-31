// Pure decision logic for whatsapp-bot-reply's isTest auth gate (G5/G18 — see
// docs/qa/etapa-6-g5-rate-limit.md §4.1/§5). No Deno.*, no npm: imports — the actual
// Authorization header parsing and Supabase auth/membership calls are unavoidably I/O
// and stay inline in index.ts; this only decides the outcome from their results, so the
// decision matrix (which combination of header/user/membership maps to which status) has
// a CI-executable regression test.

export interface IsTestAuthResult {
  ok: boolean;
  status?: 401 | 403;
  error?: "missing_auth" | "unauthorized" | "forbidden";
}

export function authorizeIsTestCaller(
  authHeader: string | null | undefined,
  user: { id: string } | null | undefined,
  isMember: boolean,
): IsTestAuthResult {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "missing_auth" };
  }
  if (!user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  if (!isMember) {
    return { ok: false, status: 403, error: "forbidden" };
  }
  return { ok: true };
}
