// Supabase client technical sheet — React Query (A2). Public API unchanged.
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import { resolveSheetSupabaseClientId } from "@/services/technicalSheets/resolveSheetClientId";

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

  // G82: uuid direto passa direto (lista de Clientes em nuvem); o mapa
  // local→remoto só resolve o id numérico local (modo local/legado).
  const supabaseClientId = useMemo(
    () => resolveSheetSupabaseClientId(localClientId),
    [localClientId],
  );

  const queryClient = useQueryClient();
  const queryKey = ["supabase-technical-sheet", workspaceId, supabaseClientId];

  // G30 (F4/FP4): a linha devolvida pelo próprio upsert (`.select().single()`)
  // vira o cache — a UI nunca depende de um refetch pra refletir a própria
  // escrita (um GET com lag reverteria a tela pro valor antigo).
  const setCachedSheet = useCallback(
    (row: SupabaseTechnicalSheetData | null) => {
      queryClient.setQueryData(["supabase-technical-sheet", workspaceId, supabaseClientId], row);
    },
    [queryClient, workspaceId, supabaseClientId],
  );

  const query = useQuery({
    queryKey,
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
    setCachedSheet,
  };
}
