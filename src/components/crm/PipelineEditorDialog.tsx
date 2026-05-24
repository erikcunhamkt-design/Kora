import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GripVertical, Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import type { Pipeline, PipelineStage, StageType } from "@/hooks/usePipelines";
import { newStageId } from "@/hooks/usePipelines";
import { toast } from "sonner";

const STAGE_COLORS = [
  "#F81040", "#8B5CF6", "#F59E0B", "#3B82F6",
  "#10B981", "#EF4444", "#EC4899", "#06B6D4",
  "#A855F7", "#F97316",
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pipeline: Pipeline | null; // null = create new
  onSave: (data: Omit<Pipeline, "id" | "createdAt" | "updatedAt" | "isDefault"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  leadCountByStage?: Record<string, number>;
}

export const PipelineEditorDialog = ({
  open,
  onOpenChange,
  pipeline,
  onSave,
  onDelete,
  leadCountByStage = {},
}: Props) => {
  const isEdit = !!pipeline;
  const [name, setName] = useState("");
  const [stages, setStages] = useState<PipelineStage[]>([]);

  useEffect(() => {
    if (open) {
      if (pipeline) {
        setName(pipeline.name);
        setStages([...pipeline.stages].sort((a, b) => a.order - b.order));
      } else {
        setName("");
        setStages([
          { id: newStageId(), name: "Novo Lead", color: STAGE_COLORS[0], order: 0, type: "open" },
          { id: newStageId(), name: "Em Contato", color: STAGE_COLORS[1], order: 1, type: "open" },
          { id: newStageId(), name: "Fechado", color: STAGE_COLORS[4], order: 2, type: "won" },
          { id: newStageId(), name: "Perdido", color: STAGE_COLORS[5], order: 3, type: "lost" },
        ]);
      }
    }
  }, [open, pipeline]);

  const addStage = () =>
    setStages((p) => [
      ...p,
      {
        id: newStageId(),
        name: "Nova etapa",
        color: STAGE_COLORS[p.length % STAGE_COLORS.length],
        order: p.length,
        type: "open",
      },
    ]);

  const removeStage = (id: string) => {
    const count = leadCountByStage[id] || 0;
    if (count > 0) {
      const ok = window.confirm(
        `Esta etapa contém ${count} lead${count > 1 ? "s" : ""}. Os leads ficarão sem etapa válida. Deseja continuar?`
      );
      if (!ok) return;
    }
    if (stages.length <= 2) {
      toast.error("Um pipeline precisa ter pelo menos 2 etapas.");
      return;
    }
    setStages((p) => p.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const move = (id: string, dir: -1 | 1) => {
    setStages((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next.map((s, i) => ({ ...s, order: i }));
    });
  };

  const updateStage = (id: string, patch: Partial<PipelineStage>) =>
    setStages((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const hasWon = stages.some((s) => s.type === "won");
  const hasLost = stages.some((s) => s.type === "lost");

  const handleSave = () => {
    if (!name.trim()) return toast.error("Informe o nome do pipeline");
    if (stages.length < 2) return toast.error("Pipeline precisa de pelo menos 2 etapas");
    if (stages.some((s) => !s.name.trim())) return toast.error("Todas as etapas precisam de nome");

    onSave({
      id: pipeline?.id,
      name: name.trim(),
      stages: stages.map((s, i) => ({ ...s, order: i })),
    });
    toast.success(isEdit ? "Pipeline atualizado" : "Pipeline criado");
    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!pipeline || pipeline.isDefault || !onDelete) return;
    const ok = window.confirm(`Excluir o pipeline "${pipeline.name}"? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    onDelete(pipeline.id);
    toast.success("Pipeline excluído");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEdit ? "Editar pipeline" : "Novo pipeline"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Configure as etapas do seu funil de vendas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Nome do pipeline*</Label>
            <Input
              placeholder="Ex.: Pipeline Branding"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-muted/50 border-border"
            />
          </div>

          <Separator className="bg-border" />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-foreground">Etapas</h4>
              <p className="text-xs text-muted-foreground">Arraste pelas setas para reordenar.</p>
            </div>
            <Button size="sm" variant="outline" onClick={addStage} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Adicionar etapa
            </Button>
          </div>

          {(!hasWon || !hasLost) && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md p-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Recomendado adicionar pelo menos uma etapa de fechamento{" "}
                {!hasWon && <strong>ganho</strong>}
                {!hasWon && !hasLost && " e "}
                {!hasLost && <strong>perdido</strong>}.
              </span>
            </div>
          )}

          <div className="space-y-2">
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="orbit-card p-3 flex items-center gap-2 flex-wrap"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => move(stage.id, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => move(stage.id, 1)}
                    disabled={idx === stages.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <Input
                  value={stage.name}
                  onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                  className="bg-muted/50 border-border flex-1 min-w-[120px]"
                  placeholder="Nome da etapa"
                />

                <Select
                  value={stage.type || "open"}
                  onValueChange={(v) => updateStage(stage.id, { type: v as StageType })}
                >
                  <SelectTrigger className="w-[120px] bg-muted/50 border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="won">Ganho</SelectItem>
                    <SelectItem value="lost">Perdido</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-1">
                  {STAGE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => updateStage(stage.id, { color: c })}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${
                        stage.color === c ? "border-foreground scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Cor ${c}`}
                    />
                  ))}
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive h-8 w-8"
                  onClick={() => removeStage(stage.id)}
                  aria-label="Remover etapa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <div>
            {isEdit && pipeline && !pipeline.isDefault && (
              <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                <Trash2 className="h-4 w-4" /> Excluir pipeline
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button className="orbit-gradient text-white border-0" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
