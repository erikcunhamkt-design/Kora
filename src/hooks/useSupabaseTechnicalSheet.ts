import { useState, useEffect, useCallback, useMemo } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";

const CLIENTS_IMPORT_META_KEY = "kora.clients.supabaseImport.v1";

export interface SupabaseTechnicalSheetData {
  id: string;
  workspace_id: string;
  client_id: string;
  branding?: Record<string, unknown>;
  persona?: Record<string, unknown>;
  editorial?: Record<string, unknown>;
  typography?: Record<string, unknown>;
  social_links?: Record<string, unknown>;
  briefing?: Record<string, unknown>;
  materials?: Record<string, unknown>[];
  raw_payload?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useSupabaseTechnicalSheet(localClientId: string | number | undefined) {
  const { workspace } = useCurrentWorkspace();
  const [sheet, setSheet] = useState<SupabaseTechnicalSheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Retrieve supabaseClientId from importedMap
  const supabaseClientId = useMemo(() => {
    if (!localClientId) return null;
    try {
      const raw = localStorage.getItem(CLIENTS_IMPORT_META_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        const map = parsed.importedMap || {};
        return (map[String(localClientId)] as string) || null;
      }
    } catch (err) {
      console.error("Error reading clients importedMap in hook:", err);
    }
    return null;
  }, [localClientId]);

  const loadSheet = useCallback(async () => {
    if (!workspace?.id || !supabaseClientId) {
      setSheet(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await clientTechnicalSheetsRepository.getTechnicalSheet(
        workspace.id,
        supabaseClientId
      );
      // Casting the returned row from Supabase to SupabaseTechnicalSheetData
      setSheet((data as unknown as SupabaseTechnicalSheetData) || null);
    } catch (err) {
      console.error("Error loading Supabase technical sheet:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, supabaseClientId]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  return {
    supabaseClientId,
    sheet,
    loading,
    error,
    refresh: loadSheet,
  };
}
