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

          <div className="space-y-1.5">
            {stages.map((stage, idx) => (
              <div
                key={stage.id}
                className="group rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors p-2 flex items-center gap-2"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />

                <div className="flex flex-col">
                  <button
                    onClick={() => move(stage.id, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30 p-0.5"
                    aria-label="Mover para cima"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => move(stage.id, 1)}
                    disabled={idx === stages.length - 1}
                    className="text-muted-foreground/70 hover:text-foreground disabled:opacity-30 p-0.5"
                    aria-label="Mover para baixo"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="h-7 w-7 rounded-md border border-border shrink-0 hover:scale-105 transition-transform"
                      style={{ backgroundColor: stage.color }}
                      aria-label="Escolher cor"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2 bg-card border-border" align="start">
                    <div className="grid grid-cols-5 gap-1.5">
                      {STAGE_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateStage(stage.id, { color: c })}
                          className={`h-6 w-6 rounded-md border-2 transition-transform ${
                            stage.color === c ? "border-foreground scale-110" : "border-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: c }}
                          aria-label={`Cor ${c}`}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Input
                  value={stage.name}
                  onChange={(e) => updateStage(stage.id, { name: e.target.value })}
                  className="bg-card border-border h-8 flex-1 min-w-[120px] text-[13px]"
                  placeholder="Nome da etapa"
                />

                <Select
                  value={stage.type || "open"}
                  onValueChange={(v) => updateStage(stage.id, { type: v as StageType })}
                >
                  <SelectTrigger className="w-[100px] h-8 bg-card border-border text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberta</SelectItem>
                    <SelectItem value="won">Ganho</SelectItem>
                    <SelectItem value="lost">Perdido</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  size="icon"
                  variant="ghost"
                  className="text-muted-foreground/60 hover:text-destructive h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeStage(stage.id)}
                  aria-label="Remover etapa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {stages.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/10 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mb-1.5">Preview do funil</p>
              <div className="flex items-center gap-1 overflow-x-auto">
                {stages.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-1 shrink-0">
                    <div
                      className="px-2 py-1 rounded text-[11px] font-medium text-foreground"
                      style={{ background: `${s.color}22`, border: `1px solid ${s.color}55` }}
                    >
                      {s.name || "—"}
                    </div>
                    {i < stages.length - 1 && <span className="text-muted-foreground/40">›</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
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
