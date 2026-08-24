// B5 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md` §7) —
// flag mestre nasceu opt-in (default OFF), mesmo nascimento de
// useSupabaseFinanceWriteFlag.ts/useSupabaseProjectsWriteFlag.ts ANTES do
// respectivo Pacote do Flip.
//
// Fase C do Pacote do Flip de Tarefas — flag virou opt-out (default ON),
// mesmo padrão do CRM/quotes/projects/finance pós-flip. Substitui o
// describe da Fase B (que testava o default OFF original) — nenhum teste
// do estado antigo fica pra trás passando por acidente (divergência
// DELIBERADA — ver relatório da rodada de flip).
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
  it("default é TRUE quando a chave nunca foi tocada (opt-out desde a Fase C do flip)", () => {
    expect(localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseTasksWriteEnabled()).toBe(true);
  });

  it("os 3 estados de override — ausente (novo default), \"true\" explícito, \"false\" explícito", () => {
    // Ausente ⇒ novo default (ON).
    expect(isSupabaseTasksWriteEnabled()).toBe(true);

    // "true" explícito ⇒ ON (sem mudança, já era o comportamento esperado).
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseTasksWriteEnabled()).toBe(true);

    // "false" explícito ⇒ OFF — usuário que desligou ANTES do flip (quando o
    // default ainda era OFF, então "false" não fazia diferença observável)
    // continua desligado depois do flip, sem precisar tocar em nada de novo.
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseTasksWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém ligado — só o literal \"false\" desliga", () => {
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseTasksWriteEnabled()).toBe(true);

    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseTasksWriteEnabled()).toBe(true);
  });
});

describe("useSupabaseTasksWriteFlag · hook", () => {
  it("estado inicial é ON sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseTasksWriteFlag());
    expect(result.current.enabled).toBe(true);
  });

  it("setEnabled(false) grava \"false\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseTasksWriteFlag());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("toggle() a partir do default (true) desliga primeiro", () => {
    const { result } = renderHook(() => useSupabaseTasksWriteFlag());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseTasksWriteFlag());
    act(() => first.current.setEnabled(false));

    const { result: second } = renderHook(() => useSupabaseTasksWriteFlag());
    expect(second.current.enabled).toBe(false);
  });
});
