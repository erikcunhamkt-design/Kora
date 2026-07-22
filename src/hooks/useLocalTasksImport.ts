// Hook to import local tasks into Supabase – assisted import
// Etapa 5 · Fatia 7 (projects/tasks).
//
// Mesmo padrão de useLocalProjectsImport.ts/useLocalFinanceImport.ts: não busca
// remoto para classificar "duplicate" por conteúdo — tasks tem o arbiter
// source_local_id (sem árvore de decisão, §7.3 — vocabulário disjunto do gerador de
// tarefas base). Garantia de ordem do §8.1: `projectId` só resolve via o 4º
// import-map (kora.projects.supabaseImport.v1, escrito por
// useLocalProjectsImport) ou vira órfã — NUNCA inventado, em qualquer ordem de
// execução (incluindo re-execução após falha parcial).
import { useCallback, useEffect, useState } from "react";
import { useTasks } from "@/hooks/useTasks";
import type { Task } from "@/hooks/useTasks";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { tasksRepository } from "@/repositories/tasksRepository";
import { mapLocalTaskToSupabase } from "@/services/tasks/tasksMapper";
import { getInstallId, buildSourceLocalId } from "@/lib/installId";
import { emitNotification } from "@/lib/notify";

const IMPORT_META_KEY = "kora.tasks.supabaseImport.v1";

type ImportMeta = {
  lastImportedAt: string;
  importedLocalIds: string[];
  skippedLocalIds: string[];
  importedMap: Record<string, string>; // localTaskId -> supabaseTaskId
};

type ImportStatus = "new" | "imported";

export interface ImportCandidate {
  localTask: Task;
  status: ImportStatus;
  /** F3: tem clientId local mas o cliente NÃO está no import-map → subirá com client_id null. */
  clientOrphan?: boolean;
  /** F3: idem para quoteId. */
  quoteOrphan?: boolean;
  /** F3: idem para projectId — o 4º import-map desta fatia. Tarefa solta (sem
   * projectId) NÃO conta como órfã — ausência de vínculo é um caso de uso real, não
   * uma falha de resolução (§8 item 1 do doc da fatia). */
  projectOrphan?: boolean;
}

export interface ImportResult {
  successIds: string[];
  failedIds: string[];
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
export function useLocalTasksImport() {
  const { tasks: localTasks } = useTasks();
  const { workspace } = useCurrentWorkspace();
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

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
      const projectMap = readMap("kora.projects.supabaseImport.v1");

      const newCandidates: ImportCandidate[] = [];
      for (const local of localTasks) {
        if (local.isDemo) continue;

        const status: ImportStatus = meta.importedMap[String(local.id)] ? "imported" : "new";
        const clientOrphan = !!local.clientId && !clientMap[String(local.clientId)];
        const quoteOrphan = !!local.quoteId && !quoteMap[String(local.quoteId)];
        // Garantia de ordem (§8.1): só é órfã se HOUVER projectId sem mapeamento —
        // uma tarefa solta (sem projectId) nunca é órfã, é um caso de uso legítimo.
        const projectOrphan = !!local.projectId && !projectMap[String(local.projectId)];

        newCandidates.push({
          localTask: local,
          status,
          clientOrphan,
          quoteOrphan,
          projectOrphan,
        });
      }

      setCandidates(newCandidates);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error during analysis");
    } finally {
      setLoading(false);
    }
  }, [localTasks, workspace]);

  const importSelected = useCallback(async (ids: string[]): Promise<ImportResult> => {
    const result: ImportResult = { successIds: [], failedIds: [] };
    const meta = readMeta();
    const clientMap = readMap("kora.clients.supabaseImport.v1");
    const quoteMap = readMap("kora.quotes.supabaseImport.v1");
    const projectMap = readMap("kora.projects.supabaseImport.v1");

    for (const id of ids) {
      const candidate = candidates.find((c) => String(c.localTask.id) === id);
      if (!candidate || candidate.status !== "new") continue; // safety
      const local = candidate.localTask;

      try {
        if (!workspace) throw new Error("Workspace not available for import");

        // F3: payload com as FKs resolvidas via import-maps (UUID ou null; NUNCA id
        // local cru). project_id resolve pelo map já existente no momento desta
        // chamada — se o projeto pai ainda não foi importado, vira null aqui, nunca
        // um id inventado (§8.1).
        const payload = mapLocalTaskToSupabase(local, {
          clients: clientMap,
          quotes: quoteMap,
          projects: projectMap,
        });

        const sourceLocalId = buildSourceLocalId(getInstallId(), String(local.id));
        const created = await tasksRepository.importTask(workspace.id, sourceLocalId, payload);

        // Metadata só é gravada APÓS sucesso — mesma disciplina de todas as fatias
        // anteriores (reexecução após falha parcial é segura, §8.1).
        meta.importedMap[String(local.id)] = created.id;
        meta.importedLocalIds = [...meta.importedLocalIds, String(local.id)];
        meta.lastImportedAt = new Date().toISOString();
        writeMeta(meta);
        result.successIds.push(String(local.id));
        emitNotification({
          title: "Tarefa importada",
          description: local.title,
          category: "import",
          type: "success",
        });
      } catch (e: unknown) {
        result.failedIds.push(String(local.id));
        meta.skippedLocalIds = [...(meta.skippedLocalIds || []), String(local.id)];
        writeMeta(meta);
        emitNotification({
          title: "Falha ao importar tarefa",
          description: local.title,
          category: "import",
          type: "error",
        });
      }
    }
    analyze();
    return result;
  }, [candidates, analyze, workspace]);

  useEffect(() => {
    analyze();
  }, [localTasks, analyze]);

  return { candidates, loading, error, analyze, importSelected };
}
