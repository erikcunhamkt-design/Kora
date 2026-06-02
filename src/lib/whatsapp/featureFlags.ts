// Feature flags locais para o módulo WhatsApp.
// Persistem em localStorage para permitir alternar durante operação,
// mas o servidor (edge function) tem suas próprias travas — esta flag
// é apenas controle visual de UX.

const KEYS = {
  campaignSender: "kora.whatsapp.campaignSender.enabled",
} as const;

export function isCampaignSenderEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEYS.campaignSender) === "true";
}

export function setCampaignSenderEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEYS.campaignSender, enabled ? "true" : "false");
}

export const CAMPAIGN_SENDER_FLAG_KEY = KEYS.campaignSender;
