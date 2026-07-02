// Mapper utilities for converting between local Quote types and Supabase representations
import type { Quote, QuoteItem } from "@/hooks/useQuotes";
import type { SupabaseQuote, SupabaseQuoteItem } from "@/repositories/quotesRepository";

/** Convert a local Quote to a shape suitable for Supabase insertion/update */
export function mapLocalQuoteToSupabaseQuote(quote: Quote): Partial<SupabaseQuote> {
  return {
    client_name: quote.clientName,
    client_email: quote.clientEmail,
    title: quote.title,
    description: quote.description,
    subtotal: quote.subtotal,
    discount: quote.discount,
    total: quote.total,
    status: quote.status,
    // fields like created_at, updated_at, archived are managed by DB defaults
    archived: quote.status === "arquivado",
    // Soft‑delete fields are left undefined for new records
  } as Partial<SupabaseQuote>;
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
export function mapLocalQuoteItemToSupabaseItem(item: QuoteItem): Omit<SupabaseQuoteItem, "id" | "quote_id" | "created_at" | "updated_at"> {
  return {
    service_id: undefined,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unitPrice,
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
