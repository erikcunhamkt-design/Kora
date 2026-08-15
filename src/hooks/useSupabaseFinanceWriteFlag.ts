import { useCallback, useEffect, useState } from "react";

/**
 * Etapa 5 · Financeiro — flag mestre de escrita de `financial_transactions`
 * na nuvem.
 *
 * Nasceu opt-in (default OFF, mesmo nascimento de
 * `kora.projects.supabaseWrite.enabled` na Fatia N de projects, antes do
 * Pacote do Flip) — na Fatia N, primeira rodada de leitura do domínio,
 * reservada sem nenhum consumidor ainda (a escrita em modo Supabase ficava
 * bloqueada incondicionalmente). Fase B (Pacote do Flip) passou a consumi-la
 * de verdade — `Financeiro.tsx` gateia `blockWrite()` por ela (flag ON
 * liberava create/update/delete reais via `useSupabaseFinanceTransactions`;
 * OFF preservava o bloqueio incondicional da Fatia N, byte a byte).
 *
 * Pacote do Flip (Fase C) — default flipado pra opt-out (ausência ou
 * qualquer valor ≠ "false" ⇒ true), mesmo padrão de
 * `kora.projects.supabaseWrite.enabled`/`kora.crm.supabaseWrite.enabled`/
 * `kora.quotes.supabaseWrite.enabled` pós-flip. Sessões que já têm o valor
 * gravado explicitamente ("true" ou "false") não são afetadas — só quem
 * nunca tocou na flag herda o novo default. Ver
 * docs/qa/etapa-5-flip-financeiro-runbook.md §2.2.
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
    // Opt-out desde o Pacote do Flip: só o literal "false" desliga.
    return localStorage.getItem(FINANCE_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return true;
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
        setEnabledState(event.newValue !== "false");
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
