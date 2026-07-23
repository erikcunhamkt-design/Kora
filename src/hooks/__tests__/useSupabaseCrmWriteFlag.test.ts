// Etapa 5 · Fatia 8 (opportunities — cutover de escrita) — item 3 da Fase C:
// prova de que o novo default (true) NÃO pisa em valor explícito já gravado
// pelo usuário ("true" ou "false"), e que só a ausência da chave herda o
// default novo. Ver docs/qa/etapa-5-fatia-8-crm-cutover.md §6.1/§6.9.
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  CRM_SUPABASE_WRITE_FLAG_KEY,
  isSupabaseCrmWriteEnabled,
  useSupabaseCrmWriteFlag,
} from "@/hooks/useSupabaseCrmWriteFlag";

beforeEach(() => {
  localStorage.clear();
});

describe("useSupabaseCrmWriteFlag · leitor imperativo (isSupabaseCrmWriteEnabled)", () => {
  it("default é TRUE quando a chave nunca foi tocada (Fatia 8 — antes era false)", () => {
    expect(localStorage.getItem(CRM_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseCrmWriteEnabled()).toBe(true);
  });

  it("só o literal \"false\" desliga — qualquer outro valor mantém ligado", () => {
    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseCrmWriteEnabled()).toBe(false);

    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseCrmWriteEnabled()).toBe(true);

    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseCrmWriteEnabled()).toBe(true);

    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseCrmWriteEnabled()).toBe(true);
  });

  it("valor explícito persistido pelo usuário sobrevive ao novo default (não é sobrescrito)", () => {
    // Simula uma sessão de ANTES da Fatia 8 que já tinha desligado a flag
    // manualmente (opt-in explícito para false). O flip do default não deve
    // religar quem já escolheu ficar de fora.
    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseCrmWriteEnabled()).toBe(false);
    // e o inverso: quem já tinha ligado explicitamente continua ligado.
    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseCrmWriteEnabled()).toBe(true);
  });
});

describe("useSupabaseCrmWriteFlag · hook", () => {
  it("estado inicial reflete o novo default (true) sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseCrmWriteFlag());
    expect(result.current.enabled).toBe(true);
  });

  it("setEnabled(false) grava \"false\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseCrmWriteFlag());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(CRM_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("toggle() a partir do novo default (true) desliga primeiro", () => {
    const { result } = renderHook(() => useSupabaseCrmWriteFlag());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(CRM_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseCrmWriteFlag());
    act(() => first.current.setEnabled(false));

    const { result: second } = renderHook(() => useSupabaseCrmWriteFlag());
    expect(second.current.enabled).toBe(false);
  });
});
