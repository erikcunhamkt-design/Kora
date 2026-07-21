// Hook to import local finance transactions into Supabase – assisted import
// Etapa 5 · Fatia 6 (finance).
//
// Diferença deliberada dos hooks anteriores (quotes/clients/opportunities): não busca
// remoto para classificar "duplicate" por conteúdo. Aquele padrão existia porque essas
// entidades não tinham nenhum arbiter de idempotência real no banco antes da própria
// migração — a comparação de conteúdo era o único jeito de flagar um possível
// duplicado. financial_transactions já tem dois arbiters de verdade
// (source_local_id + ux_ft_receivable_from_quote pro caso quote-linked), então a
// classificação local (importedMap) mais o arbiter do banco já bastam.
import { useCallback, useEffect, useState } from "react";
import { useFinance } from "@/hooks/useFinance";
import type { Transaction } from "@/hooks/useFinance";
import { useQuotes } from "@/hooks/useQuotes";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { financeRepository } from "@/repositories/financeRepository";
import {
  mapLocalTransactionToSupabase,
  inspectFinanceMoney,
  type FinanceMoneyReport,
} from "@/services/finance/financeMapper";
import { getInstallId, buildSourceLocalId } from "@/lib/installId";
import { emitNotification } from "@/lib/notify";

/** LocalStorage key for import metadata */
const IMPORT_META_KEY = "kora.finance.supabaseImport.v1";

type ImportMeta = {
  lastImportedAt: string;
  importedLocalIds: string[];
  skippedLocalIds: string[];
  importedMap: Record<string, string>; // localTransactionId -> supabaseTransactionId
};

type ImportStatus = "new" | "imported";

export interface ImportCandidate {
  localTransaction: Transaction;
  status: ImportStatus;
  /** F3: tem clientId local mas o cliente NÃO está no import-map → subirá com client_id null. */
  clientOrphan?: boolean;
  /** F3: idem para quoteId. */
  quoteOrphan?: boolean;
  /** F3: idem para opportunityId. */
  opportunityOrphan?: boolean;
  /** Relatório de divergência amount vs total da quote vinculada (quando houver). */
  money?: FinanceMoneyReport;
}

export interface ImportResult {
  successIds: string[]; // localTransaction.id que foram importados com sucesso
  failedIds: string[]; // localTransaction.id que falharam
}

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

function writeMeta(meta: ImportMeta) {
  try {
    localStorage.setItem(IMPORT_META_KEY, JSON.stringify(meta));
  } catch {
    // ignore – UI will still work
  }
}

function readMap(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw).importedMap as Record<string, string>;
  } catch {
    // ignore errors – no map
  }
  return {};
}

/** Main hook */
export function useLocalFinanceImport() {
  const { transactions: localTransactions } = useFinance();
  const { quotes: localQuotes } = useQuotes();
  const { workspace } = useCurrentWorkspace();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /** Analyze local transactions and produce candidates (leitura pura, sem rede) */
  const analyze = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      if (!workspace) {
        setError("Nenhum workspace ativo encontrado.");
        setLoading(false);
        return;
      }
      const meta = readMeta();
      const clientMap = readMap("kora.clients.supabaseImport.v1");
      const quoteMap = readMap("kora.quotes.supabaseImport.v1");
      const oppMap = readMap("kora.crm.supabaseImport.v1");

      const newCandidates: ImportCandidate[] = [];
      for (const local of localTransactions) {
        // skip demo transactions
        if (local.isDemo) continue;

        const status: ImportStatus = meta.importedMap[local.id] ? "imported" : "new";
        // F3: órfã de FK (tem id local mas sem mapeamento) → importa com FK null.
        const clientOrphan = !!local.clientId && !clientMap[String(local.clientId)];
        const quoteOrphan = !!local.quoteId && !quoteMap[String(local.quoteId)];
        const opportunityOrphan = !!local.opportunityId && !oppMap[String(local.opportunityId)];
        // Checagem de precisão: amount vs total da quote local vinculada (quando houver).
        const money = inspectFinanceMoney(local, localQuotes);

        newCandidates.push({
          localTransaction: local,
          status,
          clientOrphan,
          quoteOrphan,
          opportunityOrphan,
          money,
        });
      }

      setCandidates(newCandidates);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error during analysis");
    } finally {
      setLoading(false);
    }
  }, [localTransactions, localQuotes, workspace]);

  /** Import selected local transaction IDs (only those with status "new") */
  const importSelected = useCallback(async (ids: string[]): Promise<ImportResult> => {
    const result: ImportResult = { successIds: [], failedIds: [] };
    const meta = readMeta();
    const clientMap = readMap("kora.clients.supabaseImport.v1");
    const quoteMap = readMap("kora.quotes.supabaseImport.v1");
    const oppMap = readMap("kora.crm.supabaseImport.v1");

    for (const id of ids) {
      const candidate = candidates.find((c) => c.localTransaction.id === id);
      if (!candidate || candidate.status !== "new") continue; // safety
      const local = candidate.localTransaction;

      try {
        if (!workspace) throw new Error("Workspace not available for import");

        // F3: payload com as FKs resolvidas via import-maps (UUID ou null; NUNCA id
        // local cru). A resolução vive no mapper — testada isoladamente.
        const payload = mapLocalTransactionToSupabase(local, {
          clients: clientMap,
          quotes: quoteMap,
          opportunities: oppMap,
        });

        // source_local_id namespacado por instalação, arbiter da idempotência geral.
        const sourceLocalId = buildSourceLocalId(getInstallId(), local.id);
        const created = await financeRepository.importTransaction(workspace.id, sourceLocalId, payload);

        // Metadata só é gravada APÓS sucesso — persistida incrementalmente (não
        // perde o rastro num crash no meio do lote; reimport é seguro de qualquer
        // forma, o import é idempotente pelos dois arbiters).
        meta.importedMap[local.id] = created.id;
        meta.importedLocalIds = [...meta.importedLocalIds, local.id];
        meta.lastImportedAt = new Date().toISOString();
        writeMeta(meta);
        result.successIds.push(local.id);
        emitNotification({
          title: "Lançamento financeiro importado",
          description: local.title,
          category: "import",
          type: "success",
        });
      } catch (e: unknown) {
        // Erro = candidato marcado com erro; NADA é gravado no importedMap.
        result.failedIds.push(id);
        meta.skippedLocalIds = [...(meta.skippedLocalIds || []), id];
        writeMeta(meta);
        emitNotification({
          title: "Falha ao importar lançamento financeiro",
          description: local.title,
          category: "import",
          type: "error",
        });
      }
    }
    // Refresh candidates to reflect newly imported ones
    analyze();
    return result;
  }, [candidates, analyze, workspace]);

  // Keep candidates in sync when local transactions change
  useEffect(() => {
    analyze();
  }, [localTransactions, analyze]);

  return { candidates, loading, error, analyze, importSelected };
}
