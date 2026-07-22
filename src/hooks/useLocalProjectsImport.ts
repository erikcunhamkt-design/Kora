// Hook to import local projects into Supabase – assisted import
// Etapa 5 · Fatia 7 (projects/tasks).
//
// Mesmo padrão de useLocalFinanceImport.ts (Fatia 6): não busca remoto para
// classificar "duplicate" por conteúdo — projects já tem dois arbiters de verdade
// (source_local_id + ux_projects_from_quote pro caso quote-linked), a classificação
// local (importedMap) mais o arbiter do banco já bastam.
import { useCallback, useEffect, useState } from "react";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/hooks/useProjects";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository } from "@/repositories/projectsRepository";
import { mapLocalProjectToSupabase } from "@/services/projects/projectsMapper";
import { getInstallId, buildSourceLocalId } from "@/lib/installId";
import { emitNotification } from "@/lib/notify";

/** LocalStorage key for import metadata — DOBRA como o 4º import-map que tasks lê
 * pra resolver project_id (kora.projects.supabaseImport.v1), mesmo padrão de
 * kora.clients/quotes/crm.supabaseImport.v1 servindo de fan-out pra outras fatias. */
const IMPORT_META_KEY = "kora.projects.supabaseImport.v1";

type ImportMeta = {
  lastImportedAt: string;
  importedLocalIds: string[];
  skippedLocalIds: string[];
  importedMap: Record<string, string>; // localProjectId -> supabaseProjectId
};

type ImportStatus = "new" | "imported";

export interface ImportCandidate {
  localProject: Project;
  status: ImportStatus;
  /** F3: tem clientId local mas o cliente NÃO está no import-map → subirá com client_id null. */
  clientOrphan?: boolean;
  /** F3: idem para quoteId. */
  quoteOrphan?: boolean;
  /** F3: idem para opportunityId. */
  opportunityOrphan?: boolean;
}

export interface ImportResult {
  successIds: string[]; // localProject.id que foram importados com sucesso
  failedIds: string[]; // localProject.id que falharam
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
export function useLocalProjectsImport() {
  const { projects: localProjects } = useProjects();
  const { workspace } = useCurrentWorkspace();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /** Analyze local projects and produce candidates (leitura pura, sem rede) */
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
      for (const local of localProjects) {
        // skip demo projects
        if (local.isDemo) continue;

        const status: ImportStatus = meta.importedMap[local.id] ? "imported" : "new";
        // F3: órfã de FK (tem id local mas sem mapeamento) → importa com FK null.
        const clientOrphan = !!local.clientId && !clientMap[String(local.clientId)];
        const quoteOrphan = !!local.quoteId && !quoteMap[String(local.quoteId)];
        const opportunityOrphan = !!local.opportunityId && !oppMap[String(local.opportunityId)];

        newCandidates.push({
          localProject: local,
          status,
          clientOrphan,
          quoteOrphan,
          opportunityOrphan,
        });
      }

      setCandidates(newCandidates);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error during analysis");
    } finally {
      setLoading(false);
    }
  }, [localProjects, workspace]);

  /** Import selected local project IDs (only those with status "new") */
  const importSelected = useCallback(async (ids: string[]): Promise<ImportResult> => {
    const result: ImportResult = { successIds: [], failedIds: [] };
    const meta = readMeta();
    const clientMap = readMap("kora.clients.supabaseImport.v1");
    const quoteMap = readMap("kora.quotes.supabaseImport.v1");
    const oppMap = readMap("kora.crm.supabaseImport.v1");

    for (const id of ids) {
      const candidate = candidates.find((c) => c.localProject.id === id);
      if (!candidate || candidate.status !== "new") continue; // safety
      const local = candidate.localProject;

      try {
        if (!workspace) throw new Error("Workspace not available for import");

        // F3: payload com as FKs resolvidas via import-maps (UUID ou null; NUNCA id
        // local cru) e o source já traduzido (§7.2) — a resolução vive no mapper,
        // testada isoladamente.
        const payload = mapLocalProjectToSupabase(local, {
          clients: clientMap,
          quotes: quoteMap,
          opportunities: oppMap,
        });

        // source_local_id namespacado por instalação, arbiter da idempotência geral.
        const sourceLocalId = buildSourceLocalId(getInstallId(), local.id);
        const created = await projectsRepository.importProject(workspace.id, sourceLocalId, payload);

        // Metadata só é gravada APÓS sucesso — persistida incrementalmente. Esta
        // mesma chave (kora.projects.supabaseImport.v1) é o 4º import-map que a
        // importação de tasks lê para resolver project_id — nunca escrita antes do
        // sucesso individual, exatamente por isso (§8.1: import de tasks nunca
        // inventa project_id, só resolve o que já está aqui de verdade).
        meta.importedMap[local.id] = created.id;
        meta.importedLocalIds = [...meta.importedLocalIds, local.id];
        meta.lastImportedAt = new Date().toISOString();
        writeMeta(meta);
        result.successIds.push(local.id);
        emitNotification({
          title: "Projeto importado",
          description: local.name,
          category: "import",
          type: "success",
        });
      } catch (e: unknown) {
        // Erro = candidato marcado com erro; NADA é gravado no importedMap.
        result.failedIds.push(id);
        meta.skippedLocalIds = [...(meta.skippedLocalIds || []), id];
        writeMeta(meta);
        emitNotification({
          title: "Falha ao importar projeto",
          description: local.name,
          category: "import",
          type: "error",
        });
      }
    }
    // Refresh candidates to reflect newly imported ones
    analyze();
    return result;
  }, [candidates, analyze, workspace]);

  // Keep candidates in sync when local projects change
  useEffect(() => {
    analyze();
  }, [localProjects, analyze]);

  return { candidates, loading, error, analyze, importSelected };
}
