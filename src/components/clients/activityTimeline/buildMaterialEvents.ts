import type { Client } from "@/hooks/useClients";
import type { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";
import { parseDate } from "./format";
import type { InferredEvent } from "./types";

// G74 (etapa-5-flip-fichas-pacote.md §11) — `sheet` vem de
// useBifurcatedTechnicalSheet(client.id), chamado por quem invoca este
// construtor (ClientActivitiesTab.tsx) — função pura, não chama hook.
export function buildMaterialEvents(args: {
  client: Client;
  sheet: ReturnType<typeof useBifurcatedTechnicalSheet>;
}): InferredEvent[] {
  const { client, sheet } = args;
  const evts: InferredEvent[] = [];

  (sheet.assets ?? []).forEach((a) => {
    const d = parseDate(a.createdAt);
    if (!d) return;
    evts.push({
      origin: "inferred", id: `mat-${a.id}`, type: "material_added", category: "materials",
      title: "Material adicionado", description: a.title,
      date: d, tone: "neutral",
      action: { label: "Ver Ficha Técnica", href: `/clientes/${client.id}/ficha-tecnica` },
    });
  });

  return evts;
}
