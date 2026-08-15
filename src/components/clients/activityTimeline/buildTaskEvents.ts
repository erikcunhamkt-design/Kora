import type { Client } from "@/hooks/useClients";
import type { useTasks } from "@/hooks/useTasks";
import { parseDate } from "./format";
import type { InferredEvent } from "./types";

// Tasks NÃO bifurca nesta rodada (Fase B do flip de Tarefas, ainda não
// chegou) — hook cru (useTasks), só mudou de lugar pra este construtor.
export function buildTaskEvents(args: {
  client: Client;
  tasks: ReturnType<typeof useTasks>["tasks"];
  clientProjectIds: Set<string>;
}): InferredEvent[] {
  const { client, tasks, clientProjectIds } = args;
  const evts: InferredEvent[] = [];
  const matchesByName = (name?: string) => !!name && name.toLowerCase() === client.name.toLowerCase();

  const clientTasks = tasks.filter(
    (t) =>
      t.clientId === client.id ||
      matchesByName(t.client) ||
      (t.projectId && clientProjectIds.has(t.projectId)),
  );
  clientTasks.forEach((t) => {
    const created = parseDate(t.createdAt);
    if (created) evts.push({
      origin: "inferred", id: `tk-c-${t.id}`, type: "task_created", category: "tasks",
      title: "Tarefa criada", description: t.title,
      date: created, tone: "neutral",
    });
    if (t.status === "concluido") {
      const d = parseDate(t.updatedAt) ?? created;
      if (d) evts.push({
        origin: "inferred", id: `tk-done-${t.id}`, type: "task_completed", category: "tasks",
        title: "Tarefa concluída", description: t.title,
        date: d, status: "Concluída", tone: "success",
      });
    }
  });

  return evts;
}
