import notificationSoft from "@/assets/sounds/notification-soft.mp3";
import successSoft from "@/assets/sounds/success-soft.mp3";
import errorSoft from "@/assets/sounds/error-soft.mp3";
import taskComplete from "@/assets/sounds/task-complete.mp3";
import aiPulse from "@/assets/sounds/ai-pulse.mp3";
import campaignComplete from "@/assets/sounds/campaign-complete.mp3";
import whatsappUnansweredAlert from "@/assets/sounds/whatsapp-unanswered-alert.mp3";

export type KoraSoundModule =
  | "whatsapp"
  | "campaigns"
  | "crm"
  | "finance"
  | "tasks"
  | "ai";

export type KoraSoundEvent =
  | "whatsapp:new_message"
  | "whatsapp:sent"
  | "whatsapp:human_takeover"
  | "campaign:created"
  | "campaign:batch_success"
  | "campaign:batch_error"
  | "campaign:completed"
  | "crm:opportunity_created"
  | "quotes:approved"
  | "finance:paid"
  | "finance:overdue_alert"
  | "tasks:completed"
  | "tasks:overdue_alert"
  | "ai:enabled"
  | "ai:insight";

export interface KoraSoundDefinition {
  src: string;
  module: KoraSoundModule;
  /** Multiplier applied on top of global volume (0..1). */
  gain: number;
  /** Minimum ms between two consecutive plays of this event. */
  throttleMs: number;
}

export const SOUND_EVENTS: Record<KoraSoundEvent, KoraSoundDefinition> = {
  "whatsapp:new_message":     { src: notificationSoft,   module: "whatsapp",  gain: 0.9, throttleMs: 5000 },
  "whatsapp:sent":            { src: taskComplete,       module: "whatsapp",  gain: 0.5, throttleMs: 1500 },
  "whatsapp:human_takeover":  { src: aiPulse,            module: "whatsapp",  gain: 0.7, throttleMs: 3000 },
  "campaign:created":         { src: successSoft,        module: "campaigns", gain: 0.7, throttleMs: 3000 },
  "campaign:batch_success":   { src: successSoft,        module: "campaigns", gain: 0.7, throttleMs: 3000 },
  "campaign:batch_error":     { src: errorSoft,          module: "campaigns", gain: 0.8, throttleMs: 3000 },
  "campaign:completed":       { src: campaignComplete,   module: "campaigns", gain: 0.9, throttleMs: 3000 },
  "crm:opportunity_created":  { src: notificationSoft,   module: "crm",       gain: 0.7, throttleMs: 3000 },
  "quotes:approved":          { src: successSoft,        module: "crm",       gain: 1.0, throttleMs: 3000 },
  "finance:paid":             { src: successSoft,        module: "finance",   gain: 0.8, throttleMs: 3000 },
  "finance:overdue_alert":    { src: errorSoft,          module: "finance",   gain: 0.7, throttleMs: 5000 },
  "tasks:completed":          { src: taskComplete,       module: "tasks",     gain: 0.7, throttleMs: 1500 },
  "tasks:overdue_alert":      { src: errorSoft,          module: "tasks",     gain: 0.7, throttleMs: 5000 },
  "ai:enabled":               { src: aiPulse,            module: "ai",        gain: 0.7, throttleMs: 3000 },
  "ai:insight":               { src: aiPulse,            module: "ai",        gain: 0.7, throttleMs: 3000 },
};

export const MODULE_LABELS: Record<KoraSoundModule, string> = {
  whatsapp: "WhatsApp",
  campaigns: "Campanhas",
  crm: "CRM",
  finance: "Financeiro",
  tasks: "Tarefas",
  ai: "IA",
};
