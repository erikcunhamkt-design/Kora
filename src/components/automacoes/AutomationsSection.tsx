import { useState } from "react";
import { Zap, Plus, Play, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAutomations, AutomationTrigger, AutomationAction } from "@/hooks/useAutomations";

const triggerLabels: Record<AutomationTrigger, string> = {
  new_lead: "Novo lead", new_client: "Novo cliente", quote_approved: "Orçamento aprovado", task_overdue: "Tarefa atrasada", whatsapp_keyword: "Palavra no WhatsApp", manual: "Manual",
};
const actionLabels: Record<AutomationAction, string> = {
  create_task: "Criar tarefa", send_message: "Enviar mensagem", move_pipeline: "Mover no pipeline", notify: "Notificar", add_tag: "Adicionar tag",
};

export function AutomationsSection() {
  const { rules, executions, addRule, toggleRule, deleteRule, simulateExecution } = useAutomations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", trigger: "new_lead" as AutomationTrigger, action: "create_task" as AutomationAction, description: "", active: true });

  const active = rules.filter((r) => r.active).length;
  const paused = rules.length - active;

  const handleCreate = () => {
    if (!form.name.trim()) return toast.error("Nome é obrigatório");
    addRule(form);
    toast.success("Automação criada");
    setForm({ name: "", trigger: "new_lead", action: "create_task", description: "", active: true });
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Automações</h2>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Nova automação</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Metric label="Regras ativas" value={active} />
        <Metric label="Execuções simuladas" value={executions} />
        <Metric label="Regras pausadas" value={paused} />
        <Metric label="Gatilhos disponíveis" value={Object.keys(triggerLabels).length} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {rules.map((r) => (
          <Card key={r.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{r.name}</h3>
                  {r.isDemo && <Badge variant="outline" className="text-[10px]">demo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">{triggerLabels[r.trigger]} → {actionLabels[r.action]}</p>
              </div>
              <Switch checked={r.active} onCheckedChange={() => toggleRule(r.id)} />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { simulateExecution(); toast.success("Automação simulada com sucesso."); }}><Play className="h-3.5 w-3.5" /> Simular</Button>
              {!r.isDemo && <Button size="sm" variant="ghost" onClick={() => deleteRule(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova automação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Gatilho</Label>
              <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v as AutomationTrigger })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(triggerLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Ação</Label>
              <Select value={form.action} onValueChange={(v) => setForm({ ...form, action: v as AutomationAction })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(actionLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-center justify-between"><Label>Ativa</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2"><span>{label}</span><Zap className="h-4 w-4" /></div>
      <p className="text-2xl font-bold">{value}</p>
    </Card>
  );
}
