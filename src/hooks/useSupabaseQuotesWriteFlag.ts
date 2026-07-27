import { useCallback, useEffect, useState } from "react";
import { getBooleanFlag } from "@/config/flags";

/**
 * Etapa 5 · Fatia 10 — flag mestre de escrita de `quotes` na nuvem.
 *
 * Default: OFF (opt-in — só o literal "true" liga). Diferente do CRM
 * (`kora.crm.supabaseWrite.enabled`, opt-out, default ON desde a Fatia 8) —
 * lá o default virou ON só DEPOIS de uma homologação completa (11/11 casos
 * verdes). Esta é a primeira rodada de escrita do domínio `quotes`, sem
 * histórico de homologação ainda — mesmo raciocínio que já levou o seletor
 * de leitura (`kora.quotes.dataSource.v1`) a nascer com default LOCAL na
 * Fatia 9. Ver docs/qa/etapa-5-fatia-10-quotes-write.md §5.
 *
 * Stored in localStorage under `kora.quotes.supabaseWrite.enabled`.
 * Synced across tabs via `storage`, e dentro da mesma aba via um evento
 * customizado `kora:quotes-supabase-write-flag` — mesmo padrão de
 * `useSupabaseCrmWriteFlag.ts`.
 */

export const QUOTES_SUPABASE_WRITE_FLAG_KEY = "kora.quotes.supabaseWrite.enabled";
const FLAG_EVENT = "kora:quotes-supabase-write-flag";

function readFlag(): boolean {
  try {
    // Opt-in: ausência ou qualquer valor ≠ "true" ⇒ false.
    return localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

function writeFlag(value: boolean) {
  try {
    localStorage.setItem(QUOTES_SUPABASE_WRITE_FLAG_KEY, String(value));
  } catch {
    /* ignore quota / disabled storage */
  }
  try {
    window.dispatchEvent(new CustomEvent<boolean>(FLAG_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function useSupabaseQuotesWriteFlag(): {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(() => readFlag());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === QUOTES_SUPABASE_WRITE_FLAG_KEY) {
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
export function isSupabaseQuotesWriteEnabled(): boolean {
  return readFlag();
}

/**
 * Etapa 5 · Fatia 10 (§8.1 do doc da fatia) — coexistência temporária com a
 * flag legada `quotesSupabaseApproval` (a única das 4 flags booleanas antigas
 * com escrita real na nuvem hoje). Usar SÓ no ponto de decisão de
 * aprovar/rejeitar dos 2 consumidores legados (`SupabaseQuotesViewerCard.tsx`,
 * `LinkedQuotesSection.tsx`) — quem já tinha `quotesSupabaseApproval` ligada
 * não perde a capacidade de aprovar/rejeitar só porque o master flag novo
 * nasceu OFF. As duas flags saem juntas só no pacote do flip, nunca uma
 * antes da outra.
 */
export function isQuotesApprovalReachable(): boolean {
  return readFlag() || getBooleanFlag("quotesSupabaseApproval");
}
