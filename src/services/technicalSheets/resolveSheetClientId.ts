// G82 (docs/architecture/kora-hub-auditoria-e-plano.md) — resolução única
// cliente → uuid Supabase da Ficha Técnica. Antes, 3 pontos
// (`useSupabaseTechnicalSheet`, `BrandingSection`, `AssetsSection`) liam o
// mapa legado `kora.clients.supabaseImport.v1` (idLocal → uuid) direto: com a
// lista de Clientes em nuvem (ids = uuid, desde o G58), a chave uuid nunca
// casava e a ficha ficava sem vínculo.
//
// Mesmo padrão de `resolveProjectFk`/`resolveTaskFk` (G37): se o id JÁ é um
// uuid, passa direto — não é um id local a traduzir, já é o destino. O mapa
// local→uuid só vale pro id numérico local (modo local/legado).
import type { Client } from "@/types/domain";

const CLIENTS_IMPORT_META_KEY = "kora.clients.supabaseImport.v1";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lê o mapa idLocal → uuid de Clientes. Nunca lança (localStorage ausente/corrompido ⇒ `{}`). */
export function readClientsImportMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(CLIENTS_IMPORT_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return (parsed?.importedMap as Record<string, string>) || {};
    }
  } catch {
    // ignora — sem mapa, só o passthrough de uuid resolve
  }
  return {};
}

/**
 * uuid direto → ele mesmo; id local mapeado → uuid; senão `null`. NUNCA devolve
 * um id local cru (mesma regra de segurança do `resolveProjectFk`).
 */
export function resolveSheetSupabaseClientId(
  clientId: string | number | null | undefined,
  map: Record<string, string> = readClientsImportMap(),
): string | null {
  if (clientId === null || clientId === undefined || clientId === "") return null;
  const key = String(clientId);
  if (UUID_RE.test(key)) return key;
  return map[key] || null;
}

/**
 * Cliente LOCAL (`orbyt.clients.v1`) que corresponde ao id da ficha: id igual
 * (modo local) ou cujo uuid mapeado é o id recebido (cliente legado importado,
 * aberto pela lista em nuvem). `undefined` ⇒ o cliente só existe na nuvem —
 * não há onde gravar a ficha localmente.
 */
export function findLocalClientForSheet(
  localClients: Client[],
  clientId: string | number | null | undefined,
  map: Record<string, string> = readClientsImportMap(),
): Client | undefined {
  if (clientId === null || clientId === undefined || clientId === "") return undefined;
  const key = String(clientId);
  return localClients.find((c) => String(c.id) === key || map[String(c.id)] === key);
}
