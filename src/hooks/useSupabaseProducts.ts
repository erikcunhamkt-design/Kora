// G94 / CT2 — leitura/escrita de produtos do catálogo na nuvem (`products`, draft 6.3).
// Sem UI, sem flip: NADA consome este hook ainda. Mesmo molde de useSupabaseServices.ts (CT1):
//  - [G32] `enabled: !!workspaceId`, nunca condicionado a fonte.
//  - [G30] toda mutation grava a resposta da própria escrita no cache (`setQueryData`).
//  - [G37] criação = payload COMPLETO; edição = só os campos do patch.
//  - [G56] criação nativa usa `buildNativeSourceLocalId()` (linha nova sempre).
//  - **Degradação:** tabela ausente ⇒ lista VAZIA + `unavailable: true` + `error` legível; nunca lança no render.
import { useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { productsRepository, type SupabaseProduct } from "@/repositories/productsRepository";
import { catalogErrorMessage, isCatalogUnavailable } from "@/repositories/catalogRepositoryShared";
import {
  mapLocalProductToSupabase,
  mapProductPatchToSupabase,
  mapSupabaseProductToLocal,
} from "@/services/catalog/catalogProductPlanMapper";
import { buildNativeSourceLocalId } from "@/lib/installId";
import type { Product } from "@/hooks/useProducts";

const EMPTY_ROWS: SupabaseProduct[] = [];

/** Mesmo shape que `useProducts().addProduct()` já aceita. */
export type NewProductInput = Omit<Product, "id" | "isDemo" | "createdAt" | "updatedAt">;

export function useSupabaseProducts() {
  const { workspace } = useCurrentWorkspace();
  const workspaceId = workspace?.id ?? "";
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["supabase-products", workspaceId], [workspaceId]);

  const query = useQuery({
    queryKey,
    queryFn: () => productsRepository.listProducts(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30_000,
    retry: (failureCount, error) => !isCatalogUnavailable(error) && failureCount < 2,
  });

  const rows = query.data ?? EMPTY_ROWS;
  const products = useMemo(() => rows.map(mapSupabaseProductToLocal), [rows]);

  const createMutation = useMutation({
    mutationFn: (input: NewProductInput) =>
      productsRepository.importProduct(
        workspaceId,
        buildNativeSourceLocalId(),
        mapLocalProductToSupabase({ ...input, isDemo: false }),
      ),
    onSuccess: (created) => {
      queryClient.setQueryData<SupabaseProduct[]>(queryKey, (prev) => [
        created,
        ...(prev ?? []).filter((p) => p.id !== created.id),
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ productId, patch }: { productId: string; patch: Partial<Product> }) =>
      productsRepository.updateProduct(workspaceId, productId, mapProductPatchToSupabase(patch)),
    onSuccess: (updated) => {
      queryClient.setQueryData<SupabaseProduct[]>(queryKey, (prev) =>
        (prev ?? []).map((p) => (p.id === updated.id ? updated : p)),
      );
    },
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => productsRepository.softDeleteProduct(workspaceId, productId),
    onSuccess: (deleted) => {
      queryClient.setQueryData<SupabaseProduct[]>(queryKey, (prev) =>
        (prev ?? []).filter((p) => p.id !== deleted.id),
      );
    },
  });

  const refresh = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    rows,
    products,
    loading: query.isLoading,
    /** Tabela ainda não criada no banco — a lista vem vazia e nada quebra. */
    unavailable: isCatalogUnavailable(query.error),
    error: query.error ? catalogErrorMessage(query.error) : null,
    refresh,

    createProduct: (input: NewProductInput) => createMutation.mutateAsync(input),
    updateProduct: (productId: string, patch: Partial<Product>) =>
      updateMutation.mutateAsync({ productId, patch }),
    removeProduct: (productId: string) => removeMutation.mutateAsync(productId),
  };
}
