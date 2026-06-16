import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import type { Client } from "@/types/domain";

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

  const clients = useMemo(() => {
    if (source === "supabase") {
      return (supabaseClients || []).map(mapSupabaseClientToLocalClient);
    }
    return localClients;
  }, [source, localClients, supabaseClients]);

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

