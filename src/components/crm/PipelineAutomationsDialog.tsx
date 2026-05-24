import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Zap, ArrowRight, Tag, Bell, Calendar } from "lucide-react";
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
  const stageColor = (id: string) => pipeline.stages.find((s) => s.id === id)?.color || "#888";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-foreground text-base">Automações do pipeline</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Crie ações locais quando um lead mudar de etapa.
                </DialogDescription>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1">
              <Badge variant="outline" className="text-[9px] border-border text-muted-foreground gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Local
              </Badge>
              <span className="text-[9px] text-muted-foreground/70">Sem envio real</span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Builder */}
          <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 space-y-3.5">
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Plus className="h-3.5 w-3.5 text-primary" /> Nova automação
            </h4>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground/80">1. Gatilho</Label>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="bg-card border-border h-9">
                  <SelectValue placeholder="Quando lead entrar em…" />
                </SelectTrigger>
                <SelectContent>
                  {pipeline.stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground/80">2. Ações</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="relative">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Adicionar tag" value={addTag} onChange={(e) => setAddTag(e.target.value)} className="pl-8 h-9 bg-card border-border text-[13px]" />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Definir próxima ação" value={nextAction} onChange={(e) => setNextAction(e.target.value)} className="pl-8 h-9 bg-card border-border text-[13px]" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground/80">3. Notificação (opcional)</Label>
              <div className="relative">
                <Bell className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Mensagem a exibir no app" value={toastMsg} onChange={(e) => setToastMsg(e.target.value)} className="pl-8 h-9 bg-card border-border text-[13px]" />
              </div>
            </div>

            <Button size="sm" onClick={handleAdd} className="orbit-gradient text-white border-0 gap-1.5 w-full sm:w-auto">
              <Plus className="h-3.5 w-3.5" /> Criar automação
            </Button>
          </div>

          {/* Rules list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Regras ativas</h4>
              <span className="text-[11px] text-muted-foreground">{rules.length} {rules.length === 1 ? "regra" : "regras"}</span>
            </div>

            {rules.length === 0 && (
              <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
                <div className="h-9 w-9 mx-auto rounded-full bg-muted/40 flex items-center justify-center mb-2">
                  <Zap className="h-4 w-4 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma automação ainda</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">Crie uma regra acima para reagir a mudanças de etapa.</p>
              </div>
            )}

            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className="rounded-lg border border-border bg-card p-3 flex items-start gap-3">
                  <Switch
                    checked={r.enabled}
                    onCheckedChange={(v) => updateRule(r.id, { enabled: v })}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-[13px] text-foreground flex-wrap">
                      <span className="text-muted-foreground">Ao entrar em</span>
                      <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-muted/60">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: stageColor(r.triggerStageId) }} />
                        <span className="font-semibold">{stageName(r.triggerStageId)}</span>
                      </span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground/70" />
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {r.actions.addTag && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-border/80">
                          <Tag className="h-2.5 w-2.5" /> #{r.actions.addTag}
                        </Badge>
                      )}
                      {r.actions.setNextAction && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-border/80">
                          <Calendar className="h-2.5 w-2.5" /> próxima ação
                        </Badge>
                      )}
                      {r.actions.toast && (
                        <Badge variant="outline" className="text-[10px] gap-1 border-border/80">
                          <Bell className="h-2.5 w-2.5" /> notificação
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteRule(r.id)} className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
