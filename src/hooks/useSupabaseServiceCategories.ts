// G94 / CT1 — leitura/escrita de categorias do catálogo na nuvem (`service_categories`, draft 6.1).
// Fatia SEM UI e SEM flip: NADA consome este hook ainda. Molde: useSupabaseProjects.ts/useSupabaseTasksAll.ts.
//
//  - [G32] `enabled: !!workspaceId` — NUNCA condicionado a fonte de dados; só o hook bifurcado
//    (CT3) decide qual resultado a tela exibe.
//  - [G30] toda mutation grava a resposta da PRÓPRIA escrita no cache (`setQueryData`), nunca
//    só `invalidate` — o cache guarda a linha crua do repositório.
//  - **Degradação:** tabela ausente (DDL ainda não aplicado) ⇒ lista VAZIA + `unavailable: true`
//    + `error` legível; o hook nunca lança no render e a query não faz retry em loop.
import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  serviceCategoriesRepository,
  type SupabaseServiceCategory,
} from "@/repositories/serviceCategoriesRepository";
import { isCatalogUnavailable } from "@/repositories/catalogRepositoryShared";
import {
  mapLocalServiceCategoryToSupabase,
  mapSupabaseServiceCategoryToLocal,
} from "@/services/catalog/catalogMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { ServiceCategory } from "@/hooks/useServiceCategories";

const EMPTY_ROWS: SupabaseServiceCategory[] = [];

/** Mesmo shape que `useServiceCategories().addCategory()` já aceita. */
export type NewServiceCategoryInput = Omit<ServiceCategory, "id" | "isDemo">;

export function useSupabaseServiceCategories() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["supabase-service-categories", workspaceId], [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => serviceCategoriesRepository.listCategories(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
    // tabela ausente não melhora com retry — evita rajada de requests enquanto o DDL não existe
    retry: (failureCount, error) => !isCatalogUnavailable(error) && failureCount < 2,
  });

  const rows = query.data ?? EMPTY_ROWS;
  const categories = useMemo(() => rows.map(mapSupabaseServiceCategoryToLocal), [rows]);

  const createMutation = useMutation({
    mutationFn: (input: NewServiceCategoryInput) =>
      serviceCategoriesRepository.importCategory(
        workspaceId,
        buildNativeSourceLocalId(),
        mapLocalServiceCategoryToSupabase({ ...input, id: "", isDemo: false }),
      ),
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseServiceCategory[]>(queryKey, (prev) => [
        created,
        ...(prev ?? []).filter((c) => c.id !== created.id),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ categoryId, patch }: { categoryId: string; patch: Partial<Omit<ServiceCategory, "id">> }) =>
      serviceCategoriesRepository.updateCategory(workspaceId, categoryId, {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.color !== undefined ? { color: patch.color } : {}),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseServiceCategory[]>(queryKey, (prev) =>
        (prev ?? []).map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (categoryId: string) => serviceCategoriesRepository.softDeleteCategory(workspaceId, categoryId),
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseServiceCategory[]>(queryKey, (prev) =>
        (prev ?? []).filter((c) => c.id !== deleted.id),
      );
    },
  });

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    /** Linhas cruas (o hook de serviços resolve o nome da categoria por aqui). */
    rows,
    categories,
    loading: query.isLoading,
    /** Tabela ainda não criada no banco — a lista vem vazia e nada quebra. */
    unavailable: isCatalogUnavailable(query.error),
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,

    createCategory: (input: NewServiceCategoryInput) => createMutation.mutateAsync(input),
    updateCategory: (categoryId: string, patch: Partial<Omit<ServiceCategory, "id">>) =>
      updateMutation.mutateAsync({ categoryId, patch }),
    removeCategory: (categoryId: string) => removeMutation.mutateAsync(categoryId),
  };
}
