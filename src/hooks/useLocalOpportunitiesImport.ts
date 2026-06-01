import { useState, useCallback, useMemo } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useLeads, type Lead } from "@/hooks/useLeads";
import { useSupabaseOpportunities } from "@/hooks/useSupabaseOpportunities";
import { crmOpportunitiesRepository, type SupabaseOpportunity, type SupabaseOpportunityInput } from "@/repositories/crmOpportunitiesRepository";
import { mapLocalLeadToSupabaseOpportunity } from "@/services/crm/crmOpportunityMapper";
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
  raw: Lead;
}

const METADATA_KEY = "kora.crm.supabaseImport.v1";
const CLIENTS_METADATA_KEY = "kora.clients.supabaseImport.v1";

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
        raw: local,
      });
    }

    return list;
  }, [localLeads, supabaseOpportunities, importMetadata]);

  const importSelected = useCallback(async (selectedIds: number[]) => {
    if (!workspace) {
      toast.error("Nenhum workspace Supabase ativo encontrado.");
      return;
    }

    const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));
    if (selectedCandidates.length === 0) return;

    setImporting(true);
    const successIds: number[] = [];
    const newlyImportedMap: Record<string, string> = {};

    try {
      for (const item of selectedCandidates) {
        const local = item.raw;

        // Mapper local lead -> Supabase opportunity payload
        const opportunityInput: SupabaseOpportunityInput = mapLocalLeadToSupabaseOpportunity(local);

        // Map local clientId to Supabase client UUID if client import mapping exists
        if (local.clientId) {
          const supabaseClientId = clientImportMap[String(local.clientId)];
          if (supabaseClientId) {
            opportunityInput.client_id = supabaseClientId;
          } else {
            opportunityInput.client_id = null;
          }
        }

        // Create opportunity in Supabase
        const result = await crmOpportunitiesRepository.createOpportunity(workspace.id, opportunityInput);

        successIds.push(item.id);
        if (result && result.id) {
          newlyImportedMap[String(item.id)] = String(result.id);
        }
      }

      // Calculate skipped: candidates that are not selected AND not already imported
      const newlySkipped = candidates
        .filter((c) => !selectedIds.includes(c.id) && c.matchStatus !== "imported")
        .map((c) => c.id);

      const nextImportedIds = Array.from(new Set([...importMetadata.importedLocalIds, ...successIds]));
      const nextSkippedIds = Array.from(new Set([...(importMetadata.skippedLocalIds || []), ...newlySkipped]));
      const nextImportedMap = { ...(importMetadata.importedMap || {}), ...newlyImportedMap };

      const nextMeta = {
        lastImportedAt: new Date().toISOString(),
        importedLocalIds: nextImportedIds,
        skippedLocalIds: nextSkippedIds,
        importedMap: nextImportedMap,
      };

      localStorage.setItem(METADATA_KEY, JSON.stringify(nextMeta));
      setImportMetadata(nextMeta);
      await refreshOpportunities();
      toast.success(`${successIds.length} oportunidades importadas com sucesso!`);
    } catch (err) {
      console.error("Error during Supabase opportunities import:", err);
      toast.error("Ocorreu um erro ao importar uma ou mais oportunidades.");
    } finally {
      setImporting(false);
    }
  }, [workspace, candidates, importMetadata, clientImportMap, refreshOpportunities]);

  return {
    candidates,
    importing,
    importSelected,
    importedIds: importMetadata.importedLocalIds,
    metadata: importMetadata,
  };
}
