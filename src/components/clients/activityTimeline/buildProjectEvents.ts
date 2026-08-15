import type { Client } from "@/hooks/useClients";
import type { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { parseDate } from "./format";
import type { InferredEvent } from "./types";

export function buildProjectEvents(args: {
  client: Client;
  projects: ReturnType<typeof useBifurcatedProjects>;
}): { events: InferredEvent[]; projectIds: Set<string> } {
  const { client, projects } = args;
  const evts: InferredEvent[] = [];
  const matchesByName = (name?: string) => !!name && name.toLowerCase() === client.name.toLowerCase();

  const clientProjects = projects.filter((p) => p.clientId === client.id || matchesByName(p.clientName));
  const clientProjectIds = new Set(clientProjects.map((p) => p.id));
  clientProjects.forEach((p) => {
    const created = parseDate(p.createdAt);
    if (created) evts.push({
      origin: "inferred", id: `pj-c-${p.id}`, type: "project_created", category: "projects",
      title: "Projeto criado", description: p.name,
      date: created, tone: "primary",
      action: { label: "Ver projeto", href: `/portfolio?tab=projetos&projectId=${p.id}` },
    });
    if (p.status === "in_progress" && p.startDate) {
      const s = parseDate(p.startDate);
      if (s) evts.push({
        origin: "inferred", id: `pj-s-${p.id}`, type: "project_started", category: "projects",
        title: "Projeto iniciado", description: p.name,
        date: s, status: "Em andamento", tone: "warning",
        action: { label: "Ver projeto", href: `/portfolio?tab=projetos&projectId=${p.id}` },
      });
    }
    if (p.completedAt) {
      const d = parseDate(p.completedAt);
      if (d) evts.push({
        origin: "inferred", id: `pj-done-${p.id}`, type: "project_completed", category: "projects",
        title: "Projeto concluído", description: p.name,
        date: d, status: "Entregue", tone: "success",
        action: { label: "Ver projeto", href: `/portfolio?tab=projetos&projectId=${p.id}` },
      });
    }
    if (p.status === "cancelled") {
      const d = parseDate(p.updatedAt) ?? parseDate(p.createdAt);
      if (d) evts.push({
        origin: "inferred", id: `pj-x-${p.id}`, type: "project_cancelled", category: "projects",
        title: "Projeto cancelado", description: p.name,
        date: d, status: "Cancelado", tone: "danger",
      });
    }
  });

  return { events: evts, projectIds: clientProjectIds };
}
