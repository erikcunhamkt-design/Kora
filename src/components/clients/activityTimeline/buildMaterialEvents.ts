import type { Client } from "@/hooks/useClients";
import { parseDate } from "./format";
import type { InferredEvent } from "./types";

export function buildMaterialEvents(args: { client: Client }): InferredEvent[] {
  const { client } = args;
  const evts: InferredEvent[] = [];

  (client.technicalSheet?.assets ?? []).forEach((a) => {
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
