import { useState, useCallback, useMemo } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { crmOpportunitiesRepository, type SupabaseOpportunity, type SupabaseOpportunityInput } from "@/repositories/crmOpportunitiesRepository";
import { mapLocalLeadToSupabaseOpportunity } from "@/services/crm/crmOpportunityMapper";
import { getInstallId, buildSourceLocalId } from "@/lib/installId";
import { toast } from "sonner";

export interface LocalOpportunityCandidate {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  stage: string;
  archived: boolean;
  matchStatus: "new" | "duplicate" | "imported";
  matchedId?: string;
  /** A4: referencia um cliente local que ainda NÃO está no Supabase → migra com client_id null. */
  clientOrphan: boolean;
  raw: Lead;
}

const METADATA_KEY = "kora.crm.supabaseImport.v1";
const CLIENTS_METADATA_KEY = "kora.clients.supabaseImport.v1";
const QUOTES_METADATA_KEY = "kora.quotes.supabaseImport.v1";

export function useLocalOpportunitiesImport() {
  const { workspace } = useCurrentWorkspace();
  const { leads: localLeads } = useLeads();
  const { opportunities: supabaseOpportunities, refresh: refreshOpportunities } = useSupabaseOpportunities();
  const [importing, setImporting] = useState(false);

  const [importMetadata, setImportMetadata] = useState<{
    lastImportedAt?: string;
    importedLocalIds: number[];
    skippedLocalIds: number[];
    importedMap: Record<string, string>;
  }>(() => {
    try {
      const raw = localStorage.getItem(METADATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          lastImportedAt: parsed.lastImportedAt,
          importedLocalIds: parsed.importedLocalIds || [],
          skippedLocalIds: parsed.skippedLocalIds || [],
          importedMap: parsed.importedMap || {},
        };
      }
      return { importedLocalIds: [], skippedLocalIds: [], importedMap: {} };
    } catch {
      return { importedLocalIds: [], skippedLocalIds: [], importedMap: {} };
    }
  });

  const clientImportMap = useMemo<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(CLIENTS_METADATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.importedMap || {};
      }
    } catch {
      // Ignore
    }
    return {};
  }, []);

  // A1: mapa de orçamentos local→Supabase, para re-mapear quote_id ao migrar.
  const quoteImportMap = useMemo<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(QUOTES_METADATA_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.importedMap || {};
      }
    } catch {
      // Ignore
    }
    return {};
  }, []);

  const candidates = useMemo(() => {
    const list: LocalOpportunityCandidate[] = [];
    const nonDemoLocals = localLeads.filter((l) => !l.isDemo);

    for (const local of nonDemoLocals) {
      // 1. Check if already imported according to metadata/map
      const isAlreadyImported =
        importMetadata.importedLocalIds.includes(local.id) ||
        !!importMetadata.importedMap[String(local.id)];

      // 2. Check for matching items in Supabase current workspace
      const matched = supabaseOpportunities.find((s: SupabaseOpportunity) => {
        const emailMatch = s.email && local.email && s.email.toLowerCase() === local.email.toLowerCase();
        const phoneMatch =
          (s.whatsapp && local.phone && s.whatsapp.replace(/\D/g, "") === local.phone.replace(/\D/g, "")) ||
          (s.phone && local.phone && s.phone.replace(/\D/g, "") === local.phone.replace(/\D/g, ""));
        const titleMatch = s.title.toLowerCase() === local.name.toLowerCase() &&
                           (s.company?.toLowerCase() || "") === (local.company?.toLowerCase() || "");

        return emailMatch || phoneMatch || titleMatch;
      });

      let matchStatus: "new" | "duplicate" | "imported" = "new";
      if (isAlreadyImported) {
        matchStatus = "imported";
      } else if (matched) {
        matchStatus = "duplicate";
      }

      list.push({
        id: local.id,
        name: local.name,
        company: local.company || "",
        email: local.email || "",
        phone: local.phone || "",
        stage: local.stage,
        archived: local.archived || false,
        matchStatus,
        matchedId: matched?.id || importMetadata.importedMap[String(local.id)],
        // A4: cliente local referenciado que ainda não está no Supabase.
        clientOrphan: !!local.clientId && !clientImportMap[String(local.clientId)],
        raw: local,
      });
    }

    return list;
  }, [localLeads, supabaseOpportunities, importMetadata, clientImportMap]);

  const importSelected = useCallback(async (selectedIds: number[]) => {
    if (!workspace) {
      toast.error("Nenhum workspace Supabase ativo encontrado.");
      return;
    }

    // A2 (defesa em profundidade): só candidatos "new" são importáveis. Nunca confiar
    // apenas na UI — "duplicate"/"imported" são recusados aqui também.
    const selectedCandidates = candidates.filter(
      (c) => selectedIds.includes(c.id) && c.matchStatus === "new",
    );
    if (selectedCandidates.length === 0) return;

    setImporting(true);
    // A3: id estável por navegador para namespacar o source_local_id (idempotência no banco).
    const installId = getInstallId();
    const successIds: number[] = [];
    const newlyImportedMap: Record<string, string> = {};
    let failed = 0;

    // Candidatos não selecionados e ainda não importados = "skipped" (registro apenas).
    const newlySkipped = candidates
      .filter((c) => !selectedIds.includes(c.id) && c.matchStatus !== "imported")
      .map((c) => c.id);

    // A1 (atomicidade): persiste o progresso a CADA sucesso. Se um lead falhar no meio
    // do lote, os anteriores permanecem rastreados (não viram duplicata na próxima vez).
    const persist = () => {
      const nextMeta = {
        lastImportedAt: new Date().toISOString(),
        importedLocalIds: Array.from(new Set([...importMetadata.importedLocalIds, ...successIds])),
        skippedLocalIds: Array.from(new Set([...(importMetadata.skippedLocalIds || []), ...newlySkipped])),
        importedMap: { ...(importMetadata.importedMap || {}), ...newlyImportedMap },
      };
      try {
        localStorage.setItem(METADATA_KEY, JSON.stringify(nextMeta));
      } catch {
        /* quota / storage desabilitado */
      }
      setImportMetadata(nextMeta);
    };

    try {
      for (const item of selectedCandidates) {
        try {
          // A1: mapper re-mapeia client_id/quote_id/converted_client_id via import-maps
          // (UUID ou null); nunca id local cru em coluna uuid.
          const opportunityInput: SupabaseOpportunityInput = mapLocalLeadToSupabaseOpportunity(item.raw, {
            clients: clientImportMap,
            quotes: quoteImportMap,
          });

          const sourceLocalId = buildSourceLocalId(installId, item.id);

          // G57 (Design C, revisor aprovado) — o mapper recalcula won_at/lost_at
          // do zero a cada chamada (new Date().toISOString() sempre que o
          // stage bate), então reimportar o MESMO lead sem o stage ter mudado
          // gera um timestamp novo a cada vez — sem idempotência real (achado
          // do revisor na revisão do G57, kora-hub-auditoria-e-plano.md).
          // Guarda: acha a linha existente por source_local_id na lista JÁ EM
          // MEMÓRIA (supabaseOpportunities, buscada pelo próprio hook pra
          // montar `candidates` — zero round-trip novo, sem SELECT extra nem
          // corrida SELECT/UPSERT). Se o stage não mudou desde a última
          // importação, reusa won_at/lost_at já gravados em vez de deixar o
          // mapper recalcular; se mudou (ex.: fechado→perdido), o
          // recálculo do mapper está certo e fica como está — mesmo
          // comportamento do caminho PRIMÁRIO (moveOpportunityStage).
          const existing = supabaseOpportunities.find((o) => o.source_local_id === sourceLocalId);
          if (existing && existing.stage === opportunityInput.stage) {
            opportunityInput.won_at = existing.won_at;
            opportunityInput.lost_at = existing.lost_at;
          }

          // A3: upsert idempotente por (workspace_id, source_local_id namespacado).
          const result = await crmOpportunitiesRepository.upsertImportedOpportunity(
            workspace.id,
            opportunityInput,
            sourceLocalId,
          );

          successIds.push(item.id);
          if (result && result.id) {
            newlyImportedMap[String(item.id)] = String(result.id);
          }
          persist(); // grava incrementalmente a cada sucesso
        } catch (err) {
          failed += 1;
          console.error(`Falha ao importar oportunidade local ${item.id}:`, err);
          // Não aborta o lote — segue com os demais, preservando o tracking dos que subiram.
        }
      }

      await refreshOpportunities();

      if (failed === 0) {
        toast.success(`${successIds.length} oportunidades importadas com sucesso!`);
      } else if (successIds.length > 0) {
        toast.warning(
          `${successIds.length} importada(s); ${failed} falhou(aram). O progresso foi salvo — reexecutar não duplica as que já subiram.`,
        );
      } else {
        toast.error(`Nenhuma oportunidade importada (${failed} falha(s)).`);
      }
    } finally {
      persist(); // garante o estado final persistido
      setImporting(false);
    }
  }, [workspace, candidates, importMetadata, clientImportMap, quoteImportMap, refreshOpportunities, supabaseOpportunities]);

  return {
    candidates,
    importing,
    importSelected,
    importedIds: importMetadata.importedLocalIds,
    metadata: importMetadata,
  };
}
