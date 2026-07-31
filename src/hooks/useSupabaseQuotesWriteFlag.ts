import { useCallback, useEffect, useState } from "react";

/**
 * Etapa 5 · Fatia 10 — flag mestre de escrita de `quotes` na nuvem.
 *
 * Nasceu opt-in (default OFF, Fatia 10) — primeira rodada de escrita do
 * domínio, sem histórico de homologação ainda.
 *
 * Pacote do Flip (Fase C) — default flipado pra opt-out (ausência ou
 * qualquer valor ≠ "false" ⇒ true), mesmo padrão de
 * `kora.crm.supabaseWrite.enabled` desde a Fatia 8. Sessões que já têm o
 * valor gravado explicitamente ("true" ou "false") não são afetadas — só
 * quem nunca tocou na flag herda o novo default. Ver
 * docs/qa/etapa-5-flip-quotes.md §2.1.
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
    // Opt-out desde o Pacote do Flip: só o literal "false" desliga.
    return localStorage.getItem(QUOTES_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return true;
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
export function isSupabaseQuotesWriteEnabled(): boolean {
  return readFlag();
}

/**
 * Etapa 5 · Fatia 10 (§8.1) — nasceu como coexistência temporária com a flag
 * legada `quotesSupabaseApproval` (`masterFlag || legacyFlag`), pra quem já
 * tinha a legada ligada não perder a capacidade de aprovar/rejeitar antes do
 * master flag existir.
 *
 * Pacote do Flip (Fase C) — `quotesSupabaseApproval` retirada (redundante:
 * o master flag, agora default ON, já alcança sozinho quem antes só
 * alcançava via a legada — sem regressão, ver docs/qa/etapa-5-flip-
 * quotes.md §2.2). Função MANTIDA (não inlinada nos 2 call sites) de
 * propósito: o nome já documenta a pergunta de negócio ("aprovação é
 * alcançável?"), e ela deve voltar a ter um segundo termo quando o
 * cutover de escrita de `finance`/`projects` chegar — aprovação de quotes
 * pode um dia depender também de flags desses domínios (ex.: gerar
 * recebível/projeto a partir de uma quote aprovada). Não é apenas um
 * alias do master flag por acidente de implementação.
 */
export function isQuotesApprovalReachable(): boolean {
  return isSupabaseQuotesWriteEnabled();
}
