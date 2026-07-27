// Etapa 5 · Fatia 10 (quotes — cutover de escrita) — item 5 da Fase C: flag mestre
// nova, opt-in (default OFF) — inverso do CRM (opt-out, default ON desde a Fatia 8),
// e da coexistência temporária com a flag legada quotesSupabaseApproval (§8.1).
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  QUOTES_SUPABASE_WRITE_FLAG_KEY,
  isSupabaseQuotesWriteEnabled,
  isQuotesApprovalReachable,
  useSupabaseQuotesWriteFlag,
} from "@/hooks/useSupabaseQuotesWriteFlag";
import { BOOLEAN_FLAG_KEYS } from "@/config/flags";

beforeEach(() => {
  localStorage.clear();
});

describe("useSupabaseQuotesWriteFlag · leitor imperativo (isSupabaseQuotesWriteEnabled)", () => {
  it("default é FALSE quando a chave nunca foi tocada (diferente do CRM)", () => {
    expect(localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseQuotesWriteEnabled()).toBe(false);
  });

  it("só o literal \"true\" liga — qualquer outro valor mantém desligado", () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseQuotesWriteEnabled()).toBe(true);

    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseQuotesWriteEnabled()).toBe(false);

    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseQuotesWriteEnabled()).toBe(false);

    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseQuotesWriteEnabled()).toBe(false);
  });
});

describe("useSupabaseQuotesWriteFlag · hook", () => {
  it("estado inicial é OFF sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseQuotesWriteFlag());
    expect(result.current.enabled).toBe(false);
  });

  it("setEnabled(true) grava \"true\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseQuotesWriteFlag());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("toggle() a partir do default (false) liga primeiro", () => {
    const { result } = renderHook(() => useSupabaseQuotesWriteFlag());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseQuotesWriteFlag());
    act(() => first.current.setEnabled(true));

    const { result: second } = renderHook(() => useSupabaseQuotesWriteFlag());
    expect(second.current.enabled).toBe(true);
  });
});

describe("isQuotesApprovalReachable — coexistência temporária com quotesSupabaseApproval (§8.1)", () => {
  it("false quando nenhuma das duas flags está ligada", () => {
    expect(isQuotesApprovalReachable()).toBe(false);
  });

  it("true quando só o master flag novo está ligado", () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isQuotesApprovalReachable()).toBe(true);
  });

  it("true quando só a flag legada quotesSupabaseApproval está ligada (nunca perde a capacidade já concedida)", () => {
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "true");
    expect(isSupabaseQuotesWriteEnabled()).toBe(false); // master flag continua OFF
    expect(isQuotesApprovalReachable()).toBe(true); // mas aprovar/rejeitar continua alcançável
  });

  it("true quando as duas estão ligadas", () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "true");
    expect(isQuotesApprovalReachable()).toBe(true);
  });
});
