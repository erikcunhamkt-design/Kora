import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "./useTasks";
import { toast } from "./use-toast";

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

const CHECK_INTERVAL_MS = 30_000;

function supportsNotifications(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function useTaskReminders(
  tasks: Task[],
  onMarkSent: (taskId: number, sentAt: string) => void,
) {
  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (!supportsNotifications()) return "unsupported";
    return Notification.permission as NotifPermission;
  });

  const tasksRef = useRef(tasks);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const requestPermission = useCallback(async () => {
    if (!supportsNotifications()) {
      toast({ title: "Notificações indisponíveis neste navegador" });
      return "unsupported" as NotifPermission;
    }
    try {
      const p = await Notification.requestPermission();
      setPermission(p as NotifPermission);
      if (p === "granted") toast({ title: "Notificações ativadas" });
      else if (p === "denied") toast({ title: "Permissão negada", description: "Você pode reativar nas preferências do navegador." });
      return p as NotifPermission;
    } catch {
      return "denied" as NotifPermission;
    }
  }, []);

  const fire = useCallback((t: Task) => {
    const sentAt = new Date().toISOString();
    onMarkSent(t.id, sentAt);
    const body = t.client ? `${t.client}${t.project ? " · " + t.project : ""}` : (t.project || "Lembrete de tarefa");
    if (permission === "granted" && supportsNotifications()) {
      try {
        new Notification(`⏰ ${t.title}`, { body, tag: `kora-task-${t.id}` });
        return;
      } catch {}
    }
    toast({ title: `⏰ ${t.title}`, description: body });
  }, [permission, onMarkSent]);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      tasksRef.current.forEach(t => {
        if (!t.reminderEnabled || !t.reminderAt) return;
        if (t.status === "concluido" || t.archived) return;
        if (t.reminderSentAt) return;
        const due = new Date(t.reminderAt).getTime();
        if (isNaN(due)) return;
        if (due <= now) fire(t);
      });
    };
    tick();
    const id = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [fire]);

  return { permission, requestPermission, supported: supportsNotifications() };
}

/** Calcula reminderAt baseado em preset relativo ao dueDate. */
export type ReminderPreset =
  | "none" | "at-time" | "10m" | "30m" | "1h" | "1d" | "custom";

export function computeReminderAt(dueDate: string | undefined, preset: ReminderPreset, customIso?: string): string | undefined {
  if (preset === "none") return undefined;
  if (preset === "custom") return customIso || undefined;
  if (!dueDate) return undefined;
  // dueDate é yyyy-mm-dd; assumimos 09:00 local como "hora padrão"
  const base = new Date(`${dueDate}T09:00:00`);
  if (isNaN(base.getTime())) return undefined;
  const offsetsMin: Record<Exclude<ReminderPreset, "none" | "custom">, number> = {
    "at-time": 0, "10m": 10, "30m": 30, "1h": 60, "1d": 24 * 60,
  };
  const off = offsetsMin[preset as Exclude<ReminderPreset, "none" | "custom">];
  base.setMinutes(base.getMinutes() - off);
  return base.toISOString();
}

export const REMINDER_PRESET_LABELS: Record<ReminderPreset, string> = {
  none: "Sem lembrete",
  "at-time": "Na hora",
  "10m": "10 min antes",
  "30m": "30 min antes",
  "1h": "1 hora antes",
  "1d": "1 dia antes",
  custom: "Personalizado",
};
