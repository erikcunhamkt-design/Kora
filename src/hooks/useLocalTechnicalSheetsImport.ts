// Espelho Reversível (Etapa 5) — assistente de import de referência do padrão: ver docs/architecture/espelho-reversivel.md
import { useState, useCallback, useMemo, useEffect } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClients } from "@/hooks/useClients";
import { clientTechnicalSheetsRepository, type SupabaseTechnicalSheetInput } from "@/repositories/clientTechnicalSheetsRepository";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { mapLocalToSupabaseSheet } from "@/services/technicalSheets/technicalSheetMapper";

export interface TechnicalSheetCandidate {
  localClientId: number;
  name: string;
  company: string;
  status: "pronto" | "sem_cliente" | "existe" | "sem_ficha";
  statusText: string;
  supabaseClientId?: string;
  supabaseTechnicalSheetId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawLocalSheet?: any;
}

const CLIENTS_IMPORT_META_KEY = "kora.clients.supabaseImport.v1";
const TECH_SHEET_IMPORT_META_KEY = "kora.technicalSheets.supabaseImport.v1";

export function useLocalTechnicalSheetsImport() {
  const { workspace } = useCurrentWorkspace();
  const { clients: localClients } = useClients();
  const [importing, setImporting] = useState(false);
  const [existingSheets, setExistingSheets] = useState<{ client_id: string; id: string }[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const [metadata, setMetadata] = useState<{
    lastImportedAt?: string;
    importedLocalClientIds: number[];
    importedMap: Record<string, string>;
  }>(() => {
    try {
      const raw = localStorage.getItem(TECH_SHEET_IMPORT_META_KEY);
      return raw ? JSON.parse(raw) : { importedLocalClientIds: [], importedMap: {} };
    } catch {
      return { importedLocalClientIds: [], importedMap: {} };
    }
  });

  const clientsImportMap = useMemo<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(CLIENTS_IMPORT_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.importedMap || {};
      }
    } catch {
      // Ignore
    }
    return {};
  }, []);

  const fetchExistingSheets = useCallback(async () => {
    if (!workspace) return;
    setLoadingExisting(true);
    try {
      const { data, error } = await supabase
        .from("client_technical_sheets")
        .select("client_id, id")
        .eq("workspace_id", workspace.id);
      if (error) throw error;
      setExistingSheets(data || []);
    } catch (err) {
      console.error("Error loading existing technical sheets:", err);
    } finally {
      setLoadingExisting(false);
    }
  }, [workspace]);

  useEffect(() => {
    fetchExistingSheets();
  }, [fetchExistingSheets]);

  const candidates = useMemo(() => {
    const list: TechnicalSheetCandidate[] = [];
    const nonDemoLocals = localClients.filter((c) => !c.isDemo);

    for (const local of nonDemoLocals) {
      const localClientId = local.id;
      const supabaseClientId = clientsImportMap[String(localClientId)];
      const localSheet = local.technicalSheet;

      let hasLocalData = false;
      if (localSheet) {
        const keys = Object.keys(localSheet);
        hasLocalData = keys.some((k) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const val = (localSheet as any)[k];
          if (!val) return false;
          if (Array.isArray(val)) return val.length > 0;
          if (typeof val === "object") return Object.keys(val).length > 0;
          return true;
        });
      }

      let status: "pronto" | "sem_cliente" | "existe" | "sem_ficha" = "pronto";
      let statusText = "Pronto para importar";

      const matchedSheet = supabaseClientId
        ? existingSheets.find((s) => s.client_id === supabaseClientId)
        : undefined;

      const metadataSheetId = metadata.importedMap[String(localClientId)];
      const supabaseTechnicalSheetId = matchedSheet?.id || metadataSheetId;

      if (!hasLocalData) {
        status = "sem_ficha";
        statusText = "Sem ficha técnica local";
      } else if (!supabaseClientId) {
        status = "sem_cliente";
        statusText = "Cliente ainda não importado";
      } else if (matchedSheet || metadataSheetId) {
        status = "existe";
        statusText = "Já existe no Supabase";
      }

      list.push({
        localClientId,
        name: local.name,
        company: local.company || "",
        status,
        statusText,
        supabaseClientId,
        supabaseTechnicalSheetId,
        rawLocalSheet: localSheet,
      });
    }

    return list;
  }, [localClients, clientsImportMap, existingSheets, metadata]);

  const importSelected = useCallback(async (localClientIds: number[]) => {
    if (!workspace) {
      toast.error("Nenhum workspace Supabase ativo encontrado.");
      return;
    }

    const selectedCandidates = candidates.filter(
      (c) => localClientIds.includes(c.localClientId) && c.status === "pronto" && c.supabaseClientId
    );

    if (selectedCandidates.length === 0) return;

    setImporting(true);
    const successLocalIds: number[] = [];
    const newlyImportedMap: Record<string, string> = {};

    try {
      for (const item of selectedCandidates) {
        const localSheet = item.rawLocalSheet;
        const supabaseClientId = item.supabaseClientId!;

        const input = mapLocalToSupabaseSheet(localSheet);

        const result = await clientTechnicalSheetsRepository.upsertTechnicalSheet(
          workspace.id,
          supabaseClientId,
          input
        );

        if (result && result.id) {
          successLocalIds.push(item.localClientId);
          newlyImportedMap[String(item.localClientId)] = String(result.id);
        }
      }

      const nextImportedIds = Array.from(
        new Set([...metadata.importedLocalClientIds, ...successLocalIds])
      );
      const nextImportedMap = { ...metadata.importedMap, ...newlyImportedMap };

      const nextMeta = {
        lastImportedAt: new Date().toISOString(),
        importedLocalClientIds: nextImportedIds,
        importedMap: nextImportedMap,
      };

      localStorage.setItem(TECH_SHEET_IMPORT_META_KEY, JSON.stringify(nextMeta));
      setMetadata(nextMeta);
      await fetchExistingSheets();
      toast.success(`${successLocalIds.length} fichas técnicas importadas com sucesso!`);
    } catch (err) {
      console.error("Error importing technical sheets:", err);
      toast.error("Ocorreu um erro ao importar uma ou mais fichas técnicas.");
    } finally {
      setImporting(false);
    }
  }, [workspace, candidates, metadata, fetchExistingSheets]);

  return {
    candidates,
    importing,
    importSelected,
    metadata,
    refresh: fetchExistingSheets,
    loading: loadingExisting,
  };
}
