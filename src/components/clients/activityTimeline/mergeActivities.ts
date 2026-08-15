import { formatDate as intlDate } from "@/lib/format";
import {
  manualTypeToCategory,
  MANUAL_ACTIVITY_LABEL,
  type ClientManualActivity,
} from "@/hooks/useClientActivityLogs";
import type { ClientActivityEvent, InferredEvent, ManualEvent, Tone } from "./types";

export const manualTone: Record<ClientManualActivity["type"], Tone> = {
  meeting: "primary",
  call: "primary",
  message: "neutral",
  feedback: "primary",
  scope_change: "warning",
  material_request: "neutral",
  decision: "success",
  issue: "danger",
  internal_note: "neutral",
  follow_up: "warning",
  other: "neutral",
};

export function manualToEvent(m: ClientManualActivity): ManualEvent {
  return {
    origin: "manual",
    raw: m,
    id: `manual-${m.id}`,
    type: m.type,
    category: manualTypeToCategory(m.type),
    title: `${MANUAL_ACTIVITY_LABEL[m.type]}: ${m.title}`,
    description: [
      m.description,
      m.outcome && `Resultado: ${m.outcome}`,
      m.nextStep && `Próximo passo: ${m.nextStep}${m.nextStepDate ? ` (${intlDate(m.nextStepDate, { day: "2-digit", month: "short" })})` : ""}`,
    ].filter(Boolean).join(" · ") || undefined,
    date: m.date,
    tone: manualTone[m.type],
  };
}

export function mergeManualAndInferredActivities(
  inferred: InferredEvent[],
  manual: ClientManualActivity[],
): ClientActivityEvent[] {
  const all: ClientActivityEvent[] = [
    ...inferred,
    ...manual.map(manualToEvent),
  ];
  const seen = new Set<string>();
  const dedup = all.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)));
  dedup.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return dedup;
}
