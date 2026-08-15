import { useCallback, useEffect, useState } from "react";

/**
 * Etapa 5 · Financeiro — flag mestre de escrita de `financial_transactions`
 * na nuvem.
 *
 * Nasceu opt-in (default OFF, mesmo nascimento de
 * `kora.projects.supabaseWrite.enabled` na Fatia N de projects, antes do
 * Pacote do Flip) — na Fatia N, primeira rodada de leitura do domínio,
 * reservada sem nenhum consumidor ainda (a escrita em modo Supabase ficava
 * bloqueada incondicionalmente). Correção (revisão Lane E, NOTA-f — este
 * comentário ficou desatualizado): Fase B (Pacote do Flip) passou a
 * consumi-la de verdade — `Financeiro.tsx` gateia `blockWrite()` por ela
 * (flag ON libera create/update/delete reais via `useSupabaseFinanceTransactions`;
 * OFF preserva o bloqueio incondicional da Fatia N, byte a byte). O flip dos
 * defaults (ligar pra todo mundo) continua sendo Fase C.
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
