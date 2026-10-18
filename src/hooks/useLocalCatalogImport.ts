// G94 / CT3 — import assistido do catálogo local → nuvem (categorias → serviços → produtos → planos).
// Molde: useLocalTasksImport.ts (analisa, lista "novas"/"já importadas", seleção, importa; a meta só
// avança APÓS sucesso de cada item). A lógica pura (candidatos, dependências, ordem) está em
// `services/catalog/catalogImport.ts`.
//
// **Schema pendente (G29):** antes de liberar o import, `analyze()` sonda as 4 tabelas. Se alguma não
// existir (DDL do operador, pacote §8-b, ainda não aplicado) o hook devolve `schemaPending` com a lista
// das tabelas ausentes e `importSelected` RECUSA importar — o card avisa em vez de prometer.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServices } from "@/hooks/useServices";
import { useProducts } from "@/hooks/useProducts";
import { useServiceCategories } from "@/hooks/useServiceCategories";
import { useCommercialPlans } from "@/hooks/useCommercialPlans";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { serviceCategoriesRepository } from "@/repositories/serviceCategoriesRepository";
import { servicesRepository } from "@/repositories/servicesRepository";
import { productsRepository } from "@/repositories/productsRepository";
import { commercialPlansRepository } from "@/repositories/commercialPlansRepository";
import { isCatalogUnavailable } from "@/repositories/catalogRepositoryShared";
import {
  buildCatalogCandidates,
  emptyCatalogImportReport,
  executeCatalogImport,
  readCatalogImportMeta,
  writeCatalogImportMeta,
  type CatalogCandidate,
  type CatalogImportReport,
  type CatalogImportRepos,
} from "@/services/catalog/catalogImport";
import { getInstallId } from "@/lib/installId";
import { getFriendlyMessage } from "@/lib/supabase/errors";

export interface SchemaPending {
  /** Nomes das tabelas ausentes no banco. */
  tables: string[];
}

const realRepos: CatalogImportRepos = {
  importCategory: (ws, src, input) => serviceCategoriesRepository.importCategory(ws, src, input),
  importService: (ws, src, input) => servicesRepository.importService(ws, src, input),
  importProduct: (ws, src, input) => productsRepository.importProduct(ws, src, input),
  importPlan: (ws, src, input) => commercialPlansRepository.importPlan(ws, src, input),
};

export function useLocalCatalogImport() {
  const { workspace } = useCurrentWorkspace();
  const { categories } = useServiceCategories();
  const { services } = useServices();
  const { products } = useProducts();
  const { plans } = useCommercialPlans();

  const [candidates, setCandidates] = useState<CatalogCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaPending, setSchemaPending] = useState<SchemaPending | null>(null);
  const [report, setReport] = useState<CatalogImportReport | null>(null);

  const data = useMemo(() => ({ categories, services, products, plans }), [categories, services, products, plans]);

  const analyze = useCallback(async () => {
    setError(null);
    if (!workspace) {
      setError("Nenhum workspace ativo encontrado.");
      setCandidates([]);
      return;
    }
    setLoading(true);
    try {
      // Sonda das 4 tabelas (as listagens também comprovam leitura/RLS). Só "tabela ausente" gera
      // schemaPending; qualquer outro erro vira mensagem de erro (e também bloqueia por segurança).
      const probes: Array<[string, Promise<unknown>]> = [
        ["service_categories", serviceCategoriesRepository.listCategories(workspace.id)],
        ["services", servicesRepository.listServices(workspace.id)],
        ["products", productsRepository.listProducts(workspace.id)],
        ["commercial_plans", commercialPlansRepository.listPlans(workspace.id)],
      ];
      const settled = await Promise.allSettled(probes.map(([, p]) => p));
      const missing: string[] = [];
      let otherError: unknown = null;
      settled.forEach((r, i) => {
        if (r.status === "rejected") {
          if (isCatalogUnavailable(r.reason)) missing.push(probes[i][0]);
          else otherError = r.reason;
        }
      });
      if (missing.length > 0) setSchemaPending({ tables: missing });
      else setSchemaPending(null);
      if (otherError) setError(getFriendlyMessage(otherError));

      setCandidates(buildCatalogCandidates(data, readCatalogImportMeta().maps));
    } finally {
      setLoading(false);
    }
  }, [workspace, data]);

  const importSelected = useCallback(
    async (selection: string[]): Promise<CatalogImportReport> => {
      if (!workspace) {
        setError("Nenhum workspace ativo encontrado.");
        return emptyCatalogImportReport();
      }
      if (schemaPending) {
        // G29: nunca fingir import com a estrutura do banco ausente.
        return emptyCatalogImportReport();
      }
      setLoading(true);
      try {
        const meta = readCatalogImportMeta();
        const { report: result } = await executeCatalogImport({
          workspaceId: workspace.id,
          installId: getInstallId(),
          data,
          maps: meta.maps,
          selection: new Set(selection),
          repos: realRepos,
          // meta só é gravada APÓS o sucesso de cada item — reexecução após falha parcial é segura
          onMapped: (_kind, _localId, _uuid, maps) => {
            writeCatalogImportMeta({ lastImportedAt: new Date().toISOString(), maps });
          },
        });
        setReport(result);
        return result;
      } finally {
        setLoading(false);
        void analyze();
      }
    },
    [workspace, schemaPending, data, analyze],
  );

  // Candidatos (100% locais, sem rede) acompanham o catálogo local; a SONDA do banco só roda em
  // `analyze()` — o card a chama ao abrir o diálogo (não dispara 4 requests só por montar Configurações).
  useEffect(() => {
    setCandidates(buildCatalogCandidates(data, readCatalogImportMeta().maps));
  }, [data]);

  return { candidates, loading, error, schemaPending, report, analyze, importSelected };
}
