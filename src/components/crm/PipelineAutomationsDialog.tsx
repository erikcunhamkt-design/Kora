import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Pipeline } from "@/hooks/usePipelines";
import { usePipelineAutomations } from "@/hooks/usePipelineAutomations";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipeline: Pipeline;
}

export const PipelineAutomationsDialog = ({ open, onOpenChange, pipeline }: Props) => {
  const { getRulesForPipeline, addRule, updateRule, deleteRule } = usePipelineAutomations();
  const rules = getRulesForPipeline(pipeline.id);

  const [stageId, setStageId] = useState(pipeline.stages[0]?.id || "");
  const [addTag, setAddTag] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const handleAdd = () => {
    if (!stageId) return;
    if (!addTag.trim() && !nextAction.trim() && !toastMsg.trim()) {
      toast.error("Defina ao menos uma ação");
      return;
    }
    addRule({
      pipelineId: pipeline.id,
      triggerStageId: stageId,
      enabled: true,
      actions: {
        addTag: addTag.trim() || undefined,
        setNextAction: nextAction.trim() || undefined,
        toast: toastMsg.trim() || undefined,
      },
    });
    setAddTag("");
    setNextAction("");
    setToastMsg("");
    toast.success("Automação criada");
  };

  const stageName = (id: string) => pipeline.stages.find((s) => s.id === id)?.name || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Automações — {pipeline.name}
          </DialogTitle>
          <DialogDescription>
            Regras locais executadas quando um lead muda de etapa. Sem envio real de e-mail ou WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="orbit-card p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Nova automação</h4>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Quando lead entrar em</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pipeline.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Adicionar tag</Label>
                <Input placeholder="Ex.: proposta" value={addTag} onChange={(e) => setAddTag(e.target.value)} className="bg-muted/50 border-border" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Próxima ação</Label>
                <Input placeholder="Ex.: Follow-up em 2 dias" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="bg-muted/50 border-border" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label className="text-xs text-muted-foreground">Mensagem de notificação</Label>
                <Input placeholder="Ex.: Lead avançou para Proposta!" value={toastMsg} onChange={(e) => setToastMsg(e.target.value)} className="bg-muted/50 border-border" />
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="orbit-gradient text-white border-0 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Criar automação
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Regras ativas ({rules.length})</h4>
            {rules.length === 0 && (
              <div className="orbit-card border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma automação configurada
              </div>
            )}
            {rules.map((r) => (
              <div key={r.id} className="orbit-card p-3 flex items-start gap-3">
                <Switch
                  checked={r.enabled}
                  onCheckedChange={(v) => updateRule(r.id, { enabled: v })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    Ao entrar em <span className="font-semibold">{stageName(r.triggerStageId)}</span>:
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {r.actions.addTag && <Badge variant="outline" className="text-[10px]">+ tag “{r.actions.addTag}”</Badge>}
                    {r.actions.setNextAction && <Badge variant="outline" className="text-[10px]">próx. ação</Badge>}
                    {r.actions.toast && <Badge variant="outline" className="text-[10px]">notificação</Badge>}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteRule(r.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
