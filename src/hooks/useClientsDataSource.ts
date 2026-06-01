import { useState, useEffect, useCallback, useMemo } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useClients } from "@/hooks/useClients";
import { useSupabaseClients } from "@/hooks/useSupabaseClients";
import type { Client } from "@/types/domain";

const DATA_SOURCE_KEY = "kora.clients.dataSource.v1";

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
  };
}

export function useClientsDataSource() {
  const { workspace } = useCurrentWorkspace();
  const { clients: localClients, setClients: setLocalClients } = useClients();
  const { clients: supabaseClients, loading: supabaseLoading, error: supabaseError, refreshClients } = useSupabaseClients();

  const isSupabaseAvailable = useMemo(() => {
    return !!workspace;
  }, [workspace]);

  const [source, setSourceState] = useState<"local" | "supabase">(() => {
    try {
      const saved = localStorage.getItem(DATA_SOURCE_KEY);
      if (saved === "supabase" && workspace) {
        return "supabase";
      }
    } catch {
      // Ignore
    }
    return "local";
  });

  const setSource = useCallback((newSource: "local" | "supabase") => {
    if (newSource === "supabase" && !workspace) {
      return false; // Cannot switch to Supabase if not available
    }
    try {
      localStorage.setItem(DATA_SOURCE_KEY, newSource);
    } catch {
      // Ignore
    }
    setSourceState(newSource);
    return true;
  }, [workspace]);

  // Fallback check: if workspace is lost, fallback to local source automatically
  useEffect(() => {
    if (!workspace && source === "supabase") {
      setSourceState("local");
    }
  }, [workspace, source]);

  const clients = useMemo(() => {
    if (source === "supabase") {
      return (supabaseClients || []).map(mapSupabaseClientToLocalClient);
    }
    return localClients;
  }, [source, localClients, supabaseClients]);

  const loading = source === "supabase" ? supabaseLoading : false;
  const error = source === "supabase" ? supabaseError : null;

  return {
    source,
    setSource,
    clients,
    loading,
    error,
    isSupabaseAvailable,
    refresh: refreshClients,
  };
}
