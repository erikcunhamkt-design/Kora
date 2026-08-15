import { afterEach, describe, expect, it, vi } from "vitest";
import { backoffDelayMs, fetchWithRetry, shouldRetry } from "../retry";

describe("shouldRetry", () => {
  it("retry em 503 antes de esgotar tentativas", () => {
    expect(shouldRetry(503, 0, 2)).toBe(true);
    expect(shouldRetry(503, 1, 2)).toBe(true);
  });

  it("retry em 429", () => {
    expect(shouldRetry(429, 0, 2)).toBe(true);
  });

  it("retry em 529 (overloaded_error da Anthropic)", () => {
    expect(shouldRetry(529, 0, 2)).toBe(true);
  });

  it("nao retry apos esgotar as tentativas", () => {
    expect(shouldRetry(503, 2, 2)).toBe(false);
    expect(shouldRetry(429, 2, 2)).toBe(false);
  });

  it("nao retry em erro nao-transitorio (400)", () => {
    expect(shouldRetry(400, 0, 2)).toBe(false);
  });

  it("nao retry em erro de config/auth (401/403) - vai falhar igual na proxima", () => {
    expect(shouldRetry(401, 0, 2)).toBe(false);
    expect(shouldRetry(403, 0, 2)).toBe(false);
  });
});

describe("backoffDelayMs", () => {
  it("cresce exponencialmente com o attempt (jitter zerado via rng injetado)", () => {
    expect(backoffDelayMs(0, 300, 100, () => 0)).toBe(300);
    expect(backoffDelayMs(1, 300, 100, () => 0)).toBe(600);
    expect(backoffDelayMs(2, 300, 100, () => 0)).toBe(1200);
  });

  it("aplica jitter dentro do range declarado", () => {
    expect(backoffDelayMs(0, 300, 100, () => 0.5)).toBe(350);
    expect(backoffDelayMs(0, 300, 100, () => 0.99)).toBe(399);
  });
});

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("503 -> sucesso: tenta de novo ate um 200 e reporta quantas tentativas precisou", async () => {
    let call = 0;
    const fetchMock = vi.fn(async () => {
      call++;
      if (call < 3) return new Response("unavailable", { status: 503 });
      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { res, attempts } = await fetchWithRetry("https://example.com", {}, 2, async () => {});

    expect(res.status).toBe(200);
    expect(attempts).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("503 -> esgotado: devolve a ultima resposta com falha apos o maximo de tentativas, nao trava nem engole", async () => {
    const fetchMock = vi.fn(async () => new Response("unavailable", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const { res, attempts } = await fetchWithRetry("https://example.com", {}, 2, async () => {});

    expect(res.status).toBe(503);
    expect(attempts).toBe(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sucesso de primeira -> nao tenta de novo", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { res, attempts } = await fetchWithRetry("https://example.com", {}, 2, async () => {});

    expect(res.status).toBe(200);
    expect(attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("erro nao-transitorio (400) -> nao tenta de novo", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const { res, attempts } = await fetchWithRetry("https://example.com", {}, 2, async () => {});

    expect(res.status).toBe(400);
    expect(attempts).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
