// B5 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md` §7) —
// flag mestre nasce opt-in (default OFF), mesmo nascimento de
// useSupabaseFinanceWriteFlag.ts/useSupabaseProjectsWriteFlag.ts ANTES do
// respectivo Pacote do Flip flipar o default pra opt-out.
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  TASKS_SUPABASE_WRITE_FLAG_KEY,
  isSupabaseTasksWriteEnabled,
  useSupabaseTasksWriteFlag,
} from "@/hooks/useSupabaseTasksWriteFlag";

beforeEach(() => {
  localStorage.clear();
});

describe("useSupabaseTasksWriteFlag · leitor imperativo (isSupabaseTasksWriteEnabled)", () => {
  it("default é FALSE quando a chave nunca foi tocada (opt-in, pré-flip)", () => {
    expect(localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseTasksWriteEnabled()).toBe(false);
  });

  it("os 3 estados de override — ausente (default OFF), \"true\" explícito, \"false\" explícito", () => {
    expect(isSupabaseTasksWriteEnabled()).toBe(false);

    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseTasksWriteEnabled()).toBe(true);

    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseTasksWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém desligado — só o literal \"true\" liga", () => {
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseTasksWriteEnabled()).toBe(false);

    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseTasksWriteEnabled()).toBe(false);
  });
});

describe("useSupabaseTasksWriteFlag · hook", () => {
  it("estado inicial é OFF sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseTasksWriteFlag());
    expect(result.current.enabled).toBe(false);
  });

  it("setEnabled(true) grava \"true\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseTasksWriteFlag());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("toggle() a partir do default (false) liga primeiro", () => {
    const { result } = renderHook(() => useSupabaseTasksWriteFlag());
    expect(result.current.enabled).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY)).toBe("true");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseTasksWriteFlag());
    act(() => first.current.setEnabled(true));

    const { result: second } = renderHook(() => useSupabaseTasksWriteFlag());
    expect(second.current.enabled).toBe(true);
  });
});
