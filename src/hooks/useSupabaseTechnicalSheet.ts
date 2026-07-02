// Supabase client technical sheet — React Query (A2). Public API unchanged.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const workspaceId = workspace?.id ?? "";

  // Resolve the Supabase client UUID from the local→remote import map.
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

  const query = useQuery({
    queryKey: ["supabase-technical-sheet", workspaceId, supabaseClientId],
    queryFn: async (): Promise<SupabaseTechnicalSheetData | null> => {
      const data = await clientTechnicalSheetsRepository.getTechnicalSheet(workspaceId, supabaseClientId!);
      return (data as unknown as SupabaseTechnicalSheetData) || null;
    },
    enabled: !!workspaceId && !!supabaseClientId,
    staleTime: 30_000,
  });

  return {
    supabaseClientId,
    sheet: (query.data ?? null) as SupabaseTechnicalSheetData | null,
    loading: query.isLoading || query.isFetching,
    error: (query.error ?? null) as Error | null,
    refresh: () => query.refetch(),
  };
}
