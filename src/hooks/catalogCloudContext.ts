// G94 / CT4 — estado do catálogo na NUVEM entregue por contexto, e a resolução do MODO efetivo.
//
// Por que contexto (e não 4 hooks nativos dentro de cada hook bifurcado, como `useBifurcatedTasks`):
//  - cada `useSupabase*` instancia `useCurrentWorkspace` (fetch próprio) e as telas montam vários hooks do
//    catálogo — multiplicaria os fetches de workspace e as queries por tela;
//  - o catálogo é UM domínio com UMA flag: a nuvem só entra no React quando `kora.catalog.dataSource.v1 ===
//    "supabase"` (`CatalogDataProvider`, montado pela tela de Catálogo). No modo LOCAL (padrão) nenhum hook de
//    nuvem existe: zero request, zero dependência de QueryClient/workspace — regressão local por construção.
//  - hook bifurcado fora do provider ⇒ LOCAL (seguro). A nuvem nunca "aparece" sem o provider.
//
// Modo efetivo (`source`): "supabase" só se a flag pede nuvem E há provider E há workspace E nenhuma das 4
// tabelas está ausente. Tabela ausente (`CatalogUnavailableError`) ⇒ cai no LOCAL com `unavailable`/`tables`
// preenchidos (a tela avisa "schema pendente"). Outros erros (RLS, rede) NÃO derrubam pro local — ficam em
// `error` (a tela mostra; cair no local esconderia o problema e deixaria o usuário editar o catálogo errado).
import { createContext, useContext } from "react";
import type { DataSource } from "@/config/flags";
import { useCatalogSource } from "@/hooks/useCatalogSource";
import type { useSupabaseServiceCategories } from "@/hooks/useSupabaseServiceCategories";
import type { useSupabaseServices } from "@/hooks/useSupabaseServices";
import type { useSupabaseProducts } from "@/hooks/useSupabaseProducts";
import type { useSupabaseCommercialPlans } from "@/hooks/useSupabaseCommercialPlans";
import type { Quote } from "@/hooks/useQuotes";

export interface CatalogCloudState {
  workspaceId: string;
  categories: ReturnType<typeof useSupabaseServiceCategories>;
  services: ReturnType<typeof useSupabaseServices>;
  products: ReturnType<typeof useSupabaseProducts>;
  plans: ReturnType<typeof useSupabaseCommercialPlans>;
  /**
   * Orçamentos pela fonte de ORÇAMENTOS (`useBifurcatedQuotes`) — só existe quando o provider é montado com
   * `withQuotes` (a tela de Catálogo, p/ "Mais usado em orçamentos"; G98/CT5). O wizard de orçamento não precisa.
   */
  quotes?: Quote[];
}

export const CatalogCloudContext = createContext<CatalogCloudState | null>(null);

export function useCatalogCloud(): CatalogCloudState | null {
  return useContext(CatalogCloudContext);
}

export interface CatalogModeInfo {
  /** O que o usuário PEDIU (flag). */
  requested: DataSource;
  /** De onde a tela está LENDO/ESCREVENDO de fato. */
  source: DataSource;
  writeEnabled: boolean;
  /** Nuvem efetiva + escrita ligada ⇒ mutators gravam na nuvem. */
  cloudWrite: boolean;
  /** Nuvem efetiva + escrita desligada ⇒ gravação BLOQUEADA com aviso (G76). */
  writeBlocked: boolean;
  /** Pediu nuvem mas alguma tabela do catálogo não existe (pacote §8-b não aplicado). */
  unavailable: boolean;
  /** Tabelas ausentes. */
  tables: string[];
  /** Pediu nuvem mas não há workspace ativo. */
  noWorkspace: boolean;
  /** Nuvem efetiva e alguma lista ainda carregando. */
  loading: boolean;
  /** Erro legível que NÃO é "tabela ausente" (RLS, rede…). */
  error: string | null;
  /** Reconsulta as 4 listas (ex.: depois de aplicar o pacote §8-b). */
  retry: () => void;
}

const NOOP = () => {};

export function resolveCatalogMode(
  requested: DataSource,
  cloud: CatalogCloudState | null,
  writeEnabled: boolean,
): CatalogModeInfo {
  if (requested !== "supabase" || !cloud) {
    return {
      requested, source: "local", writeEnabled, cloudWrite: false, writeBlocked: false,
      unavailable: false, tables: [], noWorkspace: false, loading: false, error: null, retry: NOOP,
    };
  }

  const parts: Array<[string, { unavailable: boolean; loading: boolean; error: string | null; refresh: () => void }]> = [
    ["service_categories", cloud.categories],
    ["services", cloud.services],
    ["products", cloud.products],
    ["commercial_plans", cloud.plans],
  ];
  const tables = parts.filter(([, p]) => p.unavailable).map(([name]) => name);
  const unavailable = tables.length > 0;
  const noWorkspace = !cloud.workspaceId;
  const source: DataSource = unavailable || noWorkspace ? "local" : "supabase";
  const error = parts.find(([, p]) => !p.unavailable && p.error)?.[1].error ?? null;

  return {
    requested,
    source,
    writeEnabled,
    cloudWrite: source === "supabase" && writeEnabled,
    writeBlocked: source === "supabase" && !writeEnabled,
    unavailable,
    tables,
    noWorkspace,
    loading: source === "supabase" && parts.some(([, p]) => p.loading),
    error: source === "supabase" ? error : null,
    retry: () => parts.forEach(([, p]) => p.refresh()),
  };
}

export function useCatalogMode(): CatalogModeInfo {
  const { dataSource, writeEnabled } = useCatalogSource();
  const cloud = useCatalogCloud();
  return resolveCatalogMode(dataSource, cloud, writeEnabled);
}
