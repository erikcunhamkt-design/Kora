import { useMemo, type ReactNode } from "react";
import { CatalogCloudContext, type CatalogCloudState } from "@/hooks/catalogCloudContext";
import { useBifurcatedQuotes } from "@/hooks/useBifurcatedQuotes";
import { useCatalogSource } from "@/hooks/useCatalogSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseServiceCategories } from "@/hooks/useSupabaseServiceCategories";
import { useSupabaseServices } from "@/hooks/useSupabaseServices";
import { useSupabaseProducts } from "@/hooks/useSupabaseProducts";
import { useSupabaseCommercialPlans } from "@/hooks/useSupabaseCommercialPlans";

// G94 / CT4 — monta os hooks de NUVEM do catálogo só quando a flag pede "supabase" (ver o cabeçalho de
// `catalogCloudContext.ts`). Fonte local (padrão) ⇒ renderiza só os filhos: nenhum hook de nuvem, nenhum request.
function useCloudCatalogState(): CatalogCloudState {
  const { workspace } = useCurrentWorkspace();
  const categories = useSupabaseServiceCategories();
  const services = useSupabaseServices();
  const products = useSupabaseProducts();
  const plans = useSupabaseCommercialPlans();
  return { workspaceId: workspace?.id ?? "", categories, services, products, plans };
}

function CloudBridge({ children }: { children: ReactNode }) {
  const state = useCloudCatalogState();
  return <CatalogCloudContext.Provider value={state}>{children}</CatalogCloudContext.Provider>;
}

// G98/CT5 — a tela de Catálogo também precisa dos ORÇAMENTOS (pela fonte de orçamentos) pra "Mais usado em
// orçamentos". Só aqui: o wizard de orçamento usa o provider sem isso (já tem os orçamentos em mãos).
function CloudBridgeWithQuotes({ children }: { children: ReactNode }) {
  const state = useCloudCatalogState();
  const quotes = useBifurcatedQuotes();
  const value = useMemo(() => ({ ...state, quotes }), [state, quotes]);
  return <CatalogCloudContext.Provider value={value}>{children}</CatalogCloudContext.Provider>;
}

export function CatalogDataProvider({ children, withQuotes = false }: { children: ReactNode; withQuotes?: boolean }) {
  const { dataSource } = useCatalogSource();
  if (dataSource !== "supabase") return <>{children}</>;
  return withQuotes ? <CloudBridgeWithQuotes>{children}</CloudBridgeWithQuotes> : <CloudBridge>{children}</CloudBridge>;
}
