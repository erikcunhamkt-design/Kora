// Repository de Templates WhatsApp
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { normalizeSupabaseError } from "@/lib/supabase/errors";

export type WhatsAppTemplate = Database["public"]["Tables"]["whatsapp_templates"]["Row"];
export type TemplateCategory = "marketing" | "utility" | "authentication" | "service";
export type TemplateStatus = "draft" | "pending" | "approved" | "rejected" | "paused";

export interface TemplateInput {
  name: string;
  internalName?: string | null;
  category: TemplateCategory;
  language?: string;
  body: string;
  variables?: string[];
  sampleValues?: Record<string, string>;
}

export async function listTemplates(workspaceId: string): Promise<WhatsAppTemplate[]> {
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []) as WhatsAppTemplate[];
}

export async function createTemplate(
  workspaceId: string,
  input: TemplateInput,
): Promise<WhatsAppTemplate> {
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      internal_name: input.internalName ?? null,
      category: input.category,
      language: input.language ?? "pt_BR",
      body: input.body,
      variables: (input.variables ?? []) as unknown as Json,
      sample_values: (input.sampleValues ?? {}) as unknown as Json,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw normalizeSupabaseError(error);
  return data as WhatsAppTemplate;
}

export async function updateTemplate(
  workspaceId: string,
  templateId: string,
  patch: Partial<TemplateInput>,
): Promise<WhatsAppTemplate> {
  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) update.name = patch.name;
  if (patch.internalName !== undefined) update.internal_name = patch.internalName;
  if (patch.category !== undefined) update.category = patch.category;
  if (patch.language !== undefined) update.language = patch.language;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.variables !== undefined) update.variables = patch.variables;
  if (patch.sampleValues !== undefined) update.sample_values = patch.sampleValues;

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update(update)
    .eq("workspace_id", workspaceId)
    .eq("id", templateId)
    .select()
    .single();
  if (error) throw normalizeSupabaseError(error);
  return data as WhatsAppTemplate;
}

async function setStatus(
  workspaceId: string,
  templateId: string,
  status: TemplateStatus,
  extra: Record<string, unknown> = {},
): Promise<WhatsAppTemplate> {
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .update({ status, ...extra })
    .eq("workspace_id", workspaceId)
    .eq("id", templateId)
    .select()
    .single();
  if (error) throw normalizeSupabaseError(error);
  return data as WhatsAppTemplate;
}

export const markTemplatePending = (workspaceId: string, templateId: string) =>
  setStatus(workspaceId, templateId, "pending");

export const markTemplateApproved = (
  workspaceId: string,
  templateId: string,
  providerTemplateId?: string,
) =>
  setStatus(workspaceId, templateId, "approved", {
    provider_template_id: providerTemplateId ?? null,
    rejection_reason: null,
  });

export const markTemplateRejected = (
  workspaceId: string,
  templateId: string,
  reason?: string,
) => setStatus(workspaceId, templateId, "rejected", { rejection_reason: reason ?? null });

export const markTemplatePaused = (workspaceId: string, templateId: string) =>
  setStatus(workspaceId, templateId, "paused");

export const markTemplateDraft = (workspaceId: string, templateId: string) =>
  setStatus(workspaceId, templateId, "draft");

export async function deleteTemplate(workspaceId: string, templateId: string): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", templateId);
  if (error) throw normalizeSupabaseError(error);
}

/** Renderiza preview do corpo substituindo {{var}} pelos sample_values. */
export function renderTemplatePreview(
  body: string,
  sampleValues: Record<string, string> | null | undefined,
): string {
  if (!body) return "";
  const sv = sampleValues ?? {};
  return body.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_, key: string) =>
    sv[key] !== undefined ? String(sv[key]) : `{{${key}}}`,
  );
}