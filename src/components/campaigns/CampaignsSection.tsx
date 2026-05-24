import { useMemo, useState } from "react";
import { Megaphone, Plus, Send, ShieldCheck, Users, FileText, AlertTriangle, Check, X, Trash2, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  useCampaigns, Channel, CampaignObjective, ConsentStatus, ConsentSource,
  TemplateCategory, Campaign, AudienceSegment, MessageTemplate,
} from "@/hooks/useCampaigns";

const channelLabels: Record<Channel, string> = { whatsapp: "WhatsApp", email: "Email", sms: "SMS" };
const objectiveLabels: Record<CampaignObjective, string> = {
  nurture: "Nutrição", announcement: "Anúncio", follow_up: "Follow-up", launch: "Lançamento", reminder: "Lembrete", custom: "Personalizado",
};
const statusTone: Record<Campaign["status"], string> = {
  draft: "bg-muted text-muted-foreground", scheduled: "bg-primary/15 text-primary border border-primary/30",
  running: "bg-emerald-500/15 text-emerald-400", paused: "bg-amber-500/15 text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-400", canceled: "bg-destructive/15 text-destructive",
};
const consentTone: Record<ConsentStatus, string> = {
  opted_in: "bg-emerald-500/15 text-emerald-400",
  opted_out: "bg-destructive/15 text-destructive",
  unknown: "bg-amber-500/15 text-amber-400",
};
const templateTone: Record<MessageTemplate["status"], string> = {
  draft: "bg-muted text-muted-foreground", pending_approval: "bg-amber-500/15 text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-400", rejected: "bg-destructive/15 text-destructive",
};

export function CampaignsSection() {
  const c = useCampaigns();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [segOpen, setSegOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

  const metrics = useMemo(() => ({
    active: c.campaigns.filter((x) => x.status === "running" || x.status === "scheduled").length,
    optedIn: c.consents.filter((x) => x.consentStatus === "opted_in").length,
    approvedTemplates: c.templates.filter((x) => x.status === "approved").length,
    sent: c.campaigns.reduce((s, x) => s + x.sentCount, 0),
    replies: c.campaigns.reduce((s, x) => s + x.repliedCount, 0),
    optOuts: c.campaigns.reduce((s, x) => s + x.optOutCount, 0),
  }), [c.campaigns, c.consents, c.templates]);

  const replyRate = metrics.sent > 0 ? Math.round((metrics.replies / metrics.sent) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> Campanhas</h2>
            <p className="text-sm text-muted-foreground">Comunique-se com leads e clientes que autorizaram contato.</p>
          </div>
          <Button onClick={() => setWizardOpen(true)}><Plus className="h-4 w-4" /> Nova campanha</Button>
        </div>

        <Card className="mt-4 p-4 border-primary/30 bg-primary/5 flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Broadcast consentido</p>
            <p className="text-muted-foreground">Este módulo é uma preparação para campanhas consentidas. Nenhuma mensagem real é enviada nesta versão.</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Metric label="Ativas" value={metrics.active} />
        <Metric label="Opt-in" value={metrics.optedIn} />
        <Metric label="Templates ok" value={metrics.approvedTemplates} />
        <Metric label="Envios simulados" value={metrics.sent} />
        <Metric label="Resposta" value={`${replyRate}%`} />
        <Metric label="Opt-outs" value={metrics.optOuts} />
      </div>

      <Tabs defaultValue="campanhas" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="campanhas">Campanhas</TabsTrigger>
          <TabsTrigger value="segmentos">Segmentos</TabsTrigger>
          <TabsTrigger value="consentimentos">Consentimentos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="boas-praticas">Boas práticas</TabsTrigger>
        </TabsList>

        {/* CAMPANHAS */}
        <TabsContent value="campanhas" className="space-y-3">
          {c.campaigns.length === 0 && <EmptyHint icon={<Megaphone className="h-5 w-5" />} label="Nenhuma campanha ainda. Crie a primeira." />}
          <div className="grid lg:grid-cols-2 gap-4">
            {c.campaigns.map((cmp) => {
              const seg = c.segments.find((s) => s.id === cmp.audienceSegmentId);
              const tpl = c.templates.find((t) => t.id === cmp.templateId);
              return (
                <Card key={cmp.id} className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{cmp.name}</h3>
                        {cmp.isDemo && <Badge variant="outline" className="text-[10px]">demo</Badge>}
                        <span className={`text-[10px] px-2 py-0.5 rounded ${statusTone[cmp.status]}`}>{cmp.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {channelLabels[cmp.channel]} · {objectiveLabels[cmp.objective]} · {seg?.name ?? "—"} · {tpl?.name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <Mini label="Envios" value={cmp.sentCount} />
                    <Mini label="Entregues" value={cmp.deliveredCount} />
                    <Mini label="Respostas" value={cmp.repliedCount} />
                    <Mini label="Opt-outs" value={cmp.optOutCount} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!seg) return toast.error("Segmento não encontrado");
                        if (cmp.channel === "whatsapp" && tpl?.status !== "approved") return toast.error("Template WhatsApp precisa estar aprovado.");
                        if (seg.optedInContacts === 0) return toast.error("Segmento sem contatos com opt-in.");
                        c.simulateSend(cmp.id);
                        toast.success("Envio simulado. Nenhuma mensagem real foi enviada.");
                      }}
                    >
                      <Send className="h-3.5 w-3.5" /> Simular envio
                    </Button>
                    {!cmp.isDemo && (
                      <Button size="sm" variant="ghost" onClick={() => c.deleteCampaign(cmp.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* SEGMENTOS */}
        <TabsContent value="segmentos" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setSegOpen(true)}><Plus className="h-4 w-4" /> Novo segmento</Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {c.segments.map((s) => (
              <Card key={s.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{s.name}</h4>
                  {s.isDemo && <Badge variant="outline" className="text-[10px]">demo</Badge>}
                  <Badge variant="outline" className="text-[10px]">{channelLabels[s.channel]}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{s.description}</p>
                <div className="flex flex-wrap gap-1">{s.filters.map((f) => <span key={f} className="text-[10px] px-2 py-0.5 rounded bg-muted">{f}</span>)}</div>
                <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                  <Mini label="Estimados" value={s.estimatedContacts} />
                  <Mini label="Opt-in" value={s.optedInContacts} />
                  <Mini label="Opt-out" value={s.optedOutContacts} />
                </div>
                {!s.isDemo && (
                  <Button size="sm" variant="ghost" onClick={() => c.deleteSegment(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* CONSENTIMENTOS */}
        <TabsContent value="consentimentos" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setConsentOpen(true)}><Plus className="h-4 w-4" /> Registrar consentimento</Button>
          </div>
          <Card className="p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.consents.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.contactName}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">{r.consentText}</div>
                    </TableCell>
                    <TableCell>{channelLabels[r.channel]}</TableCell>
                    <TableCell><span className={`text-[10px] px-2 py-0.5 rounded ${consentTone[r.consentStatus]}`}>{r.consentStatus}</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.consentSource}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.consentDate).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => c.setConsentStatus(r.id, "opted_in")} title="Opt-in"><Check className="h-3.5 w-3.5 text-emerald-400" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => c.setConsentStatus(r.id, "opted_out")} title="Opt-out"><X className="h-3.5 w-3.5 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
          <p className="text-xs text-muted-foreground">Opt-out sempre prevalece. Contatos opted_out e unknown não recebem campanhas de marketing.</p>
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setTplOpen(true)}><Plus className="h-4 w-4" /> Novo template</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {c.templates.map((t) => (
              <Card key={t.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold">{t.name}</h4>
                  {t.isDemo && <Badge variant="outline" className="text-[10px]">demo</Badge>}
                  <Badge variant="outline" className="text-[10px]">{channelLabels[t.channel]}</Badge>
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${templateTone[t.status]}`}>{t.status}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap bg-muted/40 rounded p-2">{t.body}</p>
                {t.variables.length > 0 && (
                  <div className="flex gap-1 flex-wrap">{t.variables.map((v) => <span key={v} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">{`{{${v}}}`}</span>)}</div>
                )}
                <div className="flex gap-2">
                  {t.status !== "approved" && t.channel === "whatsapp" && (
                    <Button size="sm" variant="outline" onClick={() => { c.simulateApprove(t.id); toast.success("Aprovação simulada (mock)."); }}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Simular aprovação
                    </Button>
                  )}
                  {!t.isDemo && <Button size="sm" variant="ghost" onClick={() => c.deleteTemplate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* BOAS PRÁTICAS */}
        <TabsContent value="boas-praticas" className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            {[
              "Use apenas contatos com opt-in confirmado.",
              "Ofereça sempre uma saída clara (opt-out).",
              "Evite frequência excessiva — respeite a caixa do seu contato.",
              "Não compre listas frias de contatos.",
              "Não use WhatsApp Web não oficial para disparos.",
              "Para WhatsApp, use somente templates aprovados pela plataforma.",
              "Respeite LGPD, CAN-SPAM e políticas da Meta.",
              "Mantenha registros de consentimento auditáveis.",
            ].map((tip) => (
              <Card key={tip} className="p-4 flex items-start gap-3">
                <BookOpen className="h-4 w-4 text-primary mt-1 shrink-0" />
                <p className="text-sm">{tip}</p>
              </Card>
            ))}
          </div>
          <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Integrações oficiais futuras: WhatsApp Business Platform, provedores de email transacional/marketing, webhooks seguros,
              rate limiting, auditoria e logs de consentimento.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}
      <CampaignWizard open={wizardOpen} onOpenChange={setWizardOpen} c={c} />
      <SegmentDialog open={segOpen} onOpenChange={setSegOpen} c={c} />
      <TemplateDialog open={tplOpen} onOpenChange={setTplOpen} c={c} />
      <ConsentDialog open={consentOpen} onOpenChange={setConsentOpen} c={c} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5"><span>{label}</span><Users className="h-3.5 w-3.5" /></div>
      <p className="text-xl font-bold">{value}</p>
    </Card>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-muted/40 rounded p-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function EmptyHint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Card className="p-8 text-center text-sm text-muted-foreground">
      <div className="flex justify-center mb-2 text-primary">{icon}</div>
      {label}
    </Card>
  );
}

/* ----------------- Wizard ----------------- */
function CampaignWizard({ open, onOpenChange, c }: { open: boolean; onOpenChange: (v: boolean) => void; c: ReturnType<typeof useCampaigns> }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", channel: "whatsapp" as Channel, objective: "nurture" as CampaignObjective, audienceSegmentId: "", templateId: "" });
  const seg = c.segments.find((s) => s.id === form.audienceSegmentId);
  const tpl = c.templates.find((t) => t.id === form.templateId);

  const reset = () => { setStep(1); setForm({ name: "", channel: "whatsapp", objective: "nurture", audienceSegmentId: "", templateId: "" }); };
  const close = () => { onOpenChange(false); setTimeout(reset, 200); };

  const checklist = {
    optIn: !!seg && seg.optedInContacts > 0,
    optOut: true,
    templateApproved: form.channel !== "whatsapp" || tpl?.status === "approved",
    frequency: true,
    honest: true,
  };
  const allOk = Object.values(checklist).every(Boolean);

  const segOk = seg && seg.optedInContacts > 0 && seg.optedInContacts >= (seg.unknownContacts + seg.optedOutContacts);

  const save = (simulate: boolean) => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (!form.audienceSegmentId) return toast.error("Segmento obrigatório");
    if (!form.templateId) return toast.error("Template obrigatório");
    const id = c.addCampaign({ name: form.name, channel: form.channel, objective: form.objective, audienceSegmentId: form.audienceSegmentId, templateId: form.templateId });
    if (simulate) {
      if (!allOk) return toast.error("Conformidade insuficiente para simular envio.");
      c.simulateSend(id);
      toast.success("Campanha salva e envio simulado. Nenhuma mensagem real enviada.");
    } else {
      toast.success("Campanha salva como rascunho.");
    }
    close();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close(); else onOpenChange(true); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha — passo {step} de 4</DialogTitle>
          <DialogDescription>Campanhas só podem ser enviadas para contatos com consentimento.</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Lembrete de proposta" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Canal</Label>
                <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Channel })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(channelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Objetivo</Label>
                <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v as CampaignObjective })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(objectiveLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>Segmento</Label>
            <Select value={form.audienceSegmentId} onValueChange={(v) => setForm({ ...form, audienceSegmentId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar segmento" /></SelectTrigger>
              <SelectContent>
                {c.segments.filter((s) => s.channel === form.channel).map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name} ({s.optedInContacts} opt-in)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {seg && (
              <Card className="p-3 text-xs space-y-1">
                <div>Estimados: <strong>{seg.estimatedContacts}</strong></div>
                <div>Opt-in: <strong className="text-emerald-400">{seg.optedInContacts}</strong></div>
                <div>Opt-out: <strong className="text-destructive">{seg.optedOutContacts}</strong></div>
                <div>Unknown: <strong className="text-amber-400">{seg.unknownContacts}</strong></div>
                {!segOk && <p className="text-destructive pt-1">Segmento com muitos contatos sem opt-in. Refine antes de seguir.</p>}
              </Card>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <Label>Template</Label>
            <Select value={form.templateId} onValueChange={(v) => setForm({ ...form, templateId: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar template" /></SelectTrigger>
              <SelectContent>
                {c.templates.filter((t) => t.channel === form.channel).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name} ({t.status})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.channel === "whatsapp" && (
              <p className="text-xs text-amber-400">Mensagens iniciadas pela empresa exigem template aprovado pela plataforma.</p>
            )}
            {tpl && tpl.channel === "whatsapp" && tpl.status !== "approved" && (
              <p className="text-xs text-destructive">Template não aprovado — você pode salvar rascunho, mas não simular envio.</p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3 text-sm">
            <Card className="p-3 space-y-1">
              <div><span className="text-muted-foreground">Nome:</span> <strong>{form.name || "—"}</strong></div>
              <div><span className="text-muted-foreground">Canal:</span> {channelLabels[form.channel]}</div>
              <div><span className="text-muted-foreground">Objetivo:</span> {objectiveLabels[form.objective]}</div>
              <div><span className="text-muted-foreground">Segmento:</span> {seg?.name ?? "—"}</div>
              <div><span className="text-muted-foreground">Template:</span> {tpl?.name ?? "—"}</div>
            </Card>
            <div className="space-y-1.5">
              <ChecklistItem ok={checklist.optIn} label="Público com opt-in" />
              <ChecklistItem ok={checklist.optOut} label="Opt-out disponível" />
              <ChecklistItem ok={checklist.templateApproved} label="Template aprovado" />
              <ChecklistItem ok={checklist.frequency} label="Frequência razoável" />
              <ChecklistItem ok={checklist.honest} label="Sem linguagem enganosa" />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && <Button variant="ghost" onClick={() => setStep(step - 1)}>Voltar</Button>}
          {step < 4 && (
            <Button
              onClick={() => {
                if (step === 1 && !form.name.trim()) return toast.error("Nome obrigatório");
                if (step === 2 && (!form.audienceSegmentId || !segOk)) return toast.error("Selecione um segmento com opt-in suficiente.");
                if (step === 3 && !form.templateId) return toast.error("Selecione um template");
                setStep(step + 1);
              }}
            >
              Avançar
            </Button>
          )}
          {step === 4 && (
            <>
              <Button variant="outline" onClick={() => save(false)}>Salvar campanha</Button>
              <Button onClick={() => save(true)} disabled={!allOk}><Send className="h-4 w-4" /> Simular envio</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 text-destructive" />}
      <span className={ok ? "text-foreground" : "text-destructive"}>{label}</span>
    </div>
  );
}

/* ----------------- Segment Dialog ----------------- */
function SegmentDialog({ open, onOpenChange, c }: { open: boolean; onOpenChange: (v: boolean) => void; c: ReturnType<typeof useCampaigns> }) {
  const [form, setForm] = useState({ name: "", description: "", channel: "whatsapp" as Channel, filters: "status: lead" });
  const save = () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    c.addSegment({ name: form.name, description: form.description, channel: form.channel, filters: form.filters.split(",").map((f) => f.trim()).filter(Boolean) });
    toast.success("Segmento criado. Apenas contatos com opt-in serão considerados.");
    setForm({ name: "", description: "", channel: "whatsapp", filters: "status: lead" });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo segmento</DialogTitle><DialogDescription>Segmentos sempre exigem opt-in dos contatos.</DialogDescription></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal permitido</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Channel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(channelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Filtros (vírgula)</Label><Input value={form.filters} onChange={(e) => setForm({ ...form, filters: e.target.value })} /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Apenas contatos com opt-in: sempre ativo.</p>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------- Template Dialog ----------------- */
function TemplateDialog({ open, onOpenChange, c }: { open: boolean; onOpenChange: (v: boolean) => void; c: ReturnType<typeof useCampaigns> }) {
  const [form, setForm] = useState({ name: "", channel: "whatsapp" as Channel, category: "marketing" as TemplateCategory, body: "", variables: "" });
  const save = () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    if (!form.body.trim()) return toast.error("Corpo obrigatório");
    c.addTemplate({
      name: form.name, channel: form.channel, category: form.category, body: form.body,
      variables: form.variables.split(",").map((v) => v.trim()).filter(Boolean),
      status: form.channel === "whatsapp" ? "pending_approval" : "draft",
    });
    toast.success(form.channel === "whatsapp" ? "Template enviado para aprovação (mock)." : "Template salvo como rascunho.");
    setForm({ name: "", channel: "whatsapp", category: "marketing", body: "", variables: "" });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo template</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Channel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(channelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TemplateCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="reminder">Lembrete</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Corpo *</Label><Textarea rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Olá {{nome}}, ..." /></div>
          <div><Label>Variáveis (vírgula)</Label><Input value={form.variables} onChange={(e) => setForm({ ...form, variables: e.target.value })} placeholder="nome, servico" /></div>
          {form.channel === "whatsapp" && <p className="text-[11px] text-amber-400">WhatsApp inicia em pending_approval. Aprovação real ocorre via plataforma oficial.</p>}
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Criar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ----------------- Consent Dialog ----------------- */
function ConsentDialog({ open, onOpenChange, c }: { open: boolean; onOpenChange: (v: boolean) => void; c: ReturnType<typeof useCampaigns> }) {
  const [form, setForm] = useState({ contactName: "", channel: "whatsapp" as Channel, consentStatus: "opted_in" as ConsentStatus, consentSource: "manual" as ConsentSource, consentText: "" });
  const save = () => {
    if (!form.contactName.trim()) return toast.error("Nome do contato obrigatório");
    c.addConsent({ contactId: `ct-${Date.now()}`, ...form });
    toast.success("Consentimento registrado.");
    setForm({ contactName: "", channel: "whatsapp", consentStatus: "opted_in", consentSource: "manual", consentText: "" });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Registrar consentimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Contato *</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm({ ...form, channel: v as Channel })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(channelLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.consentStatus} onValueChange={(v) => setForm({ ...form, consentStatus: v as ConsentStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="opted_in">Opt-in</SelectItem>
                  <SelectItem value="opted_out">Opt-out</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fonte</Label>
              <Select value={form.consentSource} onValueChange={(v) => setForm({ ...form, consentSource: v as ConsentSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="form">Formulário</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="import">Importação</SelectItem>
                  <SelectItem value="checkout">Checkout</SelectItem>
                  <SelectItem value="public_page">Página pública</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Texto do consentimento</Label><Textarea rows={2} value={form.consentText} onChange={(e) => setForm({ ...form, consentText: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
