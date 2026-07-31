// Etapa 5 · Pacote do Flip (quotes) — Fase C, item 2/3: flag mestre virou
// opt-out (default ON), mesmo padrão do CRM desde a Fatia 8. Substitui o
// arquivo da Fatia 10 (que testava o default OFF original e a coexistência
// com a flag legada quotesSupabaseApproval, retirada neste pacote — ver
// docs/qa/etapa-5-flip-quotes.md §2.1/§2.2). Nenhum teste do estado antigo
// fica pra trás passando por acidente (precisão 1 do revisor).
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
  it("default é TRUE quando a chave nunca foi tocada (opt-out desde o Pacote do Flip)", () => {
    expect(localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY)).toBeNull();
    expect(isSupabaseQuotesWriteEnabled()).toBe(true);
  });

  it("os 3 estados de override — ausente (novo default), \"true\" explícito, \"false\" explícito", () => {
    // Ausente ⇒ novo default (ON).
    expect(isSupabaseQuotesWriteEnabled()).toBe(true);

    // "true" explícito ⇒ ON (sem mudança, já era o comportamento esperado).
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "true");
    expect(isSupabaseQuotesWriteEnabled()).toBe(true);

    // "false" explícito ⇒ OFF — usuário que desligou ANTES do flip (quando o
    // default ainda era OFF, então "false" não fazia diferença observável)
    // continua desligado depois do flip, sem precisar tocar em nada de novo.
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isSupabaseQuotesWriteEnabled()).toBe(false);
  });

  it("qualquer valor malformado (nem \"true\" nem \"false\") mantém ligado — só o literal \"false\" desliga", () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "lixo");
    expect(isSupabaseQuotesWriteEnabled()).toBe(true);

    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "");
    expect(isSupabaseQuotesWriteEnabled()).toBe(true);
  });
});

describe("useSupabaseQuotesWriteFlag · hook", () => {
  it("estado inicial é ON sem nenhum valor gravado", () => {
    const { result } = renderHook(() => useSupabaseQuotesWriteFlag());
    expect(result.current.enabled).toBe(true);
  });

  it("setEnabled(false) grava \"false\" e atualiza o estado", () => {
    const { result } = renderHook(() => useSupabaseQuotesWriteFlag());
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("toggle() a partir do default (true) desliga primeiro", () => {
    const { result } = renderHook(() => useSupabaseQuotesWriteFlag());
    expect(result.current.enabled).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY)).toBe("false");
  });

  it("round-trip: o que grava é o que uma nova instância do hook lê", () => {
    const { result: first } = renderHook(() => useSupabaseQuotesWriteFlag());
    act(() => first.current.setEnabled(false));

    const { result: second } = renderHook(() => useSupabaseQuotesWriteFlag());
    expect(second.current.enabled).toBe(false);
  });
});

describe("isQuotesApprovalReachable · pós-retirada da flag legada (Pacote do Flip §2.2)", () => {
  it("segue o master flag sozinho — true por padrão", () => {
    expect(isQuotesApprovalReachable()).toBe(true);
  });

  it("segue o master flag quando explicitamente desligado", () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    expect(isQuotesApprovalReachable()).toBe(false);
  });

  it("a flag legada quotesSupabaseApproval não tem mais NENHUM efeito (retirada, não só ignorada por acidente)", () => {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, "false");
    localStorage.setItem(BOOLEAN_FLAG_KEYS.quotesSupabaseApproval, "true");
    // Antes do flip, a legada sozinha bastava para alcançar aprovação mesmo
    // com o master flag OFF (coexistência §8.1 da Fatia 10). Agora que a
    // coexistência foi retirada, só o master flag decide.
    expect(isQuotesApprovalReachable()).toBe(false);
  });
});
