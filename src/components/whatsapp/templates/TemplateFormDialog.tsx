import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createTemplate,
  updateTemplate,
  renderTemplatePreview,
  type WhatsAppTemplate,
  type TemplateCategory,
} from "@/lib/whatsapp/repositories/whatsappTemplatesRepository";

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  template: WhatsAppTemplate | null;
  onSaved: () => void;
}

const CATEGORIES: TemplateCategory[] = ["marketing", "utility", "authentication", "service"];

function extractVars(body: string): string[] {
  const matches = body.match(/\{\{\s*([\w_]+)\s*\}\}/g) ?? [];
  return Array.from(new Set(matches.map((m) => m.replace(/[{}\s]/g, ""))));
}

export function TemplateFormDialog({ open, onClose, workspaceId, template, onSaved }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("marketing");
  const [language, setLanguage] = useState("pt_BR");
  const [body, setBody] = useState("");
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategory((template.category as TemplateCategory) ?? "marketing");
      setLanguage(template.language ?? "pt_BR");
      setBody(template.body);
      setSampleValues((template.sample_values ?? {}) as Record<string, string>);
    } else {
      setName("");
      setCategory("marketing");
      setLanguage("pt_BR");
      setBody("");
      setSampleValues({});
    }
  }, [template, open]);

  const variables = useMemo(() => extractVars(body), [body]);
  const preview = renderTemplatePreview(body, sampleValues);

  const handleSubmit = async () => {
    if (!name.trim() || !body.trim()) {
      toast.error("Nome e corpo são obrigatórios");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        category,
        language,
        body: body.trim(),
        variables,
        sampleValues,
      };
      if (template) {
        await updateTemplate(workspaceId, template.id, payload);
      } else {
        await createTemplate(workspaceId, payload);
      }
      toast.success(template ? "Template atualizado" : "Template criado");
      onSaved();
    } catch (e) {
      toast.error("Falha ao salvar", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? "Editar template" : "Novo template"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Nome*</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Categoria*</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as TemplateCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt_BR">pt_BR</SelectItem>
                    <SelectItem value="en">en</SelectItem>
                    <SelectItem value="es">es</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Corpo*</Label>
              <Textarea
                rows={8}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Olá {{nome}}, sua proposta {{servico}} está pronta!"
                className="font-mono text-xs"
                maxLength={1024}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use {`{{variavel}}`} para placeholders.
              </p>
            </div>

            {variables.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">Variáveis detectadas</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {variables.map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px]">
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-2">
                  {variables.map((v) => (
                    <div key={v} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono w-24 text-muted-foreground">{v}</span>
                      <Input
                        value={sampleValues[v] ?? ""}
                        onChange={(e) =>
                          setSampleValues((s) => ({ ...s, [v]: e.target.value }))
                        }
                        placeholder="valor de exemplo"
                        className="h-7 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label className="text-xs">Preview</Label>
            <div className="rounded-md bg-success/5 border border-success/20 p-4 text-xs whitespace-pre-wrap font-mono min-h-[200px]">
              {preview || <span className="text-muted-foreground">Digite o corpo para ver o preview</span>}
            </div>
            <div className="rounded-md bg-card/40 border border-border/40 p-3 text-[11px] text-muted-foreground">
              <strong className="text-foreground">Importante:</strong> O status real depende da
              aprovação na sua conta WhatsApp Business. Nesta fase, transições são manuais.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
            {template ? "Salvar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
