import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, GripVertical } from "lucide-react";
import type { BriefingTemplate, BriefingField, BriefingFieldType } from "@/hooks/useBriefingTemplates";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: BriefingTemplate | null;
  onSave: (data: Omit<BriefingTemplate, "id" | "isDemo">) => void;
}

const fieldTypeLabel: Record<BriefingFieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  select: "Múltipla escolha",
  number: "Número",
  url: "Link/URL",
  date: "Data",
};

export function BriefingTemplateDialog({ open, onOpenChange, template, onSave }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<BriefingField[]>([]);

  useEffect(() => {
    if (open) {
      setName(template?.name ?? "");
      setCategory(template?.category ?? "");
      setDescription(template?.description ?? "");
      setFields(template?.fields ?? [{ id: `fld-${Date.now()}`, label: "", type: "text" }]);
    }
  }, [open, template]);

  const addField = () => {
    setFields((prev) => [...prev, { id: `fld-${Date.now()}-${prev.length}`, label: "", type: "text" }]);
  };

  const updateField = (id: string, patch: Partial<BriefingField>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  };

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const cleaned = fields.filter((f) => f.label.trim());
    if (cleaned.length === 0) return;
    onSave({ name: name.trim(), category: category.trim() || undefined, description: description.trim() || undefined, fields: cleaned });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar template" : "Novo template de briefing"}</DialogTitle>
          <DialogDescription>
            Defina perguntas reutilizáveis para enviar aos clientes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nome do template *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Briefing de Branding" />
            </div>
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Branding, Social, Web..." />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Para que serve este briefing?" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Perguntas</Label>
              <Button type="button" size="sm" variant="outline" onClick={addField}>
                <Plus className="h-4 w-4 mr-1" /> Adicionar pergunta
              </Button>
            </div>

            <div className="space-y-2">
              {fields.map((field, idx) => (
                <div key={field.id} className="border border-border/60 bg-secondary/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <GripVertical className="h-4 w-4 text-muted-foreground mt-2.5 shrink-0" />
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr,180px] gap-2">
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        placeholder={`Pergunta ${idx + 1}`}
                      />
                      <Select value={field.type} onValueChange={(v) => updateField(field.id, { type: v as BriefingFieldType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(fieldTypeLabel).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeField(field.id)} disabled={fields.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {field.type === "select" && (
                    <Input
                      value={(field.options ?? []).join(", ")}
                      onChange={(e) => updateField(field.id, { options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                      placeholder="Opções separadas por vírgula"
                      className="ml-6"
                    />
                  )}

                  <div className="flex items-center gap-2 ml-6">
                    <Checkbox
                      id={`req-${field.id}`}
                      checked={!!field.required}
                      onCheckedChange={(v) => updateField(field.id, { required: !!v })}
                    />
                    <Label htmlFor={`req-${field.id}`} className="text-xs cursor-pointer">Obrigatória</Label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>Salvar template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
