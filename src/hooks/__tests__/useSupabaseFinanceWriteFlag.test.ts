// Etapa 5 · Financeiro Fatia N — flag mestre nasce opt-in (default OFF),
// mesmo nascimento de useSupabaseProjectsWriteFlag.ts antes do Pacote do
// Flip de projects — molde literal pré-flip, invertido do que
// useSupabaseProjectsWriteFlag.test.ts testa hoje (aquele já é pós-flip,
// opt-out).
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  FINANCE_SUPABASE_WRITE_FLAG_KEY,
  isSupabaseFinanceWriteEnabled,
  useSupabaseFinanceWriteFlag,
} from "@/hooks/useSupabaseFinanceWriteFlag";

beforeEach(() => {
  localStorage.clear();
});

describe("useSupabaseFinanceWriteFlag · leitor imperativo (isSupabaseFinanceWriteEnabled)", () => {
  it("default é FALSE quando a chave nunca foi tocada (opt-in, nascimento da fatia)", () => {
    expect(localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseFinanceWriteEnabled()).toBe(false);
  });

  it("os 3 estados de override — ausente (default OFF), \"true\" explícito, \"false\" explícito", () => {
    expect(isSupabaseFinanceWriteEnabled()).toBe(false);

    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseFinanceWriteEnabled()).toBe(true);

    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseFinanceWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém desligado — só o literal \"true\" liga", () => {
    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseFinanceWriteEnabled()).toBe(false);

    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseFinanceWriteEnabled()).toBe(false);
  });
});

describe("useSupabaseFinanceWriteFlag · hook", () => {
  it("estado inicial é OFF sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseFinanceWriteFlag());
    expect(result.current.enabled).toBe(false);
  });

  it("setEnabled(true) grava \"true\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseFinanceWriteFlag());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("toggle() a partir do default (false) liga primeiro", () => {
    const { result } = renderHook(() => useSupabaseFinanceWriteFlag());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseFinanceWriteFlag());
    act(() => first.current.setEnabled(true));

    const { result: second } = renderHook(() => useSupabaseFinanceWriteFlag());
    expect(second.current.enabled).toBe(true);
  });
});
