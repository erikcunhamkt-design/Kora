import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Pipeline } from "@/hooks/usePipelines";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipelines: Pipeline[];
  currentPipelineId: string;
  onConfirm: (pipelineId: string, stageId: string) => void;
}

export const MoveToPipelineDialog = ({ open, onOpenChange, pipelines, currentPipelineId, onConfirm }: Props) => {
  const others = pipelines.filter((p) => p.id !== currentPipelineId);
  const [pipelineId, setPipelineId] = useState(others[0]?.id || "");
  const target = pipelines.find((p) => p.id === pipelineId);
  const sorted = target ? [...target.stages].sort((a, b) => a.order - b.order) : [];
  const [stageId, setStageId] = useState(sorted[0]?.id || "");

  useEffect(() => {
    if (open) {
      const first = others[0];
      setPipelineId(first?.id || "");
      const firstStage = first?.stages.sort((a, b) => a.order - b.order)[0];
      setStageId(firstStage?.id || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (target) {
      const first = [...target.stages].sort((a, b) => a.order - b.order)[0];
      setStageId(first?.id || "");
    }
  }, [pipelineId]); // eslint-disable-line

  const handleConfirm = () => {
    if (!pipelineId || !stageId) return toast.error("Selecione pipeline e etapa");
    onConfirm(pipelineId, stageId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Mover para outro pipeline</DialogTitle>
          <DialogDescription>Escolha o pipeline e a etapa inicial.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">Não há outros pipelines disponíveis. Crie um novo primeiro.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Pipeline destino</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {others.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Etapa inicial</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sorted.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="orbit-gradient text-white border-0" disabled={others.length === 0} onClick={handleConfirm}>Mover</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
