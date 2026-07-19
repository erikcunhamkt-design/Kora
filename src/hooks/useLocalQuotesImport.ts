// @ts-nocheck
// Hook to import local quotes into Supabase – assisted import
import { useCallback, useEffect, useState } from "react";
import { useQuotes } from "@/hooks/useQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { quotesRepository } from "@/repositories/quotesRepository";
import {
  mapLocalQuoteToSupabaseQuote,
  mapLocalQuoteItemToSupabaseItem,
} from "@/services/quotes/quoteMapper";
import { inspectQuoteMoney, type QuoteMoneyReport } from "@/services/quotes/quoteMoney";
import type { Quote, QuoteItem } from "@/hooks/useQuotes";
import type { SupabaseQuote, SupabaseQuoteItem } from "@/repositories/quotesRepository";
import { emitNotification } from "@/lib/notify";

// Extended local quote with optional fields used for import/dedupe
interface ExtendedLocalQuote extends Omit<Quote, "opportunityId"> {
  code?: string;
  number?: string;
  quoteNumber?: string;
  leadId?: string;
  opportunityId?: string | number;
  validUntil?: string;
}

/** LocalStorage key for import metadata */
const IMPORT_META_KEY = "kora.quotes.supabaseImport.v1";

type ImportMeta = {
  lastImportedAt: string;
  importedLocalIds: string[];
  skippedLocalIds: string[];
  importedMap: Record<string, string>; // localQuoteId -> supabaseQuoteId
};

type ImportStatus = "new" | "duplicate" | "imported" | "blocked";

export interface ImportCandidate {
  localQuote: Quote;
  status: ImportStatus;
  reason?: string; // for duplicate / blocked explanations
  /** Q4: tem clientId local mas o cliente NÃO está no import-map → subirá com client_id null. */
  clientOrphan?: boolean;
  /** Q5: relatório de saúde monetária (total vs Σ itens; quantidades fracionárias). */
  money?: QuoteMoneyReport;
}

export interface ImportResult {
  successIds: string[]; // localQuote.id that were imported successfully
  failedIds: string[]; // localQuote.id that failed
}

/** Helper to read import metadata from localStorage (fallback to empty) */
function readMeta(): ImportMeta {
  try {
    const raw = localStorage.getItem(IMPORT_META_KEY);
    if (raw) return JSON.parse(raw) as ImportMeta;
  } catch {
    // ignore errors – fallback to empty
  }
  return {
    lastImportedAt: "",
    importedLocalIds: [],
    skippedLocalIds: [],
    importedMap: {},
  };
}

/** Helper to persist import metadata */
function writeMeta(meta: ImportMeta) {
  try {
    localStorage.setItem(IMPORT_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore – UI will still work
  }
}

/** Helper to read client import map (if exists) */
function readClientMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem("kora.clients.supabaseImport.v1");
    if (raw) return JSON.parse(raw).importedMap as Record<string, string>;
  } catch {
    // ignore errors – no client map
  }
  return {};
}

/** Helper to read opportunity import map (if exists) */
function readOpportunityMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem("kora.crm.supabaseImport.v1");
    if (raw) return JSON.parse(raw).importedMap as Record<string, string>;
  } catch {
    // ignore errors – no opportunity map
  }
  return {};
}

/** Main hook */
export function useLocalQuotesImport() {
  const { quotes: localQuotes } = useQuotes();
  const { workspace } = useCurrentWorkspace();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /** Analyze local quotes against remote and produce candidates */
  const analyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load remote quotes (only needed fields)
      if (!workspace) {
        setError("Nenhum workspace ativo encontrado.");
        setLoading(false);
        return;
      }
      const remoteRaw = await quotesRepository.listQuotes(workspace.id);
      // Extend remote quote type to include optional fields used for deduplication
      type RemoteQuote = SupabaseQuote & {
        code?: string;
        number?: string;
        quoteNumber?: string;
        client_email?: string;
        client_name?: string;
        valid_until?: string;
      };
      const remoteQuotes = remoteRaw as RemoteQuote[]; // keep full object for dedupe

      // 2. Load import metadata
      const meta = readMeta();
      const clientMap = readClientMap();
      const oppMap = readOpportunityMap();

      // 3. Build candidate list
      const newCandidates: ImportCandidate[] = [];

      for (const local of localQuotes) {
        // skip demo quotes if present
        if (local.isDemo) continue;

        // Determine status. Começa vazio ("") — que é falsy — para que os blocos
        // `if (!status ...)` de dedupe/blocked abaixo sejam alcançáveis. No fim,
        // o que sobrar sem classificação vira "new".
        let status: ImportStatus | "" = "";
        let reason: string | undefined;

        // already imported?
        if (meta.importedMap[local.id]) {
          status = "imported";
          reason = "already imported";
        } else if (local.clientId && clientMap[local.clientId.toString()]) {
          // client mapping exists – not a duplicate by itself
        }

        // dedupe based on code/number if present (not in current type)
        // Fallback to title+clientName+total or clientEmail+total+validUntil
        const hasCode = (local as ExtendedLocalQuote).code ?? (local as ExtendedLocalQuote).number ?? (local as ExtendedLocalQuote).quoteNumber;
        if (!status && hasCode) {
          const dup = remoteQuotes.find((r) => r.code === hasCode);
          if (dup) {
            status = "duplicate";
            reason = "same code/number exists remotely";
          }
        }
        if (!status) {
          const duplicateByTitle = remoteQuotes.find(
            (r) =>
              r.title === local.title &&
              r.client_name === local.clientName &&
              Math.abs(Number(r.total) - local.total) <= 0.01,
          );
          if (duplicateByTitle) {
            status = "duplicate";
            reason = "title+client+total match";
          }
        }
        if (!status && local.clientEmail) {
          const validUntil = (local as ExtendedLocalQuote).validUntil;
          const duplicateByEmail = remoteQuotes.find(
            (r) =>
              r.client_email === local.clientEmail &&
              Math.abs(Number(r.total) - local.total) <= 0.01 &&
              (validUntil ? r.valid_until === validUntil : true),
          );
          if (duplicateByEmail) {
            status = "duplicate";
            reason = "email+total+validUntil match";
          }
        }
        if (!status) {
          // essential fields check
          if (!local.clientName || !local.clientEmail || typeof local.total !== "number") {
            status = "blocked";
            reason = "missing essential data";
          }
        }
        if (!status) status = "new";
        // Q4: órfã de cliente (tem clientId local mas sem mapeamento) → importa com client_id null.
        const clientOrphan = !!local.clientId && !clientMap[String(local.clientId)];
        // Q5: relatório monetário (reporta divergência total vs Σ itens e quantidades fracionárias).
        const money = inspectQuoteMoney(local);
        newCandidates.push({ localQuote: local, status, reason, clientOrphan, money });
      }

      setCandidates(newCandidates);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error during analysis");
    } finally {
      setLoading(false);
    }
  }, [localQuotes, workspace]);

  /** Import selected local quote IDs (only those with status "new") */
  const importSelected = useCallback(async (ids: string[]): Promise<ImportResult> => {
    const result: ImportResult = { successIds: [], failedIds: [] };
    const meta = readMeta();
    const clientMap = readClientMap();
    const oppMap = readOpportunityMap();

    for (const id of ids) {
      const candidate = candidates.find((c) => c.localQuote.id === id);
      if (!candidate || candidate.status !== "new") continue; // safety
      const local = candidate.localQuote;

      try {
        // Q4: payload com as FKs resolvidas via import-maps (UUID ou null; NUNCA id local cru).
        // A resolução vive no mapper (mapLocalQuoteToSupabaseQuote) — testada isoladamente.
        const supaPayload = mapLocalQuoteToSupabaseQuote(local, {
          clients: clientMap,
          opportunities: oppMap,
        });

        // 1. Create quote in Supabase
        if (!workspace) throw new Error("Workspace not available for import");
        const created = await quotesRepository.createQuote(workspace.id, supaPayload);
        const supabaseQuoteId = created.id;

        // 2. Import items
        const supaItems = local.items.map(mapLocalQuoteItemToSupabaseItem);
        await quotesRepository.replaceQuoteItems(workspace.id, supabaseQuoteId, supaItems);

        // 3. Update metadata
        meta.importedMap[local.id] = supabaseQuoteId;
        meta.importedLocalIds = [...meta.importedLocalIds, local.id];
        result.successIds.push(local.id);
        emitNotification({
          title: "Orçamento importado",
          description: local.title,
          category: "import",
          type: "success",
        });
      } catch (e: unknown) {
        result.failedIds.push(id);
        meta.skippedLocalIds = [...(meta.skippedLocalIds || []), id];
        emitNotification({
          title: "Falha ao importar orçamento",
          description: local.title,
          category: "import",
          type: "error",
        });
      }
    }
    // Record timestamp
    meta.lastImportedAt = new Date().toISOString();
    writeMeta(meta);
    // Refresh candidates to reflect newly imported ones
    await analyze();
    return result;
  }, [candidates, analyze, workspace]);

  // Keep candidates in sync when local quotes change (e.g., after a new quote is added locally)
  useEffect(() => {
    analyze();
  }, [localQuotes, analyze]);

  return { candidates, loading, error, analyze, importSelected };
}