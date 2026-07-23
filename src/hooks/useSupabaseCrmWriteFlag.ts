import { useCallback, useEffect, useState } from "react";

/**
 * Master feature flag for the operational CRM Supabase mode.
 *
 * When ON (default desde Etapa 5 · Fatia 8 — cutover de escrita):
 *  - the CRM in Supabase mode allows create / edit / move / won / lost / archive / restore;
 *  - the read-only banner is replaced by an "Operacional" badge.
 *
 * When OFF (opt-out — só o literal "false" desliga):
 *  - the CRM Supabase mode stays read-only;
 *  - all write actions are blocked from the UI.
 *
 * Etapa 5 · Fatia 8: default flipado de OFF para ON — exceção consciente e
 * registrada ao "CONTRATO DE PRESERVAÇÃO DE COMPORTAMENTO" (Etapa 4a,
 * src/config/flags.ts) de nunca mudar o default de uma flag já existente. Ver
 * docs/qa/etapa-5-fatia-8-crm-cutover.md §6.1 (decisão) e §6.5 (critério de
 * retirada). Sessões que já têm o valor gravado explicitamente ("true" ou
 * "false") não são afetadas — só quem nunca tocou na flag herda o novo default.
 *
 * Stored in localStorage under `kora.crm.supabaseWrite.enabled`.
 * Synced across tabs via the `storage` event and across components in the same
 * tab via a custom `kora:crm-supabase-write-flag` event.
 */

export const CRM_SUPABASE_WRITE_FLAG_KEY = "kora.crm.supabaseWrite.enabled";
const FLAG_EVENT = "kora:crm-supabase-write-flag";

function readFlag(): boolean {
  try {
    // Ausência ou qualquer valor ≠ "false" ⇒ true (ligado por padrão desde a
    // Fatia 8) — só o literal "false" desliga. Mesma semântica opt-out já
    // usada por TECHNICAL_SHEETS_EXPERIMENTAL_KEY (src/config/flags.ts).
    return localStorage.getItem(CRM_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeFlag(value: boolean) {
  try {
    localStorage.setItem(CRM_SUPABASE_WRITE_FLAG_KEY, String(value));
  } catch {
    /* ignore quota / disabled storage */
  }
  try {
    window.dispatchEvent(new CustomEvent<boolean>(FLAG_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function useSupabaseCrmWriteFlag(): {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(() => readFlag());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === CRM_SUPABASE_WRITE_FLAG_KEY) {
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
export function isSupabaseCrmWriteEnabled(): boolean {
  return readFlag();
}
