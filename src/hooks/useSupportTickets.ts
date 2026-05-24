import { useCallback, useEffect, useState } from "react";
import { emitNotification } from "@/lib/notify";


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

const load = (): SupportTicket[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
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
      emitNotification({
        title: "Chamado registrado",
        description: ticket.subject,
        category: "support",
        type: "success",
        priority: ticket.priority === "high" ? "high" : "medium",
        sourceId: ticket.id,
        sourceType: "support_ticket",
      });
      return ticket;
    },
    [],
  );

  const resolveTicket = useCallback((id: string) => {
    setTickets((prev) => {
      const ticket = prev.find((t) => t.id === id);
      const next = prev.map((t) => (t.id === id ? { ...t, status: "resolved" as const } : t));
      save(next);
      if (ticket && ticket.status !== "resolved") {
        emitNotification({
          title: "Chamado resolvido",
          description: ticket.subject,
          category: "support",
          type: "success",
          priority: "low",
          sourceId: ticket.id,
          sourceType: "support_ticket",
        });
      }
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

// Future chat structure (not active yet)
export type SupportConversationStatus = "waiting" | "assigned" | "closed";

export interface SupportConversation {
  id: string;
  status: SupportConversationStatus;
  assignedAgentName?: string;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  conversationId: string;
  sender: "user" | "agent" | "system";
  text: string;
  createdAt: string;
}
