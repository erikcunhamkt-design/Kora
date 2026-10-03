// Etapa 5 · Flip de Fichas Técnicas, fatia F2 (`etapa-5-flip-fichas-pacote.md`
// §11) — leitura bifurcada por CLIENTE, não por flag global. Este domínio já
// tem, desde o hotfix do G63, um seletor por-cliente (`getTechnicalSheetDataSource`)
// e um opt-in global (`getTechnicalSheetExperimentalEnabled`) — não introduz
// nenhum flag novo, só reusa exatamente a mesma decisão que
// `ClientTechnicalSheet.tsx` (a própria página da ficha) já aplica pra montar
// seu `sheet` local, extraída aqui pra servir os consumidores secundários
// (G74: `ClientTechnicalSheetSnapshot`/`ClientTechnicalSheetDialog`/
// `ClientProfileDrawer`/`buildMaterialEvents`) sem duplicar a lógica.
//
// [G63 — invariante, não uma escolha desta rodada] `mapSupabaseToLocalSheet`
// é reusado TAL COMO ESTÁ: essa função nunca reconstrói `accesses`/
// `competitors` a partir de `raw_payload` — a senha de acesso da plataforma
// do cliente (`ClientAccess.password`) nunca deve voltar num objeto lido da
// nuvem. Não "completar" esse mapeamento aqui.
import { useMemo } from "react";
import { useClients, type ClientTechnicalSheet } from "@/hooks/useClients";
import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import { mapSupabaseToLocalSheet } from "@/services/technicalSheets/supabaseTechnicalSheetToLocalMapper";
import { getTechnicalSheetExperimentalEnabled, getTechnicalSheetDataSource } from "@/config/flags";
import { findLocalClientForSheet } from "@/services/technicalSheets/resolveSheetClientId";

const EMPTY_SHEET: ClientTechnicalSheet = {};

export function useBifurcatedTechnicalSheet(
  clientId: string | number | undefined,
): ClientTechnicalSheet {
  const { clients } = useClients();
  const { sheet: supabaseSheet } = useSupabaseTechnicalSheet(clientId);

  return useMemo(() => {
    if (clientId === undefined) return EMPTY_SHEET;

    // G82: o id vindo da lista de Clientes em nuvem é um uuid — o cliente
    // LOCAL correspondente (se existir) é achado por id igual OU pelo mapa
    // local→uuid (cliente legado importado). Sem cliente local, a única
    // fonte que existe pra esta ficha é a nuvem, independente dos flags.
    const localClient = findLocalClientForSheet(clients, clientId);
    const isSupabase =
      !localClient ||
      (getTechnicalSheetExperimentalEnabled() &&
        getTechnicalSheetDataSource(clientId) === "supabase");

    if (isSupabase) {
      return supabaseSheet ? mapSupabaseToLocalSheet(supabaseSheet) : EMPTY_SHEET;
    }

    // Fonte local real: `orbyt.clients.v1` (useClients(), não a lista
    // bifurcada de Clientes) — `technicalSheet` é um campo aninhado que só
    // existe nesse storage, nunca em um `Client` vindo do mapper cloud
    // (useClientsDataSource.ts) — usar a lista bifurcada aqui reintroduziria
    // o mesmo buraco do G74 pro próprio caminho "local".
    return localClient?.technicalSheet ?? EMPTY_SHEET;
  }, [clientId, supabaseSheet, clients]);
}
