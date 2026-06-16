import { useCallback, useEffect, useState } from "react";

/**
 * Master feature flag for the operational CRM Supabase mode.
 *
 * When ON:
 *  - the CRM in Supabase mode allows create / edit / move / won / lost / archive / restore;
 *  - the read-only banner is replaced by an "Operacional" badge.
 *
 * When OFF (default):
 *  - the CRM Supabase mode stays read-only;
 *  - all write actions are blocked from the UI.
 *
 * Stored in localStorage under `kora.crm.supabaseWrite.enabled`.
 * Synced across tabs via the `storage` event and across components in the same
 * tab via a custom `kora:crm-supabase-write-flag` event.
 */

export const CRM_SUPABASE_WRITE_FLAG_KEY = "kora.crm.supabaseWrite.enabled";
const FLAG_EVENT = "kora:crm-supabase-write-flag";

function readFlag(): boolean {
  try {
    return localStorage.getItem(CRM_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
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
