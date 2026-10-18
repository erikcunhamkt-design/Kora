// G94 · M3 (Fase A do catálogo/materiais, docs/architecture/
// etapa-5-flip-catalogo-materiais-fase-a.md §8/§9.2) — import do store M0
// (clientLibraryLocalStore.ts) → coluna `clients.library_assets` (draft 6.8,
// ainda NÃO aplicada pelo operador — pacote §8-b-catálogo).
//
// Candidatos: cliente da nuvem com Biblioteca M0 preenchida
// (`store[uuid].length > 0`) E `library_assets` VAZIO na nuvem — nunca
// sobrescreve uma Biblioteca já preenchida (mesma regra do §8 do doc).
// Usa `useSupabaseClients()` DIRETO (linha crua, não `useClientsDataSource`):
// o composto já mescla store M0 como fallback quando a nuvem está vazia, o
// que esconderia a diferença entre "nuvem vazia, M0 tem dado" (candidato) e
// "nuvem já tem exatamente esse dado" (não é candidato) — aqui a leitura
// crua é o que importa pra decidir candidatura.
//
// Idempotente por cliente: depois que o import grava, a coluna deixa de
// estar vazia — reexecutar não torna o mesmo cliente candidato de novo, sem
// precisar de nenhuma chave de dedupe extra (G56, mesmo espírito do import
// do catálogo).
import { useCallback, useMemo, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { clientsRepository } from "@/repositories/clientsRepository";
import { isLibraryUnavailable } from "@/repositories/clientLibraryRepositoryShared";
import { readClientLibraryStore } from "@/services/clients/clientLibraryLocalStore";
import {
  mapCloudLibraryAssets, mapLocalLibraryAssetsToCloud, exceedsLibraryLimit, CLIENT_LIBRARY_MAX_ITEMS,
} from "@/services/clients/clientLibraryMapper";
import { getRealErrorMessage } from "@/lib/supabase/errors";

export interface ClientLibraryImportCandidate {
  clientId: string;
  clientName: string;
  assetCount: number;
}

export interface ClientLibraryImportReport {
  imported: { clientId: string; clientName: string; assetCount: number }[];
  failed: { clientId: string; clientName: string; reason: string }[];
}

export function emptyClientLibraryImportReport(): ClientLibraryImportReport {
  return { imported: [], failed: [] };
}

function asRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
}

export function useClientLibraryImport() {
  const { workspace } = useCurrentWorkspace();
  const { clients: cloudClients, refreshClients } = useSupabaseClients();

  const [loading, setLoading] = useState(false);
  const [schemaPending, setSchemaPending] = useState(false);
  const [report, setReport] = useState<ClientLibraryImportReport | null>(null);

  const candidates = useMemo<ClientLibraryImportCandidate[]>(() => {
    const store = readClientLibraryStore();
    const out: ClientLibraryImportCandidate[] = [];
    for (const raw of cloudClients) {
      const c = asRecord(raw);
      const clientId = String(c.id ?? "");
      if (!clientId) continue;
      const m0 = store[clientId];
      if (!Array.isArray(m0) || m0.length === 0) continue;
      const cloudAssets = mapCloudLibraryAssets(c.library_assets);
      // undefined (coluna ausente, schema pendente) OU [] (vazia na nuvem) ⇒ candidato.
      // Já preenchida na nuvem ⇒ nunca sobrescreve, não é candidato.
      if (cloudAssets && cloudAssets.length > 0) continue;
      out.push({ clientId, clientName: typeof c.name === "string" ? c.name : "", assetCount: m0.length });
    }
    return out;
  }, [cloudClients]);

  const importSelected = useCallback(async (selection: string[]): Promise<ClientLibraryImportReport> => {
    const result = emptyClientLibraryImportReport();
    if (!workspace) return result;
    const store = readClientLibraryStore();
    setLoading(true);
    try {
      let sawSchemaPending = false;
      for (const clientId of selection) {
        const candidate = candidates.find((c) => c.clientId === clientId);
        if (!candidate) continue;
        const assets = store[clientId] ?? [];
        if (exceedsLibraryLimit(assets)) {
          result.failed.push({ clientId, clientName: candidate.clientName, reason: `excede ${CLIENT_LIBRARY_MAX_ITEMS} itens` });
          continue;
        }
        try {
          await clientsRepository.updateClientLibrary(workspace.id, clientId, mapLocalLibraryAssetsToCloud(assets));
          result.imported.push({ clientId, clientName: candidate.clientName, assetCount: assets.length });
        } catch (err) {
          if (isLibraryUnavailable(err)) {
            sawSchemaPending = true;
            result.failed.push({ clientId, clientName: candidate.clientName, reason: "schema pendente" });
          } else {
            // G95 — mensagem REAL do erro no relatório, não um genérico (o
            // operador que for investigar uma falha de import precisa saber
            // o que de fato aconteceu, não "ocorreu um erro inesperado").
            result.failed.push({ clientId, clientName: candidate.clientName, reason: getRealErrorMessage(err) });
          }
        }
      }
      setSchemaPending(sawSchemaPending);
      setReport(result);
      return result;
    } finally {
      setLoading(false);
      void refreshClients();
    }
  }, [workspace, candidates, refreshClients]);

  return { candidates, loading, schemaPending, report, importSelected };
}
