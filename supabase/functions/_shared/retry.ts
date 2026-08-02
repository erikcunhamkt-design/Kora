// Retry/backoff for transient upstream errors (503/429) from AI providers — G5 Parte 2,
// achado do smoke: Gemini respondeu 503 UNAVAILABLE transitório em pico. No Deno.*/npm:
// imports (only fetch/setTimeout, both portable) — same pattern as botFlowTemplate.ts,
// runs under Deno (Edge Functions) and Node/Vitest (unit tests).
// See docs/qa/etapa-6-g5-rate-limit.md §10.4.

export function shouldRetry(status: number, attempt: number, maxRetries: number): boolean {
  if (attempt >= maxRetries) return false;
  return status === 503 || status === 429;
}

export function backoffDelayMs(
  attempt: number,
  baseMs = 300,
  jitterMs = 100,
  rng: () => number = Math.random,
): number {
  return baseMs * Math.pow(2, attempt) + Math.floor(rng() * jitterMs);
}

export interface FetchRetryResult {
  res: Response;
  attempts: number;
}

// maxRetries=2 => up to 3 total attempts (~1-2s added latency worst case with the
// default backoff). `delay` is injectable so tests run instantly instead of
// waiting on real timers.
export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  maxRetries = 2,
  delay: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<FetchRetryResult> {
  let attempt = 0;
  while (true) {
    const res = await fetch(input, init);
    attempt++;
    if (res.ok || !shouldRetry(res.status, attempt - 1, maxRetries)) {
      return { res, attempts: attempt };
    }
    await delay(backoffDelayMs(attempt - 1));
  }
}
