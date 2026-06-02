// Repository de Campanhas WhatsApp V2.
// Esta fase: cria campanha + recipients. Envio real desabilitado.
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type WhatsAppCampaignV2 =
  Database["public"]["Tables"]["whatsapp_campaigns_v2"]["Row"];
export type WhatsAppCampaignRecipient =
  Database["public"]["Tables"]["whatsapp_campaign_recipients"]["Row"];

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface CampaignInput {
  name: string;
  objective?: string | null;
  audienceId: string;
  templateId: string;
  mode?: "template_campaign" | "active_window_freeform";
  scheduledAt?: string | null;
}

export async function listCampaigns(workspaceId: string): Promise<WhatsAppCampaignV2[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaigns_v2")
    .select("*")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as WhatsAppCampaignV2[];
}

export async function createCampaign(
  workspaceId: string,
  input: CampaignInput,
): Promise<WhatsAppCampaignV2> {
  // Valida modelo de mensagem (ativo/rascunho, não arquivado, com corpo).
  const { data: tpl, error: tplErr } = await supabase
    .from("whatsapp_templates")
    .select("id, status, body, deleted_at")
    .eq("workspace_id", workspaceId)
    .eq("id", input.templateId)
    .single();
  if (tplErr) throw tplErr;
  if (tpl.deleted_at) {
    throw new Error("Selecione um modelo de mensagem ativo para continuar.");
  }
  if (tpl.status === "paused") {
    throw new Error("Este modelo está arquivado. Selecione um modelo ativo.");
  }
  if (!tpl.body || !String(tpl.body).trim()) {
    throw new Error("O modelo selecionado está vazio. Edite o conteúdo antes de usar.");
  }

  const { data, error } = await supabase
    .from("whatsapp_campaigns_v2")
    .insert({
      workspace_id: workspaceId,
      name: input.name,
      objective: input.objective ?? null,
      audience_id: input.audienceId,
      template_id: input.templateId,
      mode: input.mode ?? "template_campaign",
      status: input.scheduledAt ? "scheduled" : "draft",
      scheduled_at: input.scheduledAt ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as WhatsAppCampaignV2;
}

/**
 * Materializa recipients a partir da audiência aplicando regras de skip:
 * - opt_out → skipped
 * - is_valid=false → skipped
 * - is_duplicate=true → skipped
 * - blocked=true → skipped
 */
export async function prepareCampaignRecipients(
  workspaceId: string,
  campaignId: string,
  audienceId: string,
): Promise<{ total: number; valid: number; skipped: number }> {
  const { data: contacts, error } = await supabase
    .from("whatsapp_audience_contacts")
    .select(
      "id, phone, normalized_phone, name, is_valid, is_duplicate, opt_out, blocked",
    )
    .eq("workspace_id", workspaceId)
    .eq("audience_id", audienceId)
    .is("deleted_at", null);
  if (error) throw error;

  const rows = (contacts ?? []).map((c) => {
    let status: string = "pending";
    let skipReason: string | null = null;
    if (c.opt_out) {
      status = "skipped";
      skipReason = "opt_out";
    } else if (c.blocked) {
      status = "skipped";
      skipReason = "blocked";
    } else if (!c.is_valid) {
      status = "skipped";
      skipReason = "invalid_phone";
    } else if (c.is_duplicate) {
      status = "skipped";
      skipReason = "duplicate";
    }
    return {
      workspace_id: workspaceId,
      campaign_id: campaignId,
      audience_contact_id: c.id,
      phone: c.phone,
      normalized_phone: c.normalized_phone,
      name: c.name,
      status,
      skip_reason: skipReason,
    };
  });

  const valid = rows.filter((r) => r.status === "pending").length;
  const skipped = rows.length - valid;

  for (let i = 0; i < rows.length; i += 500) {
    const slice = rows.slice(i, i + 500);
    const { error: insErr } = await supabase
      .from("whatsapp_campaign_recipients")
      .insert(slice);
    if (insErr) throw insErr;
  }

  await supabase
    .from("whatsapp_campaigns_v2")
    .update({ total_recipients: rows.length, valid_recipients: valid })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId);

  return { total: rows.length, valid, skipped };
}

export async function listCampaignRecipients(
  workspaceId: string,
  campaignId: string,
): Promise<WhatsAppCampaignRecipient[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaign_recipients")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as WhatsAppCampaignRecipient[];
}

export async function updateCampaignStatus(
  workspaceId: string,
  campaignId: string,
  status: CampaignStatus,
): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns_v2")
    .update({ status })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId);
  if (error) throw error;
}

export async function deleteCampaign(
  workspaceId: string,
  campaignId: string,
): Promise<void> {
  const { error } = await supabase
    .from("whatsapp_campaigns_v2")
    .update({ deleted_at: new Date().toISOString() })
    .eq("workspace_id", workspaceId)
    .eq("id", campaignId);
  if (error) throw error;
}

export interface SenderBatchResult {
  ok: boolean;
  processed: number;
  sent: number;
  failed: number;
  remaining: number;
  status: string;
  errors: string[];
}

/**
 * Invoca a edge function whatsapp-campaign-v2-sender para processar UM lote.
 * O servidor é a única fonte de verdade — valida workspace, template aprovado,
 * idempotência e bloqueia opt-out/inválidos. Frontend nunca toca em tokens.
 */
export async function invokeCampaignSenderBatch(
  workspaceId: string,
  campaignId: string,
  action: "send_batch" | "pause" | "cancel" = "send_batch",
): Promise<SenderBatchResult> {
  const { data, error } = await supabase.functions.invoke<SenderBatchResult>(
    "whatsapp-campaign-v2-sender",
    { body: { workspaceId, campaignId, action } },
  );
  if (error) throw error;
  if (!data) throw new Error("Resposta vazia do sender.");
  return data;
}

export interface CampaignSendLog {
  id: string;
  campaign_id: string;
  recipient_id: string | null;
  phone: string | null;
  event: string;
  message: string | null;
  provider_message_id: string | null;
  error_message: string | null;
  created_at: string;
}

export async function listCampaignSendLogs(
  workspaceId: string,
  campaignId: string,
  limit = 20,
): Promise<CampaignSendLog[]> {
  const { data, error } = await supabase
    .from("whatsapp_campaign_send_logs")
    .select("id, campaign_id, recipient_id, phone, event, message, provider_message_id, error_message, created_at")
    .eq("workspace_id", workspaceId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CampaignSendLog[];
}

