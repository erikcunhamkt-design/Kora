import { useCallback, useEffect, useState } from "react";

/**
 * Etapa 5 · Flip Projetos (item 4) — flag mestre de escrita de `projects` na
 * nuvem.
 *
 * Nasce opt-in (default OFF) — primeira rodada de escrita do domínio, sem
 * histórico de homologação ainda. Mesmo nascimento de
 * `kora.crm.supabaseWrite.enabled` (Fatia 8, antes do cutover) e
 * `kora.quotes.supabaseWrite.enabled` (Fatia 10, antes do Pacote do Flip) —
 * só um "vai" de homologação futura flipa o default pra opt-out, não esta
 * rodada.
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
    // Opt-in (nasce OFF): só o literal "true" liga.
    return localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
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
export function isSupabaseProjectsWriteEnabled(): boolean {
  return readFlag();
}
