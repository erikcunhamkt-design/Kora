// Etapa 5 · Pacote do Flip (projects) — Fase C: flag mestre virou opt-out
// (default ON), mesmo padrão do CRM (Fatia 8) e de quotes (Pacote do Flip).
// Substitui o arquivo da fatia N (que testava o default OFF original) —
// nenhum teste do estado antigo fica pra trás passando por acidente
// (precisão 1 do revisor, mesmo critério já aplicado ao flip de quotes).
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
  it("default é TRUE quando a chave nunca foi tocada (opt-out desde o Pacote do Flip)", () => {
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);
  });

  it("os 3 estados de override — ausente (novo default), \"true\" explícito, \"false\" explícito", () => {
    // Ausente ⇒ novo default (ON).
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    // "true" explícito ⇒ ON (sem mudança, já era o comportamento esperado).
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    // "false" explícito ⇒ OFF — usuário que desligou ANTES do flip (quando o
    // default ainda era OFF, então "false" não fazia diferença observável)
    // continua desligado depois do flip, sem precisar tocar em nada de novo.
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseProjectsWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém ligado — só o literal \"false\" desliga", () => {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);

    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseProjectsWriteEnabled()).toBe(true);
  });
});

describe("useSupabaseProjectsWriteFlag · hook", () => {
  it("estado inicial é ON sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseProjectsWriteFlag());
    expect(result.current.enabled).toBe(true);
  });

  it("setEnabled(false) grava \"false\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseProjectsWriteFlag());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("toggle() a partir do default (true) desliga primeiro", () => {
    const { result } = renderHook(() => useSupabaseProjectsWriteFlag());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseProjectsWriteFlag());
    act(() => first.current.setEnabled(false));

    const { result: second } = renderHook(() => useSupabaseProjectsWriteFlag());
    expect(second.current.enabled).toBe(false);
  });
});
