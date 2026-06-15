// @ts-nocheck
import { useEffect, useState, useCallback, useRef } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientsRepository, type SupabaseClientInput } from "@/repositories/clientsRepository";

export function useSupabaseClients() {
  const { workspace, loading: workspaceLoading } = useCurrentWorkspace();
  const [clients, setClients] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestSeq = useRef(0);

  const fetchClients = useCallback(async () => {
    if (workspaceLoading) {
      return;
    }

    if (!workspace) {
      setClients([]);
      setLoading(false);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const data = await clientsRepository.listClients(workspace.id);
      if (seq === requestSeq.current) {
        setClients(data);
      }
    } catch (err) {
      console.error("Error loading Supabase clients:", err);
      if (seq === requestSeq.current) {
        setError(err as Error);
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
      }
    }
  }, [workspace, workspaceLoading]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const addClient = useCallback(async (input: SupabaseClientInput) => {
    if (!workspace) throw new Error("No active workspace found");
    try {
      requestSeq.current += 1;
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
      requestSeq.current += 1;
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
      requestSeq.current += 1;
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
      requestSeq.current += 1;
      await clientsRepository.deleteClient(workspace.id, clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      return true;
    } catch (err) {
      console.error("Error deleting Supabase client:", err);
      throw err;
    }
  }, [workspace]);

  return {
    workspace,
    workspaceLoading,
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