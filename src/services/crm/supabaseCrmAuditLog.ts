/**
 * Local audit log for write actions performed in CRM Supabase Operacional mode.
 * Persists only successful actions in localStorage so the user can inspect what
 * the operational mode actually mutated.
 *
 * Storage key: `kora.crm.supabaseActions.v1`
 * Bounded to MAX_ENTRIES to avoid unbounded growth.
 */

export type SupabaseCrmAuditEvent =
  | "create"
  | "update"
  | "move"
  | "won"
  | "lost"
  | "archive"
  | "restore";

export interface SupabaseCrmAuditEntry {
  event: SupabaseCrmAuditEvent;
  opportunityId: string;
  workspaceId?: string | null;
  meta?: Record<string, unknown>;
  at: string;
}

const STORAGE_KEY = "kora.crm.supabaseActions.v1";
const MAX_ENTRIES = 200;

function safeRead(): SupabaseCrmAuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupabaseCrmAuditEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: SupabaseCrmAuditEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* ignore quota / disabled storage */
  }
}

export const supabaseCrmAuditLog = {
  log(entry: Omit<SupabaseCrmAuditEntry, "at"> & { at?: string }) {
    const next: SupabaseCrmAuditEntry = {
      at: entry.at ?? new Date().toISOString(),
      event: entry.event,
      opportunityId: entry.opportunityId,
      workspaceId: entry.workspaceId ?? null,
      meta: entry.meta,
    };
    const current = safeRead();
    current.push(next);
    if (current.length > MAX_ENTRIES) {
      current.splice(0, current.length - MAX_ENTRIES);
    }
    safeWrite(current);
  },

  list(): SupabaseCrmAuditEntry[] {
    return safeRead();
  },

  clear() {
    safeWrite([]);
  },
};
