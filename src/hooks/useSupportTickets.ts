import { useCallback, useEffect, useState } from "react";

export type SupportTicketType =
  | "question"
  | "bug"
  | "feature"
  | "billing"
  | "account"
  | "other";

export type SupportTicketPriority = "low" | "medium" | "high";
export type SupportTicketStatus = "open" | "in_review" | "resolved";

export interface SupportTicket {
  id: string;
  type: SupportTicketType;
  subject: string;
  message: string;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  route: string;
  userAgent: string;
  createdAt: string;
  isDemo: boolean;
}

const STORAGE_KEY = "orbyt.support.tickets.v1";

const seedDemoTickets = (): SupportTicket[] => [
  {
    id: crypto.randomUUID(),
    type: "feature",
    subject: "Filtros avançados no CRM",
    message: "Seria ótimo poder filtrar leads por origem e valor estimado.",
    priority: "medium",
    status: "in_review",
    route: "/crm",
    userAgent: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    isDemo: true,
  },
  {
    id: crypto.randomUUID(),
    type: "bug",
    subject: "Dashboard demorando para carregar",
    message: "Em telas menores o gráfico de performance demora ~3s.",
    priority: "low",
    status: "resolved",
    route: "/",
    userAgent: "demo",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    isDemo: true,
  },
];

const load = (): SupportTicket[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedDemoTickets();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw) as SupportTicket[];
  } catch {
    return [];
  }
};

const save = (tickets: SupportTicket[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch {
    // ignore
  }
};

export function useSupportTickets() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  useEffect(() => {
    setTickets(load());
  }, []);

  const createTicket = useCallback(
    (input: Omit<SupportTicket, "id" | "createdAt" | "status" | "isDemo" | "userAgent"> & {
      userAgent?: string;
    }) => {
      const ticket: SupportTicket = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        status: "open",
        isDemo: false,
        userAgent: input.userAgent ?? (typeof navigator !== "undefined" ? navigator.userAgent : "unknown"),
        type: input.type,
        subject: input.subject,
        message: input.message,
        priority: input.priority,
        route: input.route,
      };
      setTickets((prev) => {
        const next = [ticket, ...prev];
        save(next);
        return next;
      });
      return ticket;
    },
    [],
  );

  const resolveTicket = useCallback((id: string) => {
    setTickets((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, status: "resolved" as const } : t));
      save(next);
      return next;
    });
  }, []);

  const removeTicket = useCallback((id: string) => {
    setTickets((prev) => {
      const next = prev.filter((t) => t.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { tickets, createTicket, resolveTicket, removeTicket };
}

export const SUPPORT_WHATSAPP_URL: string | null = null;
export const SUPPORT_EMAIL: string | null = null;
