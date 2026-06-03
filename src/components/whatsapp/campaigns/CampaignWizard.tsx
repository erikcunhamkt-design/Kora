import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  createCampaign,
  prepareCampaignRecipients,
} from "@/lib/whatsapp/repositories/whatsappCampaignsRepository";
import {
  listAudiences,
  type WhatsAppAudience,
} from "@/lib/whatsapp/repositories/whatsappAudiencesRepository";
import {
  listTemplates,
  renderTemplatePreview,
  type WhatsAppTemplate,
} from "@/lib/whatsapp/repositories/whatsappTemplatesRepository";

interface Props {
  open: boolean;
  workspaceId: string;
  onClose: () => void;
  onCreated: () => void;
}

type Step = 1 | 2 | 3 | 4;

export function CampaignWizard({ open, workspaceId, onClose, onCreated }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [objective, setObjective] = useState("");
  const [audiences, setAudiences] = useState<WhatsAppAudience[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [audienceId, setAudienceId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([listAudiences(workspaceId), listTemplates(workspaceId)])
      .then(([a, t]) => {
        setAudiences(a.filter((x) => !x.archived));
        setTemplates(t);
      })
      .catch((e) => toast.error("Falha ao carregar dados", { description: (e as Error).message }))
      .finally(() => setLoading(false));
  }, [open, workspaceId]);

  const reset = () => {
    setStep(1);
    setName("");
    setObjective("");
    setAudienceId("");
    setTemplateId("");
  };

  const audience = useMemo(() => audiences.find((a) => a.id === audienceId) ?? null, [audiences, audienceId]);
  const template = useMemo(() => templates.find((t) => t.id === templateId) ?? null, [templates, templateId]);
  // Modelos enviáveis: "Ativo" (approved) — modelos não arquivados/deletados/vazios.
  const activeTemplates = templates.filter(
    (t) => t.status === "approved" && !t.deleted_at && (t.body ?? "").trim().length > 0,
  );

  const canNext = (() => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return Boolean(audienceId);
    if (step === 3) return Boolean(templateId) && activeTemplates.some((t) => t.id === templateId);
    return true;
  })();

  const handleCreate = async () => {
    if (!audienceId || !templateId) return;
    setSubmitting(true);
    try {
      const campaign = await createCampaign(workspaceId, {
        name: name.trim(),
        objective: objective.trim() || null,
        audienceId,
        templateId,
      });
      const summary = await prepareCampaignRecipients(workspaceId, campaign.id, audienceId);
      toast.success(`Campanha criada: ${summary.valid} válidos, ${summary.skipped} ignorados`);
      reset();
      onCreated();
    } catch (e) {
      toast.error("Falha ao criar campanha", { description: (e as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && (reset(), onClose())}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
        </DialogHeader>

        <Stepper step={step} />

        <div className="min-h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : step === 1 ? (
            <div className="space-y-3">
              <div>
                <Label>Nome*</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div>
                <Label>Objetivo</Label>
                <Textarea
                  rows={3}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  maxLength={300}
                  placeholder="Ex.: Reativar clientes inativos com promoção de fim de mês"
                />
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-3">
              <Label>Selecione a audiência*</Label>
              {audiences.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhuma audiência disponível. Crie uma primeiro na aba Audiências.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {audiences.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAudienceId(a.id)}
                      className={`w-full text-left rounded-md border p-3 transition ${
                        audienceId === a.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{a.name}</span>
                        <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                      </div>
                      <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span>Total: <strong className="text-foreground">{a.total_contacts}</strong></span>
                        <span className="text-success">Válidos: {a.valid_contacts}</span>
                        <span className="text-destructive">Inválidos: {a.invalid_contacts}</span>
                        <span className="text-warning">Dup: {a.duplicate_contacts}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : step === 3 ? (
            <div className="space-y-3">
              <Label>Selecione um modelo de mensagem ativo*</Label>
              {activeTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Nenhum modelo ativo. Crie um modelo na aba Modelos de Mensagem e ative-o.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
                  {activeTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTemplateId(t.id)}
                      className={`text-left rounded-md border p-3 transition ${
                        templateId === t.id
                          ? "border-primary bg-primary/5"
                          : "border-border/50 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{t.name}</span>
                        <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/30">
                          ativo
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-3 whitespace-pre-wrap font-mono">
                        {renderTemplatePreview(t.body, (t.sample_values ?? {}) as Record<string, string>)}
                      </p>
                    </button>
                  ))}
                </div>
              )}
              <div className="rounded-md bg-muted/30 border border-border/40 p-3 text-[11px] flex gap-2 text-muted-foreground">
                <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <p>
                  Texto livre <strong>não é permitido</strong> em campanhas para audiências. Selecione
                  um modelo de mensagem ativo da biblioteca.
                </p>
              </div>
            </div>
          ) : (
            // step 4
            <div className="space-y-4">
              <div className="rounded-md border border-border/50 p-4 space-y-2 text-sm">
                <Row label="Nome" value={name} />
                <Row label="Objetivo" value={objective || "—"} />
                <Row label="Audiência" value={audience?.name ?? "—"} />
                <Row label="Total contatos" value={String(audience?.total_contacts ?? 0)} />
                <Row label="Válidos esperados" value={String(audience?.valid_contacts ?? 0)} tone="success" />
                <Row label="Serão ignorados" value={String((audience?.invalid_contacts ?? 0) + (audience?.duplicate_contacts ?? 0))} tone="warning" />
                <Row label="Modelo" value={template?.name ?? "—"} />
              </div>

              <div className="rounded-md bg-warning/10 border border-warning/30 p-3 text-xs flex gap-2">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-muted-foreground space-y-1">
                  <p>
                    Contatos opt-out, inválidos e duplicados serão automaticamente marcados como
                    <strong> skipped</strong>. Garanta opt-in dos demais antes de enviar.
                  </p>
                  <p>
                    <strong>Atenção:</strong> o envio de mensagens em massa pelo WhatsApp pode gerar
                    bloqueios, restrições ou banimento do número caso os contatos não tenham
                    autorizado o recebimento ou denunciem a conversa. A KORA fornece a ferramenta
                    de organização e envio, mas a responsabilidade pelo uso, pela lista de contatos,
                    pelo consentimento e pelo conteúdo enviado é do usuário.
                  </p>
                </div>
              </div>

              {template && (
                <div className="rounded-md bg-success/5 border border-success/20 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
                    Preview da mensagem
                  </p>
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {renderTemplatePreview(template.body, (template.sample_values ?? {}) as Record<string, string>)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex sm:justify-between gap-2">
          <Button
            variant="ghost"
            disabled={step === 1 || submitting}
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            <ChevronLeft className="h-3 w-3 mr-1" /> Voltar
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => (reset(), onClose())} disabled={submitting}>
              Cancelar
            </Button>
            {step < 4 ? (
              <Button disabled={!canNext} onClick={() => setStep((s) => (s + 1) as Step)}>
                Avançar <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            ) : (
              <>
                <Button onClick={handleCreate} disabled={submitting || !canNext} className="gap-2">
                  {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                  <CheckCircle2 className="h-3.5 w-3.5" /> Criar campanha
                </Button>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span>
                        <Button disabled className="gap-2">
                          <Lock className="h-3 w-3" /> Enviar agora
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Envio real entra na próxima fase.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: Step }) {
  const labels = ["Dados", "Público", "Mensagem", "Revisão"];
  return (
    <div className="flex items-center gap-2 my-4">
      {labels.map((label, idx) => {
        const n = (idx + 1) as Step;
        const active = step === n;
        const done = step > n;
        return (
          <div key={label} className="flex items-center flex-1">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                done
                  ? "bg-success text-success-foreground"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {done ? "✓" : n}
            </div>
            <span className={`text-xs ml-2 ${active ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              {label}
            </span>
            {idx < labels.length - 1 && (
              <div className={`flex-1 h-px mx-2 ${done ? "bg-success" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "warning" }) {
  const color = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${color}`}>{value}</span>
    </div>
  );
}
