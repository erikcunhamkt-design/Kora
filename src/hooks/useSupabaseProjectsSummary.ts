import { useCallback, useEffect, useState } from "react";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository, type SupabaseProject } from "@/repositories/projectsRepository";

export function useSupabaseProjectsSummary() {
  const { workspace } = useCurrentWorkspace();
  const [projects, setProjects] = useState<SupabaseProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceId = workspace?.id ?? "";

  const fetchProjects = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectsRepository.listProjects(workspaceId);
      setProjects(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar projetos do Supabase");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return {
    projects,
    loading,
    error,
    refresh: fetchProjects,
  };
}
