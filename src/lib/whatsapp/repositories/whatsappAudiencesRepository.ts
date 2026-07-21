// Repository de Audiências WhatsApp.
// Não cria clientes automaticamente. Sempre filtra por workspace.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  normalizeBrazilianPhone,
  validateBrazilianPhone,
} from "@/lib/whatsapp/phone";

export type WhatsAppAudience = Database["public"]["Tables"]["whatsapp_audiences"]["Row"];
export type WhatsAppAudienceContact =
  Database["public"]["Tables"]["whatsapp_audience_contacts"]["Row"];

export interface AudienceInput {
  name: string;
  description?: string | null;
  source?: string | null;
  tags?: string[];
}

export interface RawContactInput {
  name?: string;
  phone: string;
  email?: string;
  company?: string;
  tag?: string;
  origin?: string;
  notes?: string;
  hasOptIn?: boolean;
  optInSource?: string;
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  optOut: number;
  matchedClients: number;
  matchedConversations: number;
}

export async function listAudiences(workspaceId: string): Promise<WhatsAppAudience[]> {
  const { data, error } = await supabase
    .from("whatsapp_audiences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as WhatsAppAudience[];
}

export async function createAudience(
  workspaceId: string,
  input: AudienceInput,
): Promise<WhatsAppAudience> {
  const { data, error } = await supabase
    .from("whatsapp_audiences")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      description: input.description ?? null,
      source: input.source ?? "manual",
      tags: input.tags ?? [],
      status: "draft",
    })
    .select()
    .single();
  if (error) throw normalizeSupabaseError(error);
  return data as WhatsAppAudience;
}

export async function archiveAudience(workspaceId: string, audienceId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_audiences")
    .update({ archived: true, status: "archived" })
    .eq("workspace_id", workspaceId)
    .eq("id", audienceId);
  if (error) throw normalizeSupabaseError(error);
}

export async function deleteAudience(workspaceId: string, audienceId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_audiences")
    .update({ deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", audienceId);
  if (error) throw normalizeSupabaseError(error);
}

export async function listAudienceContacts(
  workspaceId: string,
  audienceId: string,
): Promise<WhatsAppAudienceContact[]> {
  const { data, error } = await supabase
    .from("whatsapp_audience_contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("audience_id", audienceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as WhatsAppAudienceContact[];
}

interface ContactRowToInsert {
  workspace_id: string;
  audience_id: string;
  name: string | null;
  phone: string;
  normalized_phone: string;
  email: string | null;
  company: string | null;
  tag: string | null;
  origin: string | null;
  notes: string | null;
  has_opt_in: boolean;
  opt_in_source: string | null;
  opt_in_at: string | null;
  is_valid: boolean;
  validation_reason: string | null;
  is_duplicate: boolean;
  matched_client_id: string | null;
  matched_conversation_id: string | null;
  opt_out: boolean;
}

/**
 * Importa contatos para uma audiência. Cruzamento com clientes e conversas.
 * Não cria clientes nem conversas. Sempre marca opt_out se número estiver na lista.
 */
export async function importAudienceContacts(
  workspaceId: string,
  audienceId: string,
  contacts: RawContactInput[],
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    total: contacts.length,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    optOut: 0,
    matchedClients: 0,
    matchedConversations: 0,
  };
  if (contacts.length === 0) return summary;

  // 1. normaliza + valida
  const normalized = contacts.map((c) => {
    const norm = normalizeBrazilianPhone(c.phone);
    const v = validateBrazilianPhone(c.phone);
    return { raw: c, normalized: norm, valid: v.valid, reason: v.reason };
  });

  // 2. detecta duplicados (mesmo normalized_phone dentro do lote)
  const seen = new Map<string, number>();
  const dupFlags = normalized.map(({ normalized: n }) => {
    const count = seen.get(n) ?? 0;
    seen.set(n, count + 1);
    return count > 0;
  });

  // 3. cruzamento por telefone com clients + whatsapp_conversations + opt_outs
  const phones = Array.from(new Set(normalized.map((n) => n.normalized).filter(Boolean)));

  let optOutSet = new Set<string>();
  const clientByPhone = new Map<string, string>();
  const convoByPhone = new Map<string, string>();

  if (phones.length > 0) {
    const [optOutRes, clientsRes, convosRes] = await Promise.all([
      supabase
        .from("whatsapp_opt_outs")
        .select("normalized_phone")
        .eq("workspace_id", workspaceId)
        .in("normalized_phone", phones),
      supabase
        .from("clients")
        .select("id, whatsapp, phone")
        .eq("workspace_id", workspaceId),
      supabase
        .from("whatsapp_conversations")
        .select("id, contact_phone")
        .eq("workspace_id", workspaceId)
        .in("contact_phone", phones),
    ]);

    if (optOutRes.data) {
      optOutSet = new Set(optOutRes.data.map((r) => r.normalized_phone));
    }
    if (clientsRes.data) {
      for (const c of clientsRes.data) {
        const candidates = [c.whatsapp, c.phone]
          .filter((v): v is string => Boolean(v))
          .map(normalizeBrazilianPhone);
        for (const p of candidates) {
          if (p && phones.includes(p) && !clientByPhone.has(p)) {
            clientByPhone.set(p, c.id);
          }
        }
      }
    }
    if (convosRes.data) {
      for (const c of convosRes.data) {
        const p = normalizeBrazilianPhone(c.contact_phone);
        if (p) convoByPhone.set(p, c.id);
      }
    }
  }

  // 4. monta rows
  const rows: ContactRowToInsert[] = normalized.map((n, idx) => {
    const isDup = dupFlags[idx];
    const isOptOut = optOutSet.has(n.normalized);
    const matchedClient = clientByPhone.get(n.normalized) ?? null;
    const matchedConvo = convoByPhone.get(n.normalized) ?? null;

    if (n.valid && !isDup) summary.valid += 1;
    if (!n.valid) summary.invalid += 1;
    if (isDup) summary.duplicates += 1;
    if (isOptOut) summary.optOut += 1;
    if (matchedClient) summary.matchedClients += 1;
    if (matchedConvo) summary.matchedConversations += 1;

    return {
      workspace_id: workspaceId,
      audience_id: audienceId,
      name: n.raw.name?.trim() || null,
      phone: n.raw.phone,
      normalized_phone: n.normalized,
      email: n.raw.email?.trim() || null,
      company: n.raw.company?.trim() || null,
      tag: n.raw.tag?.trim() || null,
      origin: n.raw.origin?.trim() || null,
      notes: n.raw.notes?.trim() || null,
      has_opt_in: Boolean(n.raw.hasOptIn),
      opt_in_source: n.raw.optInSource ?? null,
      opt_in_at: n.raw.hasOptIn ? new Date().toISOString() : null,
      is_valid: n.valid,
      validation_reason: n.reason ?? null,
      is_duplicate: isDup,
      matched_client_id: matchedClient,
      matched_conversation_id: matchedConvo,
      opt_out: isOptOut,
    };
  });

  // 5. insert em batches de 500
  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error } = await supabase.from("whatsapp_audience_contacts").insert(slice);
    if (error) throw normalizeSupabaseError(error);
  }

  // 6. atualiza contadores na audiência
  await supabase
    .from("whatsapp_audiences")
    .update({
      total_contacts: summary.total,
      valid_contacts: summary.valid,
      invalid_contacts: summary.invalid,
      duplicate_contacts: summary.duplicates,
      status: summary.invalid + summary.duplicates > 0 ? "needs_review" : "clean",
    })
    .eq("workspace_id", workspaceId)
    .eq("id", audienceId);

  return summary;
}

/** Remove (soft) contatos por filtro. */
export async function removeAudienceContacts(
  workspaceId: string,
  audienceId: string,
  filter: { invalid?: boolean; duplicate?: boolean; optOut?: boolean },
): Promise<number> {
  let q = supabase
    .from("whatsapp_audience_contacts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("audience_id", audienceId)
    .is("deleted_at", null);

  if (filter.invalid) q = q.eq("is_valid", false);
  if (filter.duplicate) q = q.eq("is_duplicate", true);
  if (filter.optOut) q = q.eq("opt_out", true);

  const { data, error } = await q.select("id");
  if (error) throw normalizeSupabaseError(error);
  return data?.length ?? 0;
}
