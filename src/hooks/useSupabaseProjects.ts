// Etapa 5 · Pacote do Flip (projects) — Fase B, item 1/2. CRUD completo em
// modo Supabase pra tela principal (ProjectsSection.tsx/ProjectDetailDrawer.tsx)
// — substitui o antigo blockWrite() da fatia N. Mesmo padrão de
// useSupabaseQuotes.ts (React Query, mutations com invalidação automática).
//
// Diferente do modo local (dataSource="local", onde a escrita é SEMPRE local
// + espelho best-effort via projectsCloudMirror.ts, padrão G22): em modo
// Supabase (dataSource="supabase") a escrita vai DIRETO pra nuvem, sem
// tocar o localStorage — o local não é a fonte que a tela está mostrando
// neste modo, gravar lá seria invisível pro usuário até uma troca de fonte.
//
// queryKey compartilhada com useSupabaseProjectsSummary.ts (mesmo dado —
// SupabaseProject[] de projectsRepository.listProjects) — os dois hooks
// dividem cache/dedup do React Query em vez de fazer 2 fetches da mesma
// tabela quando ambos estão montados (painel órfão + tela principal).
import { useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { projectsRepository, type SupabaseProject } from "@/repositories/projectsRepository";
import { mapLocalProjectToSupabase } from "@/services/projects/projectsMapper";
import { readProjectImportMaps } from "@/services/projects/projectsCloudMirror";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Project } from "@/hooks/useProjects";

const EMPTY_PROJECTS: SupabaseProject[] = [];

/** Mesmo shape que useProjects().addProject() já aceita — permite montar UM
 * objeto de formulário e passar pra qualquer um dos dois caminhos de escrita
 * (local ou nativo-nuvem) sem transformação. */
export type NewProjectInput = Omit<Project, "id" | "isDemo" | "createdAt" | "progress"> & { progress?: number };

export function useSupabaseProjects() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = ["supabase-projects", workspaceId];

  const query = useQuery({
    queryKey,
    queryFn: () => projectsRepository.listProjects(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["supabase-projects", workspaceId] }),
    [queryClient, workspaceId],
  );

  // Criação NATIVA (não vem de um registro local a importar) — mesmo
  // precedente de buildNativeSourceLocalId() em useSupabaseQuotes.ts (Q10):
  // prefixo "native:" nunca colide com o formato de import
  // ("${installId}:${localId}"), e cada chamada gera um valor novo, então
  // duas criações nunca competem pelo mesmo source_local_id.
  const createMutation = useMutation({
    mutationFn: (input: NewProjectInput) => {
      // mapLocalProjectToSupabase só lê os campos de negócio (name, clientName,
      // status, datas, budget, source, FKs) — id/createdAt/progress/isDemo são
      // preenchidos aqui só pra satisfazer o tipo Project, nunca lidos pelo mapper.
      const projectLike: Project = {
        ...input,
        id: "",
        createdAt: "",
        progress: input.progress ?? 0,
        isDemo: false,
      };
      const payload = mapLocalProjectToSupabase(projectLike, readProjectImportMaps());
      return projectsRepository.importProject(workspaceId, buildNativeSourceLocalId(), payload);
    },
    onSuccess: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: ({ projectId, patch }: { projectId: string; patch: Partial<SupabaseProject> }) =>
      projectsRepository.updateProject(workspaceId, projectId, patch),
    onSuccess: invalidate,
  });

  const refetchRef = useRef(query.refetch);
  refetchRef.current = query.refetch;
  const refresh = useCallback(() => {
    refetchRef.current();
  }, []);

  return {
    projects: query.data ?? EMPTY_PROJECTS,
    loading: query.isLoading || query.isFetching,
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,

    createProject: (input: NewProjectInput) => createMutation.mutateAsync(input),
    updateProject: (projectId: string, patch: Partial<SupabaseProject>) =>
      updateMutation.mutateAsync({ projectId, patch }),
  };
}
