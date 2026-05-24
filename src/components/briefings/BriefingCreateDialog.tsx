import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BriefingTemplate } from "@/hooks/useBriefingTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: BriefingTemplate[];
  defaultTemplateId?: string;
  onCreate: (data: { templateId: string; templateName: string; clientName: string; clientEmail?: string; projectName?: string; notes?: string }) => void;
}

export function BriefingCreateDialog({ open, onOpenChange, templates, defaultTemplateId, onCreate }: Props) {
  const [templateId, setTemplateId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setTemplateId(defaultTemplateId ?? templates[0]?.id ?? "");
      setClientName("");
      setClientEmail("");
      setProjectName("");
      setNotes("");
    }
  }, [open, defaultTemplateId, templates]);

  const handleCreate = () => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl || !clientName.trim()) return;
    onCreate({
      templateId: tpl.id,
      templateName: tpl.name,
      clientName: clientName.trim(),
      clientEmail: clientEmail.trim() || undefined,
      projectName: projectName.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo briefing</DialogTitle>
          <DialogDescription>Crie um briefing a partir de um template e gere um link único para o cliente.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Template *</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Escolha um template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente *</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome do cliente" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Projeto</Label>
              <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Ex.: Rebrand 2026" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Observações internas</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={!templateId || !clientName.trim()}>Criar briefing</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
