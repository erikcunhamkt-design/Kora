// Mapper utilities for converting between local Quote types and Supabase representations.
//
// Q4 (Etapa 5 · Fatia 3) — as FKs de saída (client_id / opportunity_id) são resolvidas via
// import-maps local→UUID: mapeado → UUID, ausente/não-mapeado → null. NUNCA o id local cru
// entra numa coluna `uuid` (evita "invalid input syntax for type uuid" — o bug A1 da Fatia 2).
// Q5 — dinheiro quantizado a centavos; quantidade quantizada a 3 casas (Q5b: quote_items.quantity
// é numeric desde 2026-07-19, preserva fração — ver quoteMoney.ts).
import type { Quote, QuoteItem } from "@/hooks/useQuotes";
import type { SupabaseQuote, SupabaseQuoteItem } from "@/repositories/quotesRepository";
import { roundMoney, roundQuantity } from "@/services/quotes/quoteMoney";

/**
 * Import-maps local→Supabase usados para resolver as FKs de um orçamento.
 * Chaves = `String(idLocal)`; valores = UUID do Supabase.
 *   - clients:       `kora.clients.supabaseImport.v1` (idLocal do cliente → uuid)
 *   - opportunities: `kora.crm.supabaseImport.v1`     (idLocal da oportunidade/lead → uuid)
 */
export interface QuoteImportMaps {
  clients: Record<string, string>;
  opportunities: Record<string, string>;
}

export const EMPTY_QUOTE_IMPORT_MAPS: QuoteImportMaps = { clients: {}, opportunities: {} };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map.
 * Regra de segurança (Q4): mapeado → UUID; ausente/não-mapeado → null. NUNCA id local cru.
 *
 * G68 (docs/architecture/kora-hub-auditoria-e-plano.md, `etapa-5-auditoria-g37-espelhos.md`
 * §2) — mesmo molde literal de `resolveProjectFk`/`resolveFinanceFk`/`resolveTaskFk` pós-G37:
 * nem todo `localId` que chega aqui é de fato um id LOCAL precisando de tradução via
 * import-map — se já chegar como um uuid real (ex.: `clientId`/`opportunityId` vindo de um
 * cliente/oportunidade já lidos da nuvem, não de import — mesmo cenário G37 original de
 * `projectsMapper.ts`), passa direto — nunca procura no import-map, que só mapeia id LOCAL
 * → uuid e nunca teria essa entrada.
 */
export function resolveQuoteFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  const key = String(localId);
  if (UUID_RE.test(key)) return key;
  return map[key] ?? null;
}

/** Orçamento local aceito na migração (inclui `leadId`, usado como id da oportunidade). */
type LocalQuoteForImport = Quote & { leadId?: string | number };

// Etapa 5 · Fatia 9 (Q9) — tradução bidirecional do vocabulário de `status`, local
// (português) vs. nuvem (inglês). Achado §8.0 do doc da fatia: o import ANTES desta
// fatia nunca traduzia — gravava o literal PT cru na coluna `status` — então já
// existem linhas reais na nuvem com `status` em português. O mapa nuvem→local
// reconhece os dois vocabulários simultaneamente (passthrough dos 5 literais PT),
// evitando um backfill separado para essas linhas legadas.
export const CLOUD_TO_LOCAL_STATUS: Readonly<Record<string, Quote["status"]>> = {
  draft: "rascunho",
  sent: "enviado",
  approved: "aprovado",
  rejected: "recusado",
  // Passthrough legado (achado §8.0) — já são QuoteStatus local válidos.
  rascunho: "rascunho",
  enviado: "enviado",
  aprovado: "aprovado",
  recusado: "recusado",
  arquivado: "arquivado",
};

const LOCAL_TO_CLOUD_STATUS: Readonly<Record<"rascunho" | "enviado" | "aprovado" | "recusado", string>> = {
  rascunho: "draft",
  enviado: "sent",
  aprovado: "approved",
  recusado: "rejected",
};

/**
 * Traduz o `status` local pro par (status, archived) da nuvem. `"arquivado"` vira
 * `archived: true` + `status: "draft"` (neutro — local não preserva o status
 * anterior ao arquivamento, ver §4.4 do doc da fatia, não é regressão desta
 * função). `"vencido"` nunca deveria chegar aqui — é sempre computado
 * (`effectiveStatus`, `QuotesSection.tsx`), nunca gravado em `Quote.status`; se
 * ocorrer mesmo assim (estado impossível), cai no mesmo neutro de "arquivado"
 * sem o `archived`, por segurança — nunca propaga um literal inválido pro banco.
 */
export function translateLocalStatusToCloud(status: Quote["status"]): { status: string; archived: boolean } {
  if (status === "arquivado") return { status: "draft", archived: true };
  if (status === "vencido") return { status: "draft", archived: false };
  return { status: LOCAL_TO_CLOUD_STATUS[status], archived: false };
}

/**
 * Traduz o par (status, archived) da nuvem pro `status` local. `archived` sempre
 * vence — uma linha arquivada vira `"arquivado"` local independente do `status`
 * bruto por baixo (mesmo espírito de `mapLocalQuoteToSupabaseQuote`, que já grava
 * `archived` a partir do status local hoje). Terceiro caso — `status` que não bate
 * com nenhuma chave conhecida (§9a do doc): cai num fallback seguro (`"rascunho"`)
 * MAS devolve `cloudStatusRaw` com o valor bruto, pra UI nunca esconder o caso.
 */
export function translateCloudStatusToLocal(
  cloudStatus: string | null | undefined,
  archived: boolean,
): { status: Quote["status"]; cloudStatusRaw?: string } {
  if (archived) return { status: "arquivado" };
  const translated = cloudStatus ? CLOUD_TO_LOCAL_STATUS[cloudStatus] : undefined;
  if (translated) return { status: translated };
  return { status: "rascunho", cloudStatusRaw: cloudStatus ?? undefined };
}

/**
 * Payload de import de um orçamento — inclui as FKs resolvidas (UUID ou null).
 * Campos exigidos aqui são exatamente os que mapLocalQuoteToSupabaseQuote sempre
 * atribui (nunca undefined) — compatível estruturalmente com
 * ImportQuoteWithItemsInput (quotesRepository.ts) para a chamada ao RPC (B.3).
 */
export interface SupabaseQuoteImportPayload extends Partial<SupabaseQuote> {
  client_id: string | null;
  opportunity_id: string | null;
  title: string;
  subtotal: number;
  discount: number;
  total: number;
  status: string;
  archived: boolean;
}

/** Convert a local Quote to a shape suitable for Supabase insertion/update. */
export function mapLocalQuoteToSupabaseQuote(
  quote: LocalQuoteForImport,
  maps: QuoteImportMaps = EMPTY_QUOTE_IMPORT_MAPS,
): SupabaseQuoteImportPayload {
  // Q9: status traduzido — antes desta fatia, o literal PT ia cru pra coluna
  // (achado §8.0). archived vem da MESMA tradução agora (single source), não mais
  // de uma comparação separada contra "arquivado".
  const { status, archived } = translateLocalStatusToCloud(quote.status);
  return {
    client_name: quote.clientName,
    client_email: quote.clientEmail,
    // Q8: 6 campos sem coluna antes desta fatia — string vazia vira null, não "".
    client_whatsapp: quote.clientWhatsapp || null,
    company: quote.company || null,
    payment_condition: quote.paymentCondition || null,
    delivery_deadline: quote.deliveryDeadline || null,
    validity_days: quote.validityDays ?? null,
    notes: quote.notes || null,
    title: quote.title,
    description: quote.description,
    // Q5: dinheiro quantizado a centavos antes das colunas numeric.
    subtotal: roundMoney(quote.subtotal),
    discount: roundMoney(quote.discount),
    total: roundMoney(quote.total),
    status,
    // created_at / updated_at são geridos por defaults do banco.
    archived,
    // G68 (docs/architecture/kora-hub-auditoria-e-plano.md, `etapa-5-auditoria-g37-espelhos.md`
    // §1.5) — approved_at/rejected_at têm coluna real (SupabaseQuote) e o campo local é
    // genuinamente populado na transição de status local (useQuotes.ts:226-227) — sem isso,
    // um orçamento já aprovado/recusado localmente perdia o carimbo de tempo ao ser
    // importado/criado nativamente na nuvem (status ia traduzido, a data não).
    approved_at: quote.approvedAt || null,
    rejected_at: quote.rejectedAt || null,
    // Q4: FKs remapeadas para UUID (ou null); NUNCA id local cru em coluna uuid.
    client_id: resolveQuoteFk(quote.clientId, maps.clients),
    opportunity_id: resolveQuoteFk(quote.leadId ?? quote.opportunityId, maps.opportunities),
    // Soft-delete fields ficam undefined para registros novos.
  };
}

/** Convert a SupabaseQuote record back to the local Quote type */
export function mapSupabaseQuoteToLocalQuote(sq: SupabaseQuote): Quote {
  // Q9: archived sempre vence sobre o status bruto; terceiro caso (status
  // desconhecido) devolve cloudStatusRaw em vez de esconder o valor original.
  const { status, cloudStatusRaw } = translateCloudStatusToLocal(sq.status, sq.archived);
  return {
    id: sq.id,
    clientName: sq.client_name ?? "",
    clientEmail: sq.client_email ?? "",
    // Q8: 6 campos sem coluna antes desta fatia — null/ausente vira "" (string)
    // ou 0 (number), mesmo default que o form local já usa pra campo vazio.
    clientWhatsapp: sq.client_whatsapp ?? "",
    title: sq.title,
    description: sq.description ?? "",
    items: [], // items will be fetched separately via listQuoteItems
    subtotal: Number(sq.subtotal),
    discount: Number(sq.discount),
    total: Number(sq.total),
    paymentCondition: sq.payment_condition ?? "",
    deliveryDeadline: sq.delivery_deadline ?? "",
    validityDays: sq.validity_days ?? 0,
    status,
    cloudStatusRaw,
    createdAt: sq.created_at?.slice(0, 10) ?? "",
    isDemo: false,
    company: sq.company ?? undefined,
    notes: sq.notes ?? undefined,
    approvedAt: sq.approved_at ?? undefined,
    rejectedAt: sq.rejected_at ?? undefined,
    // other optional fields left undefined or defaulted
  } as Quote;
}

/** Convert a local QuoteItem to Supabase record */
export function mapLocalQuoteItemToSupabaseItem(
  item: QuoteItem,
): Omit<SupabaseQuoteItem, "id" | "quote_id" | "created_at" | "updated_at"> {
  return {
    service_id: undefined,
    name: item.name,
    // Q5b: quantity é numeric no schema (promovido de integer) — preserva fração, quantizada a 3 casas.
    quantity: roundQuantity(item.quantity),
    unit_price: roundMoney(item.unitPrice),
  };
}

/** Convert a SupabaseQuoteItem back to local QuoteItem */
export function mapSupabaseQuoteItemToLocalItem(si: SupabaseQuoteItem): QuoteItem {
  return {
    id: si.id,
    name: si.name,
    quantity: si.quantity,
    unitPrice: Number(si.unit_price),
  } as QuoteItem;
}
