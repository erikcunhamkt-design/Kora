import type { ReactNode } from "react";
import { CatalogCloudContext } from "@/hooks/catalogCloudContext";
import { useCatalogSource } from "@/hooks/useCatalogSource";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useSupabaseServiceCategories } from "@/hooks/useSupabaseServiceCategories";
import { useSupabaseServices } from "@/hooks/useSupabaseServices";
import { useSupabaseProducts } from "@/hooks/useSupabaseProducts";
import { useSupabaseCommercialPlans } from "@/hooks/useSupabaseCommercialPlans";

// G94 / CT4 — monta os hooks de NUVEM do catálogo só quando a flag pede "supabase" (ver o cabeçalho de
// `catalogCloudContext.ts`). Fonte local (padrão) ⇒ renderiza só os filhos: nenhum hook de nuvem, nenhum request.
function CloudBridge({ children }: { children: ReactNode }) {
  const { workspace } = useCurrentWorkspace();
  const categories = useSupabaseServiceCategories();
  const services = useSupabaseServices();
  const products = useSupabaseProducts();
  const plans = useSupabaseCommercialPlans();
  return (
    <CatalogCloudContext.Provider value={{ workspaceId: workspace?.id ?? "", categories, services, products, plans }}>
      {children}
    </CatalogCloudContext.Provider>
  );
}

export function CatalogDataProvider({ children }: { children: ReactNode }) {
  const { dataSource } = useCatalogSource();
  if (dataSource !== "supabase") return <>{children}</>;
  return <CloudBridge>{children}</CloudBridge>;
}
