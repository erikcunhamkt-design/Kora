import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MANUAL_ACTIVITY_LABEL,
  MANUAL_ACTIVITY_TYPES,
  type ClientManualActivity,
  type ManualActivityType,
} from "@/hooks/useClientActivityLogs";
import type { Client } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useProjects } from "@/hooks/useProjects";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client;
  editing?: ClientManualActivity | null;
  onSubmit: (data: Omit<ClientManualActivity, "id" | "createdAt" | "updatedAt">) => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const NONE = "__none__";

export function ClientActivityLogDialog({ open, onOpenChange, client, editing, onSubmit }: Props) {
  const { leads } = useLeads();
  const { quotes } = useQuotes();
  const { projects } = useProjects();

  const matchesByName = (n?: string) => !!n && n.toLowerCase() === client.name.toLowerCase();

  const clientLeads = leads.filter(
    (l) => l.clientId === client.id || l.convertedClientId === client.id || matchesByName(l.name) || matchesByName(l.company),
  );
  const clientQuotes = quotes.filter((q) => q.clientId === client.id || matchesByName(q.clientName));
  const clientProjects = projects.filter((p) => p.clientId === client.id || matchesByName(p.clientName));
  const contacts = client.contacts ?? [];

  const [type, setType] = useState<ManualActivityType>("meeting");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [outcome, setOutcome] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState("");
  const [relatedContactId, setRelatedContactId] = useState<string>(NONE);
  const [relatedProjectId, setRelatedProjectId] = useState<string>(NONE);
  const [relatedOpportunityId, setRelatedOpportunityId] = useState<string>(NONE);
  const [relatedQuoteId, setRelatedQuoteId] = useState<string>(NONE);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setType(editing.type);
      setTitle(editing.title);
      setDate(editing.date.slice(0, 10));
      setDescription(editing.description ?? "");
      setOutcome(editing.outcome ?? "");
      setNextStep(editing.nextStep ?? "");
      setNextStepDate(editing.nextStepDate ? editing.nextStepDate.slice(0, 10) : "");
      setRelatedContactId(editing.relatedContactId ?? NONE);
      setRelatedProjectId(editing.relatedProjectId ?? NONE);
      setRelatedOpportunityId(editing.relatedOpportunityId != null ? String(editing.relatedOpportunityId) : NONE);
      setRelatedQuoteId(editing.relatedQuoteId ?? NONE);
    } else {
      setType("meeting");
      setTitle("");
      setDate(todayISO());
      setDescription("");
      setOutcome("");
      setNextStep("");
      setNextStepDate("");
      setRelatedContactId(NONE);
      setRelatedProjectId(NONE);
      setRelatedOpportunityId(NONE);
      setRelatedQuoteId(NONE);
    }
  }, [open, editing]);

  const handleSubmit = () => {
    if (!title.trim()) {
      toast.error("Informe um título");
      return;
    }
    if (!date) {
      toast.error("Informe a data");
      return;
    }
    onSubmit({
      clientId: client.id,
      type,
      title: title.trim(),
      date: new Date(date).toISOString(),
      description: description.trim() || undefined,
      outcome: outcome.trim() || undefined,
      nextStep: nextStep.trim() || undefined,
      nextStepDate: nextStepDate ? new Date(nextStepDate).toISOString() : undefined,
      relatedContactId: relatedContactId !== NONE ? relatedContactId : undefined,
      relatedProjectId: relatedProjectId !== NONE ? relatedProjectId : undefined,
      relatedOpportunityId:
        relatedOpportunityId !== NONE ? Number(relatedOpportunityId) : undefined,
      relatedQuoteId: relatedQuoteId !== NONE ? relatedQuoteId : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar atividade" : "Registrar atividade"}</DialogTitle>
          <DialogDescription>
            Documente reuniões, ligações, decisões e demais interações com {client.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="act-type">Tipo *</Label>
              <Select value={type} onValueChange={(v) => setType(v as ManualActivityType)}>
                <SelectTrigger id="act-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MANUAL_ACTIVITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{MANUAL_ACTIVITY_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-date">Data *</Label>
              <Input id="act-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="act-title">Título *</Label>
            <Input
              id="act-title"
              placeholder="Ex: Reunião de alinhamento de escopo"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="act-desc">Descrição</Label>
            <Textarea
              id="act-desc"
              rows={3}
              placeholder="Contexto, pontos discutidos, observações..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="act-outcome">Resultado / decisão</Label>
              <Input
                id="act-outcome"
                placeholder="Ex: Cliente aprovou proposta"
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="act-next">Próximo passo</Label>
              <Input
                id="act-next"
                placeholder="Ex: Enviar contrato até sexta"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
              />
            </div>
          </div>

          {(contacts.length > 0 || clientProjects.length > 0 || clientLeads.length > 0 || clientQuotes.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
              {contacts.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Contato relacionado</Label>
                  <Select value={relatedContactId} onValueChange={setRelatedContactId}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {contacts.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {clientProjects.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Projeto relacionado</Label>
                  <Select value={relatedProjectId} onValueChange={setRelatedProjectId}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {clientProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {clientLeads.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Oportunidade relacionada</Label>
                  <Select value={relatedOpportunityId} onValueChange={setRelatedOpportunityId}>
                    <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {clientLeads.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {clientQuotes.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Orçamento relacionado</Label>
                  <Select value={relatedQuoteId} onValueChange={setRelatedQuoteId}>
                    <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhum</SelectItem>
                      {clientQuotes.map((q) => (
                        <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{editing ? "Salvar alterações" : "Registrar atividade"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
