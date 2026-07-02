// Supabase projects summary — React Query (A2). Public API unchanged.
import { useQuery } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository, type SupabaseProject } from "@/repositories/projectsRepository";
import { getFriendlyMessage } from "@/lib/supabase/errors";

export function useSupabaseProjectsSummary() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";

  const query = useQuery({
    queryKey: ["supabase-projects", workspaceId],
    queryFn: () => projectsRepository.listProjects(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  return {
    projects: (query.data ?? []) as SupabaseProject[],
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh: () => query.refetch(),
  };
}
