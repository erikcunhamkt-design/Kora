// G94 / CT1 — leitura/escrita de serviços do catálogo na nuvem (`services`, draft 6.2).
// Fatia SEM UI e SEM flip: NADA consome este hook ainda. Molde: useSupabaseProjects.ts/useSupabaseTasksAll.ts.
//
//  - [G32] `enabled: !!workspaceId`, nunca condicionado a fonte.
//  - [G30] toda mutation grava a resposta da própria escrita no cache (`setQueryData`).
//  - [G37] criação = payload COMPLETO (`mapLocalServiceToSupabase`); edição = só os campos
//    do patch, cada um com a mesma conversão (`mapServicePatchToSupabase`).
//  - [G56] criação nativa e "duplicar" usam `buildNativeSourceLocalId()` — cada chamada é uma
//    linha nova, nunca um upsert sobre a original.
//  - [G67] `categoryId` aceita o uuid direto (categoria já lida da nuvem) — passthrough.
//  - **Degradação:** tabela ausente ⇒ lista VAZIA + `unavailable: true` + `error` legível; o
//    hook nunca lança no render. As mutations lançam `CatalogUnavailableError` (mensagem legível).
import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseServiceCategories } from "@/hooks/useSupabaseServiceCategories";
import { servicesRepository, type SupabaseService } from "@/repositories/servicesRepository";
import { isCatalogUnavailable } from "@/repositories/catalogRepositoryShared";
import {
  mapLocalServiceToSupabase,
  mapServicePatchToSupabase,
  mapSupabaseServiceToLocal,
} from "@/services/catalog/catalogMapper";
import { getFriendlyMessage } from "@/lib/supabase/errors";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Service } from "@/hooks/useServices";

const EMPTY_ROWS: SupabaseService[] = [];

/** Mesmo shape que `useServices().addService()` já aceita. */
export type NewServiceInput = Omit<Service, "id" | "isDemo">;

export function useSupabaseServices() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["supabase-services", workspaceId], [workspaceId]);
  const { rows: categoryRows } = useSupabaseServiceCategories();

  const query = useQuery({
    queryKey,
    queryFn: () => servicesRepository.listServices(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
    retry: (failureCount, error) => !isCatalogUnavailable(error) && failureCount < 2,
  });

  const rows = query.data ?? EMPTY_ROWS;

  const categoryNameById = useMemo(() => {
    const map: Record<string, string> = {};
    categoryRows.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [categoryRows]);

  const services = useMemo(
    () => rows.map((r) => mapSupabaseServiceToLocal(r, categoryNameById)),
    [rows, categoryNameById],
  );

  const createMutation = useMutation({
    mutationFn: (input: NewServiceInput) =>
      servicesRepository.importService(
        workspaceId,
        buildNativeSourceLocalId(),
        mapLocalServiceToSupabase({ ...input, isDemo: false }),
      ),
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseService[]>(queryKey, (prev) => [
        created,
        ...(prev ?? []).filter((s) => s.id !== created.id),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ serviceId, patch }: { serviceId: string; patch: Partial<Service> }) =>
      servicesRepository.updateService(workspaceId, serviceId, mapServicePatchToSupabase(patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseService[]>(queryKey, (prev) =>
        (prev ?? []).map((s) => (s.id === updated.id ? updated : s)),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (serviceId: string) => servicesRepository.softDeleteService(workspaceId, serviceId),
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseService[]>(queryKey, (prev) =>
        (prev ?? []).filter((s) => s.id !== deleted.id),
      );
    },
  });

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  const findLocal = useCallback(
    (id: string): Service | undefined => services.find((s) => s.id === id),
    [services],
  );

  return {
    rows,
    services,
    loading: query.isLoading,
    /** Tabela ainda não criada no banco — a lista vem vazia e nada quebra. */
    unavailable: isCatalogUnavailable(query.error),
    error: query.error ? getFriendlyMessage(query.error) : null,
    refresh,

    createService: (input: NewServiceInput) => createMutation.mutateAsync(input),
    updateService: (serviceId: string, patch: Partial<Service>) =>
      updateMutation.mutateAsync({ serviceId, patch }),
    /** Exclusão = soft delete (preserva vínculos de orçamento). */
    removeService: (serviceId: string) => removeMutation.mutateAsync(serviceId),
    /** Linha NOVA (`source_local_id` nativo distinto), nome "<nome> (cópia)" — G56. */
    duplicateService: (serviceId: string) => {
      const src = findLocal(serviceId);
      if (!src) return Promise.reject(new Error("Serviço não encontrado para duplicar."));
      const { id: _id, isDemo: _isDemo, ...rest } = src;
      void _id;
      void _isDemo;
      return createMutation.mutateAsync({ ...rest, name: `${src.name} (cópia)` });
    },
    toggleActive: (serviceId: string) => {
      const src = findLocal(serviceId);
      if (!src) return Promise.reject(new Error("Serviço não encontrado."));
      return updateMutation.mutateAsync({ serviceId, patch: { active: !src.active } });
    },
  };
}
