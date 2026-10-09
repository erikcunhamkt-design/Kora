// Etapa 5 · Flip de Fichas Técnicas, fatia F2 (`etapa-5-flip-fichas-pacote.md`
// §11) — leitura bifurcada por CLIENTE, não por flag global. Este domínio já
// tem, desde o hotfix do G63, um seletor por-cliente (`getTechnicalSheetDataSource`)
// e um opt-in global (`getTechnicalSheetExperimentalEnabled`) — não introduz
// nenhum flag novo, só reusa exatamente a mesma decisão que
// `ClientTechnicalSheet.tsx` (a própria página da ficha) já aplica pra montar
// seu `sheet` local, extraída aqui pra servir os consumidores secundários
// (G74: `ClientTechnicalSheetSnapshot`/`ClientProfileDrawer`/
// `buildMaterialEvents`; o `ClientTechnicalSheetDialog`, 4º da lista original, era
// código morto e foi removido — G84) sem duplicar a lógica.
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
import { readLocalAccesses } from "@/services/technicalSheets/accessesLocalStore";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";

const EMPTY_SHEET: ClientTechnicalSheet = {};

export function useBifurcatedTechnicalSheet(
  clientId: string | number | undefined,
): ClientTechnicalSheet {
  const { clients } = useClients();
  const { sheet: supabaseSheet, supabaseClientId } = useSupabaseTechnicalSheet(clientId);
  const { workspace } = useCurrentWorkspace();

  return useMemo(() => {
    if (clientId === undefined) return EMPTY_SHEET;

    // G82: o id vindo da lista de Clientes em nuvem é um uuid — o cliente
    // LOCAL correspondente (se existir) é achado por id igual OU pelo mapa
    // local→uuid (cliente legado importado). Sem cliente local, a única
    // fonte que existe pra esta ficha é a nuvem, independente dos flags.
    const localClient = findLocalClientForSheet(clients, clientId);
    // F4: com os defaults pós-flip (nuvem salvo "local" explícito) a nuvem só é a
    // fonte quando ela é ALCANÇÁVEL — workspace ativo E cliente com vínculo
    // resolvido. Sem isso, um usuário 100% local (sem workspace / cliente não
    // importado) passaria a ver a ficha "vazia".
    const cloudReachable = !!workspace && !!supabaseClientId;
    const isSupabase =
      !localClient ||
      (cloudReachable &&
        getTechnicalSheetExperimentalEnabled() &&
        getTechnicalSheetDataSource(clientId) === "supabase");

    if (isSupabase) {
      if (!supabaseSheet) return EMPTY_SHEET;
      const mapped = mapSupabaseToLocalSheet(supabaseSheet);
      // FP2: acessos só-locais (nunca vêm da nuvem) — o armazenamento local deste
      // dispositivo, ou a cópia local do cliente legado.
      const localAccesses =
        readLocalAccesses(clientId) ?? localClient?.technicalSheet?.accesses;
      return localAccesses && localAccesses.length > 0 ? { ...mapped, accesses: localAccesses } : mapped;
    }

    // Fonte local real: `orbyt.clients.v1` (useClients(), não a lista
    // bifurcada de Clientes) — `technicalSheet` é um campo aninhado que só
    // existe nesse storage, nunca em um `Client` vindo do mapper cloud
    // (useClientsDataSource.ts) — usar a lista bifurcada aqui reintroduziria
    // o mesmo buraco do G74 pro próprio caminho "local".
    return localClient?.technicalSheet ?? EMPTY_SHEET;
  }, [clientId, supabaseSheet, supabaseClientId, workspace, clients]);
}
