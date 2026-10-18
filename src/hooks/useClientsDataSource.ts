import { useEffect, useMemo, useState } from "react";
import { useClients } from "@/hooks/useClients";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import type { Client } from "@/types/domain";
import {
  CLIENT_LIBRARY_CHANGED_EVENT,
  readClientLibraryStore,
  withLocalLibrary,
} from "@/services/clients/clientLibraryLocalStore";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapSupabaseClientToLocalClient(s: any): Client {
  return {
    id: s.id as unknown as number, // Cast string UUID to number for TS compatibility
    name: s.name || "",
    company: s.company || "",
    email: s.email || "",
    phone: s.phone || s.whatsapp || "",
    whatsapp: s.whatsapp || s.phone || "",
    instagram: s.instagram || "",
    site: s.website || "",
    serviceType: s.type || "",
    origin: s.source || "",
    status: s.status || "Ativo",
    potentialValue: s.potential_value || 0,
    totalRevenue: s.total_revenue || 0,
    lastProject: "—",
    lastInteraction: "—",
    observations: s.notes || "",
    projects: [],
    tasks: [],
    isDemo: s.is_demo || false,
    document: s.document || "",
    city: s.city || "",
    state: s.state || "",
    address: s.address || "",
    tags: s.tags || [],
    temperature: s.temperature || "Morno",
    nextAction: s.next_action || "",
    nextActionDate: s.next_action_date || "",
    createdAt: s.created_at,
    updatedAt: s.updated_at || s.created_at,
    contacts: [],
    avatarUrl: s.avatar_url || undefined,
    archived: !!s.archived,
  };
}

export function useClientsDataSource() {
  const { clients: localClients } = useClients();
  const supa = useSupabaseClients();
  const { workspace, workspaceLoading, clients: supabaseClients, loading: supabaseLoading, error: supabaseError, refreshClients } = supa;
  const source: "local" | "supabase" = workspaceLoading || workspace ? "supabase" : "local";

  const isSupabaseAvailable = useMemo(() => {
    return !!workspace;
  }, [workspace]);

  // G97/M0: a Biblioteca do cliente (`Client.assets`) ainda não tem coluna na nuvem — em
  // fonte nuvem ela vive no armazenamento local por uuid (clientLibraryLocalStore) e é
  // mesclada aqui, pra sobreviver ao reload/reabertura. Reage às escritas do store.
  const [libraryTick, setLibraryTick] = useState(0);
  useEffect(() => {
    const bump = () => setLibraryTick((t) => t + 1);
    window.addEventListener(CLIENT_LIBRARY_CHANGED_EVENT, bump);
    return () => window.removeEventListener(CLIENT_LIBRARY_CHANGED_EVENT, bump);
  }, []);

  const clients = useMemo(() => {
    if (source === "supabase") {
      const store = readClientLibraryStore();
      return (supabaseClients || []).map((c) =>
        withLocalLibrary(mapSupabaseClientToLocalClient(c), store, localClients),
      );
    }
    return localClients;
    // libraryTick: recompõe a lista depois de uma escrita no store da Biblioteca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, localClients, supabaseClients, libraryTick]);

  const loading = workspaceLoading || (source === "supabase" ? supabaseLoading : false);
  const error = source === "supabase" ? supabaseError : null;

  return {
    source,
    clients,
    loading,
    error,
    isSupabaseAvailable,
    refresh: refreshClients,
    addClient: supa.addClient,
    updateClient: supa.updateClient,
    archiveClient: supa.archiveClient,
    deleteClient: supa.deleteClient,
  };
}

