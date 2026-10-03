// G82 (5º consumidor da ficha, mesma família do G74) — leitura de TODAS as
// fichas do workspace numa só query, pra consumidores que precisam do
// agregado (KoraOnboarding: "alguma ficha preenchida?") e não de um cliente
// por vez. `client_id` já é o uuid nativo — nenhuma resolução por mapa.
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import type { SupabaseTechnicalSheetData } from "@/hooks/useSupabaseTechnicalSheet";

const EMPTY: SupabaseTechnicalSheetData[] = [];

export function useSupabaseTechnicalSheetsAll() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";

  const query = useQuery({
    queryKey: ["supabase-technical-sheets-all", workspaceId],
    queryFn: async () =>
      (await clientTechnicalSheetsRepository.listTechnicalSheets(workspaceId)) as unknown as SupabaseTechnicalSheetData[],
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  return { sheets: query.data ?? EMPTY };
}
