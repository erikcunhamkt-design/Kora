import { useState, useCallback, useMemo } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClients } from "@/hooks/useClients";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import { clientsRepository, type SupabaseClientInput } from "@/repositories/clientsRepository";
import { toast } from "sonner";

export interface LocalClientCandidate {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: string;
  archived: boolean;
  matchStatus: "new" | "duplicate" | "imported";
  matchedId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any;
}

const METADATA_KEY = "kora.clients.supabaseImport.v1";

export function useLocalClientsImport() {
  const { workspace } = useCurrentWorkspace();
  const { clients: localClients } = useClients();
  const { clients: supabaseClients, refreshClients } = useSupabaseClients();
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

  const candidates = useMemo(() => {
    const list: LocalClientCandidate[] = [];
    const nonDemoLocals = localClients.filter((c) => !c.isDemo);

    for (const local of nonDemoLocals) {
      // 1. Check if already imported according to metadata or map
      const isAlreadyImported = 
        importMetadata.importedLocalIds.includes(local.id) || 
        !!importMetadata.importedMap[String(local.id)];

      // 2. Check for matching items in Supabase current workspace
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const matched = supabaseClients.find((s: any) => {
        const emailMatch = s.email && local.email && s.email.toLowerCase() === local.email.toLowerCase();
        const phoneMatch = s.phone && local.phone && s.phone.replace(/\D/g, "") === local.phone.replace(/\D/g, "");
        const nameCompanyMatch = s.name.toLowerCase() === local.name.toLowerCase() && 
                                 s.company?.toLowerCase() === local.company?.toLowerCase();

        return emailMatch || phoneMatch || nameCompanyMatch;
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
        phone: local.whatsapp || local.phone || "",
        status: local.status,
        archived: local.status === "Arquivado",
        matchStatus,
        matchedId: matched?.id || importMetadata.importedMap[String(local.id)],
        raw: local,
      });
    }

    return list;
  }, [localClients, supabaseClients, importMetadata]);

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
        
        // Map local object to Supabase database client input schema
        const clientInput: SupabaseClientInput = {
          name: local.name,
          company: local.company || null,
          email: local.email || null,
          phone: local.phone || null,
          whatsapp: local.whatsapp || null,
          instagram: local.instagram || null,
          website: local.site || null,
          city: local.city || null,
          state: local.state || null,
          address: local.address || null,
          document: local.document || null,
          type: local.serviceType || null,
          status: local.status || "Ativo",
          source: local.origin || null,
          temperature: local.temperature || null,
          potential_value: local.potentialValue || 0,
          total_revenue: local.totalRevenue || 0,
          next_action: local.nextAction || null,
          next_action_date: local.nextActionDate || null,
          notes: local.observations || null,
          tags: local.tags || [],
          archived: local.archived || false,
          is_demo: false,
        };

        // Create client in Supabase
        const result = await clientsRepository.createClient(workspace.id, clientInput);

        // If client contacts exist, import them too
        if (local.contacts && Array.isArray(local.contacts)) {
          for (const contact of local.contacts) {
            await clientsRepository.createClientContact(workspace.id, result.id, {
              name: contact.name,
              role: contact.role || null,
              email: contact.email || null,
              phone: contact.phone || null,
              whatsapp: contact.whatsapp || null,
              is_primary: contact.isPrimary || false,
              is_financial: contact.isFinancial || false,
              is_decision_maker: contact.isDecisionMaker || false,
              notes: contact.notes || null,
            });
          }
        }

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
      await refreshClients();
      toast.success(`${successIds.length} clientes importados com sucesso!`);
    } catch (err) {
      console.error("Error during Supabase import:", err);
      toast.error("Ocorreu um erro ao importar um ou mais clientes.");
    } finally {
      setImporting(false);
    }
  }, [workspace, candidates, importMetadata, refreshClients]);

  return {
    candidates,
    importing,
    importSelected,
    importedIds: importMetadata.importedLocalIds,
    metadata: importMetadata,
  };
}
export type { SupabaseClientInput };

