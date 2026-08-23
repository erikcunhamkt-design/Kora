import { useCallback, useEffect, useState } from "react";

/**
 * B5 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md` §7) —
 * flag mestre de escrita de `tasks` na nuvem.
 *
 * Nasce opt-in (default OFF) — MESMO nascimento de
 * `kora.finance.supabaseWrite.enabled`/`kora.projects.supabaseWrite.enabled`
 * ANTES do respectivo Pacote do Flip flipar o default: primeira rodada de
 * escrita nativa do domínio, sem histórico de homologação ainda. Gateia
 * `addTask`/`updateTask`/`moveTask`/`deleteTask` em `Tarefas.tsx` — flag OFF
 * preserva o comportamento local intacto, byte a byte (mesmo espírito do
 * antigo `blockWrite()` de Financeiro, sem o toast de bloqueio: aqui a
 * escrita local nunca fica bloqueada, só a nativa-nuvem fica desligada por
 * padrão). O flip pra opt-out fica pra Fase C de Tarefas (B6 do plano),
 * quando B1-B5 fecharem e a homologação confirmar — mesmo padrão que os 4
 * domínios irmãos (crm/quotes/projects/finance) já seguiram.
 *
 * Stored in localStorage under `kora.tasks.supabaseWrite.v1` (nome exato
 * reservado nesta rodada — diferente do sufixo `.enabled` dos 4 domínios
 * irmãos, mesmo padrão `.v1` das flags de `dataSource` deste domínio).
 * Synced across tabs via `storage`, e dentro da mesma aba via um evento
 * customizado `kora:tasks-supabase-write-flag` — mesmo padrão de
 * `useSupabaseFinanceWriteFlag.ts`/`useSupabaseProjectsWriteFlag.ts`.
 */

export const TASKS_SUPABASE_WRITE_FLAG_KEY = "kora.tasks.supabaseWrite.v1";
const FLAG_EVENT = "kora:tasks-supabase-write-flag";

function readFlag(): boolean {
  try {
    // Opt-in (pré-flip): só o literal "true" liga.
    return localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY) === "true";
  } catch {
    return false;
  }
}

function writeFlag(value: boolean) {
  try {
    localStorage.setItem(TASKS_SUPABASE_WRITE_FLAG_KEY, String(value));
  } catch {
    /* ignore quota / disabled storage */
  }
  try {
    window.dispatchEvent(new CustomEvent<boolean>(FLAG_EVENT, { detail: value }));
  } catch {
    /* ignore */
  }
}

export function useSupabaseTasksWriteFlag(): {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  toggle: () => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(() => readFlag());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === TASKS_SUPABASE_WRITE_FLAG_KEY) {
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
export function isSupabaseTasksWriteEnabled(): boolean {
  return readFlag();
}
