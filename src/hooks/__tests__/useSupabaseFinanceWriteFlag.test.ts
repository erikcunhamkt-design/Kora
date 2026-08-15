// Etapa 5 · Financeiro Fatia N — flag mestre nasceu opt-in (default OFF),
// mesmo nascimento de useSupabaseProjectsWriteFlag.ts antes do Pacote do
// Flip de projects.
//
// Etapa 5 · Pacote do Flip (Fase C) — flag virou opt-out (default ON),
// mesmo padrão do CRM (Fatia 8), de quotes e de projects pós-flip.
// Substitui o describe da fatia N (que testava o default OFF original) —
// nenhum teste do estado antigo fica pra trás passando por acidente.
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
  it("default é TRUE quando a chave nunca foi tocada (opt-out desde o Pacote do Flip)", () => {
    expect(localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseFinanceWriteEnabled()).toBe(true);
  });

  it("os 3 estados de override — ausente (novo default), \"true\" explícito, \"false\" explícito", () => {
    // Ausente ⇒ novo default (ON).
    expect(isSupabaseFinanceWriteEnabled()).toBe(true);

    // "true" explícito ⇒ ON (sem mudança, já era o comportamento esperado).
    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseFinanceWriteEnabled()).toBe(true);

    // "false" explícito ⇒ OFF — usuário que desligou ANTES do flip (quando o
    // default ainda era OFF, então "false" não fazia diferença observável)
    // continua desligado depois do flip, sem precisar tocar em nada de novo.
    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseFinanceWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém ligado — só o literal \"false\" desliga", () => {
    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseFinanceWriteEnabled()).toBe(true);

    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseFinanceWriteEnabled()).toBe(true);
  });
});

describe("useSupabaseFinanceWriteFlag · hook", () => {
  it("estado inicial é ON sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseFinanceWriteFlag());
    expect(result.current.enabled).toBe(true);
  });

  it("setEnabled(false) grava \"false\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseFinanceWriteFlag());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("toggle() a partir do default (true) desliga primeiro", () => {
    const { result } = renderHook(() => useSupabaseFinanceWriteFlag());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseFinanceWriteFlag());
    act(() => first.current.setEnabled(false));

    const { result: second } = renderHook(() => useSupabaseFinanceWriteFlag());
    expect(second.current.enabled).toBe(false);
  });
});
