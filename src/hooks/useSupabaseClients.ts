// @ts-nocheck
import { useEffect, useState, useCallback } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientsRepository, type SupabaseClientInput } from "@/repositories/clientsRepository";

export function useSupabaseClients() {
  const { workspace } = useCurrentWorkspace();
  const [clients, setClients] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClients = useCallback(async () => {
    if (!workspace) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await clientsRepository.listClients(workspace.id);
      setClients(data);
    } catch (err) {
      console.error("Error loading Supabase clients:", err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClient = useCallback(async (input: SupabaseClientInput) => {
    if (!workspace) throw new Error("No active workspace found");
    try {
      const result = await clientsRepository.createClient(workspace.id, input);
      setClients((prev) => [result, ...prev]);
      return result;
    } catch (err) {
      console.error("Error creating Supabase client:", err);
      throw err;
    }
  }, [workspace]);

  const updateClient = useCallback(async (clientId: string, patch: Partial<SupabaseClientInput>) => {
    if (!workspace) throw new Error("No active workspace found");
    try {
      const result = await clientsRepository.updateClient(workspace.id, clientId, patch);
      setClients((prev) => prev.map((c) => (c.id === clientId ? result : c)));
      return result;
    } catch (err) {
      console.error("Error updating Supabase client:", err);
      throw err;
    }
  }, [workspace]);

  const archiveClient = useCallback(async (clientId: string, archived = true) => {
    if (!workspace) throw new Error("No active workspace found");
    try {
      const result = await clientsRepository.archiveClient(workspace.id, clientId, archived);
      setClients((prev) => prev.map((c) => (c.id === clientId ? result : c)));
      return result;
    } catch (err) {
      console.error("Error archiving Supabase client:", err);
      throw err;
    }
  }, [workspace]);

  const deleteClient = useCallback(async (clientId: string) => {
    if (!workspace) throw new Error("No active workspace found");
    try {
      await clientsRepository.deleteClient(workspace.id, clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      return true;
    } catch (err) {
      console.error("Error deleting Supabase client:", err);
      throw err;
    }
  }, [workspace]);

  return {
    clients,
    loading,
    error,
    addClient,
    updateClient,
    archiveClient,
    deleteClient,
    refreshClients: fetchClients,
  };
}
export type { SupabaseClientInput };