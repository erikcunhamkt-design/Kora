import { useCallback, useEffect, useState } from "react";

/**
 * Etapa 5 · Financeiro Fatia N — flag mestre de escrita de `financial_transactions`
 * na nuvem.
 *
 * Nasce opt-in (default OFF, mesmo nascimento de
 * `kora.projects.supabaseWrite.enabled` na Fatia N de projects, antes do
 * Pacote do Flip) — primeira rodada de leitura do domínio, sem nenhum
 * código de escrita/espelho consumindo esta flag ainda. Reservada pra
 * quando a Fase C (flip real, desenho em paralelo pela Lane B) precisar de
 * um gate de escrita — não usada por nenhum componente nesta fatia (a
 * escrita em modo Supabase fica bloqueada incondicionalmente, ver
 * `Financeiro.tsx`, `blockWrite()`).
 *
 * Stored in localStorage under `kora.finance.supabaseWrite.enabled`.
 * Synced across tabs via `storage`, e dentro da mesma aba via um evento
 * customizado `kora:finance-supabase-write-flag` — mesmo padrão de
 * `useSupabaseProjectsWriteFlag.ts`/`useSupabaseQuotesWriteFlag.ts`.
 */

export const FINANCE_SUPABASE_WRITE_FLAG_KEY = "kora.finance.supabaseWrite.enabled";
const FLAG_EVENT = "kora:finance-supabase-write-flag";

function readFlag(): boolean {
  try {
    // Opt-in (nascimento, Fatia N): só o literal "true" liga.
    return localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

function writeFlag(value: boolean) {
  try {
    localStorage.setItem(FINANCE_SUPABASE_WRITE_FLAG_KEY, String(value));
  } catch {
    /* ignore quota / disabled storage */
  }
  try {
    window.dispatchEvent(new CustomEvent<boolean>(FLAG_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function useSupabaseFinanceWriteFlag(): {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(() => readFlag());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === FINANCE_SUPABASE_WRITE_FLAG_KEY) {
        setEnabledState(event.newValue === "true");
      }
    };
    const onCustom = (event: Event) => {
      const value = (event as CustomEvent<boolean>).detail;
      setEnabledState(Boolean(value));
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(FLAG_EVENT, onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FLAG_EVENT, onCustom as EventListener);
    };
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    writeFlag(value);
    setEnabledState(value);
  }, []);

  const toggle = useCallback(() => {
    setEnabled(!readFlag());
  }, [setEnabled]);

  return { enabled, setEnabled, toggle };
}

/** Imperative reader for non-hook contexts. */
export function isSupabaseFinanceWriteEnabled(): boolean {
  return readFlag();
}
