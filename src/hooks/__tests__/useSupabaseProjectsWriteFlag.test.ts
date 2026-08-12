// Etapa 5 · Flip Projetos (item 4/5) — flag mestre de escrita de `projects`.
// Nasce opt-in (default OFF), mesmo nascimento de
// useSupabaseQuotesWriteFlag.ts na Fatia 10, antes do Pacote do Flip —
// nenhuma homologação de escrita existe ainda para este domínio.
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  PROJECTS_SUPABASE_WRITE_FLAG_KEY,
  isSupabaseProjectsWriteEnabled,
  useSupabaseProjectsWriteFlag,
} from "@/hooks/useSupabaseProjectsWriteFlag";

beforeEach(() => {
  localStorage.clear();
});

describe("useSupabaseProjectsWriteFlag · leitor imperativo (isSupabaseProjectsWriteEnabled)", () => {
  it("default é FALSE quando a chave nunca foi tocada (opt-in)", () => {
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseProjectsWriteEnabled()).toBe(false);
  });

  it("só o literal \"true\" liga", () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseProjectsWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém desligado", () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseProjectsWriteEnabled()).toBe(false);

    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseProjectsWriteEnabled()).toBe(false);
  });
});

describe("useSupabaseProjectsWriteFlag · hook", () => {
  it("estado inicial é OFF sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseProjectsWriteFlag());
    expect(result.current.enabled).toBe(false);
  });

  it("setEnabled(true) grava \"true\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseProjectsWriteFlag());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("toggle() a partir do default (false) liga primeiro", () => {
    const { result } = renderHook(() => useSupabaseProjectsWriteFlag());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseProjectsWriteFlag());
    act(() => first.current.setEnabled(true));

    const { result: second } = renderHook(() => useSupabaseProjectsWriteFlag());
    expect(second.current.enabled).toBe(true);
  });
});
