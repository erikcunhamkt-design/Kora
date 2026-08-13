import { useCallback, useEffect, useState } from "react";

/**
 * Etapa 5 · Flip Projetos (item 4) — flag mestre de escrita de `projects` na
 * nuvem.
 *
 * Nasceu opt-in (default OFF, Fatia N/item 4) — primeira rodada de escrita
 * do domínio, sem histórico de homologação ainda.
 *
 * Pacote do Flip (Fase C) — default flipado pra opt-out (ausência ou
 * qualquer valor ≠ "false" ⇒ true), mesmo padrão de
 * `kora.crm.supabaseWrite.enabled` (Fatia 8) e
 * `kora.quotes.supabaseWrite.enabled` (Pacote do Flip de quotes). Sessões
 * que já têm o valor gravado explicitamente ("true" ou "false") não são
 * afetadas — só quem nunca tocou na flag herda o novo default. Ver
 * docs/qa/etapa-5-flip-projetos-runbook.md §2.2.
 *
 * Gate do ESPELHO (padrão G22), não do dataSource de leitura — os dois eixos
 * são independentes: `getProjectsDataSource()` (config/flags.ts) decide QUAL
 * fonte a tela lê; esta flag decide SE a escrita local (sempre autoritativa)
 * também tenta espelhar na nuvem, best-effort, sem nunca bloquear nem
 * desfazer o local.
 *
 * Stored in localStorage under `kora.projects.supabaseWrite.enabled`.
 * Synced across tabs via `storage`, e dentro da mesma aba via um evento
 * customizado `kora:projects-supabase-write-flag` — mesmo padrão de
 * `useSupabaseCrmWriteFlag.ts`/`useSupabaseQuotesWriteFlag.ts`.
 */

export const PROJECTS_SUPABASE_WRITE_FLAG_KEY = "kora.projects.supabaseWrite.enabled";
const FLAG_EVENT = "kora:projects-supabase-write-flag";

function readFlag(): boolean {
  try {
    // Opt-out desde o Pacote do Flip: só o literal "false" desliga.
    return localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return true;
  }
}

function writeFlag(value: boolean) {
  try {
    localStorage.setItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY, String(value));
  } catch {
    /* ignore quota / disabled storage */
  }
  try {
    window.dispatchEvent(new CustomEvent<boolean>(FLAG_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function useSupabaseProjectsWriteFlag(): {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(() => readFlag());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROJECTS_SUPABASE_WRITE_FLAG_KEY) {
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
export function isSupabaseProjectsWriteEnabled(): boolean {
  return readFlag();
}
