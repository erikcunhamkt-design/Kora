// G94 · M1 (Fase A do catálogo/materiais, docs/architecture/
// etapa-5-flip-catalogo-materiais-fase-a.md §6.8/§7) — mapper da Biblioteca
// do cliente na nuvem (`clients.library_assets`, coluna AINDA NÃO aplicada
// pelo operador — draft 6.8, ver relatório LANE E do pacote §8-b-catálogo).
//
// Leitura: `SELECT *` nunca falha por coluna ausente — o PostgREST só omite
// a chave da linha em silêncio. Por isso a degradação de LEITURA não é um
// erro a capturar, é a própria ausência da chave: `undefined` = coluna
// ausente (schema pendente, cai no fallback do store M0 em
// clientLibraryLocalStore.ts); `[]` = coluna existe, Biblioteca vazia na
// nuvem (estado terminal — "esvaziado pelo usuário não ressuscita" o
// fallback, ver withLocalLibrary). A degradação de ESCRITA (tentar GRAVAR
// numa coluna ausente) é um erro real do Postgres/PostgREST — ver
// clientLibraryRepositoryShared.ts.
//
// Vocabulário: `ClientAssetType`/`ClientAssetAccessStatus` já são os mesmos
// literais nos 2 lados (local e nuvem) — JSONB preserva o shape 1:1, sem
// tradução (G83: round-trip lossless). Validação na leitura é defensiva
// (contra dado gravado por fora/corrompido), não uma tradução de vocabulário.
import type { ClientAsset } from "@/types/domain";

/** Contrato §7: descarta entrada sem `id`/`title`/`url` (os 3 campos mínimos pra um item utilizável). */
function isValidLibraryAsset(v: unknown): v is ClientAsset {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    typeof a.id === "string" && a.id.length > 0 &&
    typeof a.title === "string" && a.title.length > 0 &&
    typeof a.url === "string" && a.url.length > 0
  );
}

/**
 * `undefined` = coluna ausente da linha (schema pendente) OU valor corrompido
 * (não-array) — tratado como "nada a mostrar da nuvem", cai no fallback.
 * `[]` = coluna existe, Biblioteca vazia na nuvem — terminal, não é
 * equivalente a "ausente".
 */
export function mapCloudLibraryAssets(raw: unknown): ClientAsset[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) return undefined;
  return raw.filter(isValidLibraryAsset);
}

/** R8 (doc Fase A): CHECK do draft 6.8 aceita até 200 itens — validado aqui também, client-side, antes de gravar. */
export const CLIENT_LIBRARY_MAX_ITEMS = 200;

export function exceedsLibraryLimit(assets: ClientAsset[]): boolean {
  return assets.length > CLIENT_LIBRARY_MAX_ITEMS;
}

/** Escrita: passthrough — JSONB preserva o shape 1:1 (G83), nenhuma tradução de campo. */
export function mapLocalLibraryAssetsToCloud(assets: ClientAsset[]): ClientAsset[] {
  return assets;
}
