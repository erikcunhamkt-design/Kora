import { useCallback, useEffect, useState } from "react";

/**
 * B5 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md` §7) —
 * flag mestre de escrita de `tasks` na nuvem.
 *
 * Nasceu opt-in (default OFF) — MESMO nascimento de
 * `kora.finance.supabaseWrite.enabled`/`kora.projects.supabaseWrite.enabled`
 * ANTES do respectivo Pacote do Flip flipar o default: primeira rodada de
 * escrita nativa do domínio, sem histórico de homologação ainda. Gateia
 * `addTask`/`updateTask`/`moveTask`/`deleteTask` em `Tarefas.tsx` — flag OFF
 * preserva o comportamento local intacto, byte a byte.
 *
 * Fase C do Pacote do Flip de Tarefas (B1-B5 fechados) — default flipado
 * pra opt-out (ausência ou qualquer valor ≠ "false" ⇒ true), mesmo padrão
 * de `kora.finance.supabaseWrite.enabled`/`kora.projects.supabaseWrite.enabled`/
 * `kora.crm.supabaseWrite.enabled`/`kora.quotes.supabaseWrite.enabled`
 * pós-flip. Sessões que já têm o valor gravado explicitamente ("true" ou
 * "false") não são afetadas — só quem nunca tocou na flag herda o novo
 * default.
 *
 * Stored in localStorage under `kora.tasks.supabaseWrite.v1` (nome exato
 * reservado na Fase B — diferente do sufixo `.enabled` dos 4 domínios
 * irmãos, mesmo padrão `.v1` das flags de `dataSource` deste domínio).
 * Synced across tabs via `storage`, e dentro da mesma aba via um evento
 * customizado `kora:tasks-supabase-write-flag` — mesmo padrão de
 * `useSupabaseFinanceWriteFlag.ts`/`useSupabaseProjectsWriteFlag.ts`.
 */

export const TASKS_SUPABASE_WRITE_FLAG_KEY = "kora.tasks.supabaseWrite.v1";
const FLAG_EVENT = "kora:tasks-supabase-write-flag";

function readFlag(): boolean {
  try {
    // Opt-out desde a Fase C do flip: só o literal "false" desliga.
    return localStorage.getItem(TASKS_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return true;
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
export function isSupabaseTasksWriteEnabled(): boolean {
  return readFlag();
}
