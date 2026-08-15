import type { Client } from "@/hooks/useClients";
import type { useLeads } from "@/hooks/useLeads";
import type { useQuotes } from "@/hooks/useQuotes";
import { parseDate } from "./format";
import type { InferredEvent } from "./types";

export function buildCommercialEvents(args: {
  client: Client;
  leads: ReturnType<typeof useLeads>["leads"];
  quotes: ReturnType<typeof useQuotes>["quotes"];
}): InferredEvent[] {
  const { client, leads, quotes } = args;
  const evts: InferredEvent[] = [];
  const matchesByName = (name?: string) => !!name && name.toLowerCase() === client.name.toLowerCase();

  if (client.createdAt) {
    evts.push({
      origin: "inferred", id: `cli-created-${client.id}`, type: "client_created", category: "commercial",
      title: "Cliente cadastrado", description: client.company || undefined,
      date: client.createdAt, tone: "primary",
    });
  }
  if (client.updatedAt && client.updatedAt !== client.createdAt) {
    evts.push({
      origin: "inferred", id: `cli-updated-${client.id}`, type: "client_updated", category: "commercial",
      title: "Cliente atualizado", date: client.updatedAt, tone: "neutral",
    });
  }

  (client.contacts ?? []).forEach((c) => {
    const d = parseDate(c.createdAt);
    if (!d) return;
    evts.push({
      origin: "inferred", id: `contact-${c.id}`, type: "contact_added", category: "commercial",
      title: "Contato adicionado", description: `${c.name}${c.role ? ` · ${c.role}` : ""}`,
      date: d, tone: "neutral",
    });
  });

  const clientLeads = leads.filter(
    (l) => l.clientId === client.id || l.convertedClientId === client.id || matchesByName(l.name) || matchesByName(l.company),
  );
  clientLeads.forEach((l) => {
    const created = parseDate(l.createdAt);
    if (created) {
      evts.push({
        origin: "inferred", id: `lead-c-${l.id}`, type: "opportunity_created", category: "commercial",
        title: "Oportunidade criada", description: l.description || l.name,
        amount: l.estimatedValue, date: created, tone: "primary",
        action: { label: "Ver no CRM", href: `/crm?lead=${l.id}` },
      });
    }
    if (l.wonAt) {
      const w = parseDate(l.wonAt);
      if (w) evts.push({
        origin: "inferred", id: `lead-w-${l.id}`, type: "opportunity_won", category: "commercial",
        title: "Oportunidade ganha", description: l.name, amount: l.estimatedValue,
        date: w, status: "Ganho", tone: "success",
        action: { label: "Ver no CRM", href: `/crm?lead=${l.id}` },
      });
    }
    if (l.stage === "perdido" && l.lostReason) {
      const lostDate = parseDate(l.updatedAt) ?? parseDate(l.createdAt);
      if (lostDate) evts.push({
        origin: "inferred", id: `lead-l-${l.id}`, type: "opportunity_lost", category: "commercial",
        title: "Oportunidade perdida", description: l.lostReason,
        date: lostDate, status: "Perdido", tone: "danger",
      });
    }
  });

  const clientQuotes = quotes.filter((q) => q.clientId === client.id || matchesByName(q.clientName));
  clientQuotes.forEach((q) => {
    const created = parseDate(q.createdAt);
    if (created) evts.push({
      origin: "inferred", id: `qt-c-${q.id}`, type: "quote_created", category: "commercial",
      title: "Orçamento criado", description: q.title, amount: q.total,
      date: created, tone: "neutral",
      action: { label: "Ver orçamento", href: "/vendas" },
    });
    const sent = parseDate(q.sentAt);
    if (sent) evts.push({
      origin: "inferred", id: `qt-s-${q.id}`, type: "quote_sent", category: "commercial",
      title: "Orçamento enviado", description: q.title, amount: q.total,
      date: sent, status: "Enviado", tone: "warning",
      action: { label: "Ver orçamento", href: "/vendas" },
    });
    const approved = parseDate(q.approvedAt);
    if (approved) evts.push({
      origin: "inferred", id: `qt-a-${q.id}`, type: "quote_approved", category: "commercial",
      title: "Orçamento aprovado", description: q.title, amount: q.total,
      date: approved, status: "Aprovado", tone: "success",
      action: { label: "Ver orçamento", href: "/vendas" },
    });
    const rejected = parseDate(q.rejectedAt);
    if (rejected) evts.push({
      origin: "inferred", id: `qt-r-${q.id}`, type: "quote_rejected", category: "commercial",
      title: "Orçamento recusado", description: q.title,
      date: rejected, status: "Recusado", tone: "danger",
    });
    if (q.status === "vencido") {
      const d = parseDate(q.updatedAt) ?? parseDate(q.sentAt) ?? parseDate(q.createdAt);
      if (d) evts.push({
        origin: "inferred", id: `qt-e-${q.id}`, type: "quote_expired", category: "commercial",
        title: "Orçamento vencido", description: q.title,
        date: d, status: "Vencido", tone: "warning",
      });
    }
  });

  return evts;
}
