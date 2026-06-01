import { useCallback, useEffect, useState } from "react";
import {
  NOTIFY_EVENT,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationType,
  type NotifyPayload,
} from "@/lib/notify";

export type { NotificationCategory, NotificationPriority, NotificationType };

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  category: NotificationCategory;
  type: NotificationType;
  priority: NotificationPriority;
  read: boolean;
  archived: boolean;
  actionLabel?: string;
  actionRoute?: string;
  sourceId?: string;
  sourceType?: string;
  createdAt: string;
  isDemo: boolean;
}

const STORAGE_KEY = "orbyt.notifications.v1";
const SEED_FLAG = "orbyt.notifications.v1.seeded";

const now = () => new Date().toISOString();
const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const SEEDS: AppNotification[] = [
  {
    id: "n-seed-1",
    title: "Proposta vence hoje",
    description: "A proposta para Acme Corp expira ao final do dia. Reenvie ou prorrogue.",
    category: "commercial",
    type: "warning",
    priority: "high",
    read: false,
    archived: false,
    actionLabel: "Abrir vendas",
    actionRoute: "/vendas",
    createdAt: ago(35),
    isDemo: true,
  },
  {
    id: "n-seed-2",
    title: "3 tarefas atrasadas",
    description: "Você tem tarefas com prazo vencido aguardando ação.",
    category: "project",
    type: "danger",
    priority: "critical",
    read: false,
    archived: false,
    actionLabel: "Ver tarefas",
    actionRoute: "/tarefas",
    createdAt: ago(120),
    isDemo: true,
  },
  {
    id: "n-seed-3",
    title: "Meta mensal em 78%",
    description: "Você está perto de bater sua meta de receita do mês.",
    category: "finance",
    type: "info",
    priority: "medium",
    read: false,
    archived: false,
    actionLabel: "Ver metas",
    actionRoute: "/metas",
    createdAt: ago(60 * 6),
    isDemo: true,
  },
  {
    id: "n-seed-4",
    title: "Lead quente sem follow-up",
    description: "FitTrack respondeu há 2 dias e ainda não teve retorno.",
    category: "commercial",
    type: "warning",
    priority: "high",
    read: false,
    archived: false,
    actionLabel: "Abrir CRM",
    actionRoute: "/crm",
    createdAt: ago(60 * 26),
    isDemo: true,
  },
  {
    id: "n-seed-5",
    title: "Chamado registrado",
    description: "Seu último chamado foi registrado e está na fila de atendimento.",
    category: "support",
    type: "success",
    priority: "low",
    read: true,
    archived: false,
    createdAt: ago(60 * 50),
    isDemo: true,
  },
  {
    id: "n-seed-6",
    title: "Conta a receber vencida",
    description: "Há cobranças com vencimento ultrapassado no financeiro.",
    category: "finance",
    type: "danger",
    priority: "high",
    read: false,
    archived: false,
    actionLabel: "Abrir financeiro",
    actionRoute: "/financeiro",
    createdAt: ago(60 * 72),
    isDemo: true,
  },
];

const load = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AppNotification[];
  } catch { /* intentionally empty */ }
  return [];
};

const persist = (n: AppNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(n));
  } catch { /* intentionally empty */ }
};

const ensureSeeded = (current: AppNotification[]): AppNotification[] => {
  try {
    if (localStorage.getItem(SEED_FLAG)) return current;
    localStorage.setItem(SEED_FLAG, "1");
    const merged = [...SEEDS, ...current];
    persist(merged);
    return merged;
  } catch {
    return current;
  }
};

export function useNotificationsCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    setNotifications(ensureSeeded(load()));

    const onNotify = (e: Event) => {
      const detail = (e as CustomEvent<NotifyPayload>).detail;
      if (!detail) return;
      const fresh: AppNotification = {
        id: crypto.randomUUID(),
        title: detail.title,
        description: detail.description,
        category: detail.category,
        type: detail.type ?? "info",
        priority: detail.priority ?? "medium",
        read: false,
        archived: false,
        actionLabel: detail.actionLabel,
        actionRoute: detail.actionRoute,
        sourceId: detail.sourceId,
        sourceType: detail.sourceType,
        createdAt: now(),
        isDemo: false,
      };
      setNotifications((prev) => {
        const next = [fresh, ...prev];
        persist(next);
        return next;
      });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setNotifications(load());
    };

    window.addEventListener(NOTIFY_EVENT, onNotify);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(NOTIFY_EVENT, onNotify);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = useCallback((updater: (prev: AppNotification[]) => AppNotification[]) => {
    setNotifications((prev) => {
      const next = updater(prev);
      persist(next);
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    update((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, [update]);

  const markUnread = useCallback((id: string) => {
    update((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
  }, [update]);

  const markAllRead = useCallback(() => {
    update((prev) => prev.map((n) => ({ ...n, read: true })));
  }, [update]);

  const archive = useCallback((id: string) => {
    update((prev) => prev.map((n) => (n.id === id ? { ...n, archived: true, read: true } : n)));
  }, [update]);

  const unarchive = useCallback((id: string) => {
    update((prev) => prev.map((n) => (n.id === id ? { ...n, archived: false } : n)));
  }, [update]);

  const clearArchived = useCallback(() => {
    update((prev) => prev.filter((n) => !n.archived));
  }, [update]);

  const remove = useCallback((id: string) => {
    update((prev) => prev.filter((n) => n.id !== id));
  }, [update]);

  const unreadCount = notifications.filter((n) => !n.archived && !n.read).length;
  const hasHighPriorityUnread = notifications.some(
    (n) => !n.archived && !n.read && (n.priority === "high" || n.priority === "critical"),
  );

  return {
    notifications,
    unreadCount,
    hasHighPriorityUnread,
    markRead,
    markUnread,
    markAllRead,
    archive,
    unarchive,
    clearArchived,
    remove,
  };
}
