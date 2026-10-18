// G97 / M0 (docs/architecture/kora-hub-auditoria-e-plano.md; Fase A do G94,
// `etapa-5-flip-catalogo-materiais-fase-a.md` §2.4) — armazenamento LOCAL da
// "Biblioteca do cliente" (`Client.assets`) para a fonte nuvem.
//
// Problema que isto corrige: em fonte nuvem (qualquer sessão com workspace)
// `Clientes.tsx:updateClient` montava o patch por whitelist SEM `assets` e NÃO
// gravava localmente — o item vivia só em memória (`setSelectedClient`) e sumia
// no primeiro refetch/reabertura, enquanto o aviso da mitigação do G75 dizia
// "salvo só neste dispositivo" (falso). Agora o item é gravado aqui, chaveado
// pelo UUID do cliente (mesmo padrão do `accessesLocalStore` da ficha), e
// reaparece ao recarregar NESTE dispositivo — o aviso passa a ser verdadeiro.
//
// É interino: a correção definitiva é a coluna `clients.library_assets`
// (G94, M1–M3); este store será a fonte do import (M3) e depois um fallback.
import type { Client, ClientAsset } from "@/types/domain";

export const CLIENT_LIBRARY_LOCAL_STORE_KEY = "kora.clientLibrary.local.v1";
/** Evento disparado a cada escrita — `useClientsDataSource` reage e recompõe a lista. */
export const CLIENT_LIBRARY_CHANGED_EVENT = "kora:clientLibrary:changed";

const CLIENTS_IMPORT_META_KEY = "kora.clients.supabaseImport.v1";

export type ClientLibraryStore = Record<string, ClientAsset[]>;

export function readClientLibraryStore(): ClientLibraryStore {
  try {
    const raw = localStorage.getItem(CLIENT_LIBRARY_LOCAL_STORE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as ClientLibraryStore;
  } catch {
    // corrompido/indisponível ⇒ como se não houvesse nada
  }
  return {};
}

/** `undefined` = nunca houve entrada pra este cliente (≠ `[]`, o usuário esvaziou a Biblioteca). */
export function readClientLibrary(clientKey: string | number | null | undefined): ClientAsset[] | undefined {
  if (clientKey === null || clientKey === undefined || clientKey === "") return undefined;
  const v = readClientLibraryStore()[String(clientKey)];
  return Array.isArray(v) ? v : undefined;
}

export function writeClientLibrary(clientKey: string | number, assets: ClientAsset[]): void {
  try {
    const store = readClientLibraryStore();
    store[String(clientKey)] = assets;
    localStorage.setItem(CLIENT_LIBRARY_LOCAL_STORE_KEY, JSON.stringify(store));
  } catch {
    // localStorage cheio/indisponível: a edição segue só em memória (não derruba a tela)
  }
  try {
    window.dispatchEvent(new Event(CLIENT_LIBRARY_CHANGED_EVENT));
  } catch {
    // ambiente sem window
  }
}

function readImportedMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLIENTS_IMPORT_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return (parsed?.importedMap as Record<string, string>) || {};
    }
  } catch {
    // sem mapa ⇒ sem fallback legado
  }
  return {};
}

/**
 * Cliente LOCAL legado (id numérico em `orbyt.clients.v1`) cujo uuid mapeado é o do
 * cliente da nuvem — a Biblioteca antiga (gravada quando o app ainda era local-first)
 * vive nele e, sem isto, ficaria invisível em fonte nuvem.
 */
function legacyLocalAssets(localClients: Client[], uuid: string, map: Record<string, string>): ClientAsset[] | undefined {
  const legacy = localClients.find((c) => map[String(c.id)] === uuid);
  return legacy?.assets && legacy.assets.length > 0 ? legacy.assets : undefined;
}

/**
 * Compõe a Biblioteca de um cliente da NUVEM: coluna `library_assets` (se a
 * coluna já existir, G94/M2) → store local (uuid) → cópia local legada → nada.
 * Devolve o cliente SEM `assets` extras quando não há nada a mesclar (referência intacta).
 *
 * G94 · M2 — precedência: se `client.assets` já chegou definido (array, MESMO
 * `[]`) é porque `mapCloudLibraryAssets` leu a coluna da nuvem com sucesso —
 * ela é autoritativa e nunca é sobreposta pelo store M0/legado. Um array
 * vazio da coluna é estado TERMINAL ("esvaziado pelo usuário não
 * ressuscita"), diferente de `undefined` (coluna ausente — schema pendente).
 */
export function withLocalLibrary(
  client: Client,
  store: ClientLibraryStore,
  localClients: Client[],
  importedMap: Record<string, string> = readImportedMap(),
): Client {
  if (Array.isArray(client.assets)) return client;
  const key = String(client.id);
  const fromStore = store[key];
  const assets = Array.isArray(fromStore) ? fromStore : legacyLocalAssets(localClients, key, importedMap);
  return assets && assets.length > 0 ? { ...client, assets } : client;
}
