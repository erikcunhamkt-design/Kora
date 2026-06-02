import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Info, Lock, MessageSquare, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  TEMPLATE_VARIABLES,
  extractVariables,
  insertAtCursor,
  renderTemplatePreview,
} from "@/lib/whatsapp/templateVariables";
import type {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
} from "@/hooks/useWhatsAppTemplates";

interface NewTemplatePayload {
  name: string;
  category: WhatsAppTemplateCategory;
  language: string;
  body: string;
  variables: string[];
  cta?: { label: string; url: string } | null;
  notes?: string | null;
  status?: WhatsAppTemplateStatus;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: NewTemplatePayload) => void;
}

const categories: { value: WhatsAppTemplateCategory; label: string }[] = [
  { value: "marketing", label: "Marketing" },
  { value: "utility", label: "Utilidade" },
  { value: "authentication", label: "Autenticação" },
  { value: "service", label: "Atendimento" },
];

const languages = [
  { value: "pt_BR", label: "Português (Brasil)" },
  { value: "en_US", label: "Inglês (EUA)" },
  { value: "es_ES", label: "Espanhol (Espanha)" },
];

export function CreateTemplateDialog({ open, onOpenChange, onCreate }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<WhatsAppTemplateCategory>("marketing");
  const [language, setLanguage] = useState("pt_BR");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [notes, setNotes] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const detectedVariables = useMemo(() => extractVariables(body), [body]);
  const preview = useMemo(() => renderTemplatePreview(body), [body]);

  const reset = () => {
    setName(""); setCategory("marketing"); setLanguage("pt_BR");
    setBody(""); setCtaLabel(""); setCtaUrl(""); setNotes("");
  };

  const handleInsertVariable = (key: string) => {
    const insert = `{{${key}}}`;
    const { value, cursor } = insertAtCursor(textareaRef.current, body, insert);
    setBody(value);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  const handleSave = () => {
    if (!name.trim() || !body.trim()) {
      toast.warning("Preencha o nome e o corpo do template.");
      return;
    }
    onCreate({
      name: name.trim(),
      category,
      language,
      body: body.trim(),
      variables: detectedVariables,
      cta: ctaLabel && ctaUrl ? { label: ctaLabel.trim(), url: ctaUrl.trim() } : null,
      notes: notes.trim() || null,
      status: "draft",
    });
    toast.success("Rascunho salvo localmente.");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" /> Novo template do WhatsApp
          </DialogTitle>
          <DialogDescription>
            Templates precisam ser ativos antes de serem usados em campanhas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Coluna 1 — Form */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Nome interno</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Lembrete de proposta"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as WhatsAppTemplateCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Idioma</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {languages.map((l) => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tpl-body">Mensagem</Label>
                <span className="text-[10px] text-muted-foreground">{body.length}/1024</span>
              </div>
              <Textarea
                id="tpl-body"
                ref={textareaRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Olá, {{primeiro_nome}}! Temos uma novidade sobre {{serviço}}."
                className="min-h-32"
                maxLength={1024}
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => handleInsertVariable(v.key)}
                    className="text-[11px] px-2 py-1 rounded-md border border-border/60 bg-muted/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Botão / CTA (opcional)</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} placeholder="Rótulo (ex: Ver proposta)" />
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="URL ou {{link}}" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tpl-notes">Observações internas</Label>
              <Textarea
                id="tpl-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas para a equipe (não aparecem na mensagem)."
                className="min-h-20"
              />
            </div>
          </div>

          {/* Coluna 2 — Preview + avisos */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Preview do WhatsApp
                </span>
                <Badge variant="outline" className="text-[10px]">Rascunho</Badge>
              </div>
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3.5 py-3 space-y-2">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                  {preview || <span className="text-muted-foreground italic">A mensagem aparecerá aqui…</span>}
                </p>
                {ctaLabel && ctaUrl && (
                  <div className="pt-2 border-t border-emerald-500/15">
                    <span className="block text-center text-[12px] font-medium text-emerald-300">
                      {ctaLabel}
                    </span>
                  </div>
                )}
              </div>

              {detectedVariables.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Variáveis detectadas
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {detectedVariables.map((v) => (
                      <Badge key={v} variant="secondary" className="text-[10px]">{`{{${v}}}`}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-semibold uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5" /> Boas práticas
              </div>
              <ul className="text-[12px] text-muted-foreground space-y-1 leading-relaxed">
                <li>• Templates precisam ser ativos antes de campanhas.</li>
                <li>• Evite promessas agressivas, spam ou mensagens sem opt-in.</li>
                <li>• Use apenas contatos que deram permissão para receber mensagens.</li>
              </ul>
            </div>

            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 flex items-start gap-2">
              <Info className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                A integração oficial com a Meta (envio para aprovação) entra na próxima fase.
                Por enquanto você pode salvar rascunhos visuais.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button variant="outline" disabled className="gap-1.5 opacity-60 cursor-not-allowed">
                    <Lock className="h-3.5 w-3.5" /> Ativar modelo
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Integração oficial entra na próxima fase</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salvar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
