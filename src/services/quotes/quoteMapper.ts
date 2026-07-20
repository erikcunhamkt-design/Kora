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

/**
 * Resolve um id LOCAL para o UUID Supabase via import-map.
 * Regra de segurança (Q4): mapeado → UUID; ausente/não-mapeado → null. NUNCA id local cru.
 */
export function resolveQuoteFk(
  localId: string | number | null | undefined,
  map: Record<string, string>,
): string | null {
  if (localId === null || localId === undefined || localId === "") return null;
  return map[String(localId)] ?? null;
}

/** Orçamento local aceito na migração (inclui `leadId`, usado como id da oportunidade). */
type LocalQuoteForImport = Quote & { leadId?: string | number };

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
  return {
    client_name: quote.clientName,
    client_email: quote.clientEmail,
    title: quote.title,
    description: quote.description,
    // Q5: dinheiro quantizado a centavos antes das colunas numeric.
    subtotal: roundMoney(quote.subtotal),
    discount: roundMoney(quote.discount),
    total: roundMoney(quote.total),
    status: quote.status,
    // created_at / updated_at são geridos por defaults do banco.
    archived: quote.status === "arquivado",
    // Q4: FKs remapeadas para UUID (ou null); NUNCA id local cru em coluna uuid.
    client_id: resolveQuoteFk(quote.clientId, maps.clients),
    opportunity_id: resolveQuoteFk(quote.leadId ?? quote.opportunityId, maps.opportunities),
    // Soft-delete fields ficam undefined para registros novos.
  };
}

/** Convert a SupabaseQuote record back to the local Quote type */
export function mapSupabaseQuoteToLocalQuote(sq: SupabaseQuote): Quote {
  return {
    id: sq.id,
    clientName: sq.client_name ?? "",
    clientEmail: sq.client_email ?? "",
    clientWhatsapp: "",
    title: sq.title,
    description: sq.description ?? "",
    items: [], // items will be fetched separately via listQuoteItems
    subtotal: Number(sq.subtotal),
    discount: Number(sq.discount),
    total: Number(sq.total),
    paymentCondition: "",
    deliveryDeadline: "",
    validityDays: 0,
    status: sq.status as unknown as Quote["status"],
    createdAt: sq.created_at?.slice(0, 10) ?? "",
    isDemo: false,
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
