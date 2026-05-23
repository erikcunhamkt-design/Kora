import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePublicProfile } from "@/hooks/usePublicProfile";
import { useBioLinks } from "@/hooks/useBioLinks";
import { useLeadForms } from "@/hooks/useLeadForms";
import { useScheduling } from "@/hooks/useScheduling";
import { usePlan, PLAN_PRICE } from "@/contexts/PlanContext";
import { toast } from "sonner";
import { Copy, ExternalLink, Trash2, Plus, Crown, Check, Globe, Link as LinkIcon, FileText, Calendar } from "lucide-react";

export default function Presenca() {
  return (
    <div>
      <PageHeader
        title="Presença"
        subtitle="Página pública, link da bio, formulários, agendamento e assinatura"
      />
      <Tabs defaultValue="publica" className="w-full">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="publica"><Globe className="h-4 w-4 mr-1.5" />Página pública</TabsTrigger>
          <TabsTrigger value="bio"><LinkIcon className="h-4 w-4 mr-1.5" />Link da bio</TabsTrigger>
          <TabsTrigger value="forms"><FileText className="h-4 w-4 mr-1.5" />Formulários</TabsTrigger>
          <TabsTrigger value="agenda"><Calendar className="h-4 w-4 mr-1.5" />Agendamento</TabsTrigger>
          <TabsTrigger value="assinatura"><Crown className="h-4 w-4 mr-1.5" />Assinatura</TabsTrigger>
        </TabsList>

        <TabsContent value="publica"><PublicaSection /></TabsContent>
        <TabsContent value="bio"><BioSection /></TabsContent>
        <TabsContent value="forms"><FormsSection /></TabsContent>
        <TabsContent value="agenda"><AgendaSection /></TabsContent>
        <TabsContent value="assinatura"><AssinaturaSection /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ============== PÚBLICA ============== */
function PublicaSection() {
  const { profile, update } = usePublicProfile();
  const publicUrl = `${window.location.origin}/publico/${profile.slug}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="orbit-card p-6 space-y-4">
        <h3 className="font-semibold text-foreground">Configurar página pública</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome público"><Input value={profile.studioName} onChange={(e) => update({ studioName: e.target.value })} /></Field>
          <Field label="Slug"><Input value={profile.slug} onChange={(e) => update({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></Field>
        </div>
        <Field label="Título principal"><Input value={profile.headline} onChange={(e) => update({ headline: e.target.value })} /></Field>
        <Field label="Descrição"><Textarea rows={3} value={profile.description} onChange={(e) => update({ description: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Localização"><Input value={profile.location} onChange={(e) => update({ location: e.target.value })} /></Field>
          <Field label="Email"><Input value={profile.contactEmail} onChange={(e) => update({ contactEmail: e.target.value })} /></Field>
          <Field label="WhatsApp"><Input value={profile.whatsapp} onChange={(e) => update({ whatsapp: e.target.value })} /></Field>
          <Field label="Website"><Input value={profile.website} onChange={(e) => update({ website: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cor principal">
            <div className="flex gap-2 items-center">
              <input type="color" value={profile.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} className="h-10 w-12 rounded border border-border bg-transparent" />
              <Input value={profile.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} />
            </div>
          </Field>
          <Field label="Layout">
            <Select value={profile.layout} onValueChange={(v: "classic" | "premium") => update({ layout: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Clássico</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="space-y-2 pt-2">
          <ToggleRow label="Mostrar portfólio" checked={profile.showPortfolio} onChange={(v) => update({ showPortfolio: v })} />
          <ToggleRow label="Mostrar serviços" checked={profile.showServices} onChange={(v) => update({ showServices: v })} />
          <ToggleRow label="Mostrar depoimentos" checked={profile.showTestimonials} onChange={(v) => update({ showTestimonials: v })} />
          <ToggleRow label="Página publicada" checked={profile.published} onChange={(v) => update({ published: v })} />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success("Link copiado"); }}>
            <Copy className="h-4 w-4 mr-1.5" /> Copiar link
          </Button>
          <Button variant="outline" asChild>
            <a href={`/publico/${profile.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Abrir página
            </a>
          </Button>
        </div>
      </div>

      <div className="orbit-card p-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground flex items-center justify-between">
          <span>Preview</span>
          <Badge variant={profile.published ? "default" : "secondary"}>{profile.published ? "Publicada" : "Rascunho"}</Badge>
        </div>
        <div className="p-6 space-y-4" style={{ background: `linear-gradient(135deg, ${profile.primaryColor}11, transparent)` }}>
          <div className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${profile.primaryColor}22`, color: profile.primaryColor }}>
            {profile.studioName}
          </div>
          <h2 className="text-2xl font-bold text-foreground leading-tight">{profile.headline}</h2>
          <p className="text-sm text-muted-foreground">{profile.description}</p>
          <Button style={{ background: profile.primaryColor }} className="text-white border-0">Fale com o estúdio</Button>
          {profile.showServices && (
            <div className="pt-4">
              <p className="text-xs font-semibold text-foreground mb-2">Serviços</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {["Branding", "Web", "Conteúdo"].map((s) => <div key={s} className="orbit-card p-3 text-center">{s}</div>)}
              </div>
            </div>
          )}
          {profile.showPortfolio && (
            <div className="pt-2">
              <p className="text-xs font-semibold text-foreground mb-2">Portfólio</p>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => <div key={i} className="orbit-card aspect-square" />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============== BIO LINKS ============== */
function BioSection() {
  const { links, add, toggle, remove } = useBioLinks();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("link");

  const onSave = () => {
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    if (!url.trim()) { toast.error("URL obrigatória"); return; }
    add({ title: title.trim(), url: url.trim(), icon, active: true });
    setTitle(""); setUrl(""); setIcon("link"); setOpen(false);
    toast.success("Link adicionado");
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
      <div className="orbit-card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Links da bio</h3>
          <Button onClick={() => setOpen(true)} className="orbit-gradient text-white border-0"><Plus className="h-4 w-4 mr-1.5" />Novo link</Button>
        </div>
        {links.length === 0 && <p className="text-sm text-muted-foreground">Nenhum link cadastrado.</p>}
        {links.sort((a, b) => a.order - b.order).map((l) => (
          <div key={l.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-foreground truncate">{l.title}</p>
                {l.isDemo && <Badge variant="secondary" className="text-[10px]">demo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{l.url} · {l.clicks} cliques</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={l.active} onCheckedChange={() => toggle(l.id)} />
              <Button size="icon" variant="ghost" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>

      <div className="orbit-card p-0 overflow-hidden">
        <div className="px-4 py-2 border-b border-border text-xs text-muted-foreground">Preview mobile</div>
        <div className="p-4 bg-muted/30 min-h-[400px]">
          <div className="max-w-[280px] mx-auto bg-background rounded-3xl p-4 border border-border space-y-3">
            <div className="text-center py-3">
              <div className="h-16 w-16 mx-auto rounded-full orbit-gradient mb-2" />
              <p className="text-sm font-bold text-foreground">Orbyt Studio</p>
              <p className="text-[10px] text-muted-foreground">@orbyt.studio</p>
            </div>
            {links.filter((l) => l.active).sort((a, b) => a.order - b.order).map((l) => (
              <div key={l.id} className="w-full p-3 rounded-xl bg-muted text-center text-sm font-medium text-foreground border border-border">
                {l.title}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo link</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Título *"><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="URL *"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
            <Field label="Ícone">
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="message">WhatsApp</SelectItem>
                  <SelectItem value="briefcase">Portfólio</SelectItem>
                  <SelectItem value="sparkles">Serviços</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onSave} className="orbit-gradient text-white border-0">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== FORMS ============== */
function FormsSection() {
  const { forms, add, toggle, submit } = useLeadForms();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const onCreate = () => {
    if (!name.trim()) { toast.error("Nome obrigatório"); return; }
    add({ name: name.trim(), description: desc.trim(), active: true });
    setName(""); setDesc(""); setOpen(false);
    toast.success("Formulário criado");
  };

  const previewForm = forms.find((f) => f.id === preview);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)} className="orbit-gradient text-white border-0"><Plus className="h-4 w-4 mr-1.5" />Novo formulário</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forms.map((f) => (
          <div key={f.id} className="orbit-card p-5 space-y-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-foreground truncate">{f.name}</h4>
                  {f.isDemo && <Badge variant="secondary" className="text-[10px]">demo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{f.description}</p>
              </div>
              <Switch checked={f.active} onCheckedChange={() => toggle(f.id)} />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{f.submissions} respostas</span>
              <span>{f.fields.length} campos</span>
            </div>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setPreview(f.id)}>Preview</Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo formulário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nome *"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Descrição"><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={onCreate} className="orbit-gradient text-white border-0">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!preview} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{previewForm?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {previewForm?.fields.map((field) => (
              <Field key={field.id} label={field.label + (field.required ? " *" : "")}>
                {field.type === "textarea"
                  ? <Textarea rows={3} />
                  : <Input type={field.type === "email" ? "email" : "text"} />}
              </Field>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreview(null)}>Fechar</Button>
            <Button className="orbit-gradient text-white border-0" onClick={() => {
              if (previewForm) submit(previewForm.id);
              toast.success("Lead capturado de forma simulada");
              setPreview(null);
            }}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== AGENDA ============== */
function AgendaSection() {
  const { meetingTypes, appointments, addMeetingType, addAppointment } = useScheduling();
  const [openType, setOpenType] = useState(false);
  const [openBook, setOpenBook] = useState(false);

  // new type fields
  const [tName, setTName] = useState("");
  const [tDur, setTDur] = useState("30");
  const [tDesc, setTDesc] = useState("");
  const [tColor, setTColor] = useState("#F81040");

  // booking fields
  const [bTypeId, setBTypeId] = useState("");
  const [bName, setBName] = useState("");
  const [bEmail, setBEmail] = useState("");
  const [bPhone, setBPhone] = useState("");
  const [bDate, setBDate] = useState("");
  const [bTime, setBTime] = useState("");

  const createType = () => {
    if (!tName.trim()) { toast.error("Nome obrigatório"); return; }
    addMeetingType({ name: tName.trim(), durationMinutes: parseInt(tDur) || 30, description: tDesc.trim(), color: tColor, active: true });
    setTName(""); setTDur("30"); setTDesc(""); setOpenType(false);
    toast.success("Tipo de reunião criado");
  };

  const createBooking = () => {
    if (!bTypeId || !bName.trim() || !bDate || !bTime) { toast.error("Preencha os campos obrigatórios"); return; }
    addAppointment({ meetingTypeId: bTypeId, name: bName.trim(), email: bEmail.trim(), phone: bPhone.trim(), date: bDate, time: bTime });
    setBTypeId(""); setBName(""); setBEmail(""); setBPhone(""); setBDate(""); setBTime(""); setOpenBook(false);
    toast.success("Agendamento simulado criado");
  };

  return (
    <div className="space-y-6">
      <div className="orbit-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Tipos de reunião</h3>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpenBook(true)}><Plus className="h-4 w-4 mr-1.5" />Simular agendamento</Button>
            <Button onClick={() => setOpenType(true)} className="orbit-gradient text-white border-0"><Plus className="h-4 w-4 mr-1.5" />Novo tipo</Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {meetingTypes.map((m) => (
            <div key={m.id} className="orbit-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ background: m.color }} />
                <p className="font-medium text-foreground truncate flex-1">{m.name}</p>
                {m.isDemo && <Badge variant="secondary" className="text-[10px]">demo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{m.description}</p>
              <p className="text-xs text-primary">{m.durationMinutes} min</p>
            </div>
          ))}
        </div>
      </div>

      <div className="orbit-card p-6">
        <h3 className="font-semibold text-foreground mb-4">Agendamentos</h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento.</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((a) => {
              const t = meetingTypes.find((m) => m.id === a.meetingTypeId);
              return (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{a.name}</p>
                      {a.isDemo && <Badge variant="secondary" className="text-[10px]">demo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{t?.name || "—"} · {a.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-foreground">{a.date}</p>
                    <p className="text-xs text-muted-foreground">{a.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={openType} onOpenChange={setOpenType}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo tipo de reunião</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Nome *"><Input value={tName} onChange={(e) => setTName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duração (min)"><Input type="number" value={tDur} onChange={(e) => setTDur(e.target.value)} /></Field>
              <Field label="Cor"><Input type="color" value={tColor} onChange={(e) => setTColor(e.target.value)} className="h-10" /></Field>
            </div>
            <Field label="Descrição"><Textarea rows={3} value={tDesc} onChange={(e) => setTDesc(e.target.value)} /></Field>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenType(false)}>Cancelar</Button>
            <Button onClick={createType} className="orbit-gradient text-white border-0">Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openBook} onOpenChange={setOpenBook}>
        <DialogContent>
          <DialogHeader><DialogTitle>Simular agendamento</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Tipo *">
              <Select value={bTypeId} onValueChange={setBTypeId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {meetingTypes.filter((m) => m.active).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nome *"><Input value={bName} onChange={(e) => setBName(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><Input type="email" value={bEmail} onChange={(e) => setBEmail(e.target.value)} /></Field>
              <Field label="WhatsApp"><Input value={bPhone} onChange={(e) => setBPhone(e.target.value)} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data *"><Input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} /></Field>
              <Field label="Horário *"><Input type="time" value={bTime} onChange={(e) => setBTime(e.target.value)} /></Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenBook(false)}>Cancelar</Button>
            <Button onClick={createBooking} className="orbit-gradient text-white border-0">Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== ASSINATURA ============== */
function AssinaturaSection() {
  const { plan, isPro, limits, usage } = usePlan();
  const [upgrade, setUpgrade] = useState(false);

  const plans = [
    { id: "free", name: "Free", price: "R$ 0", features: ["1 cliente", "3 tarefas", "1 lead no CRM", "Recursos básicos"] },
    { id: "pro", name: "Pro", price: PLAN_PRICE, features: ["Clientes ilimitados", "Tarefas ilimitadas", "CRM completo", "Financeiro completo"], highlight: true },
    { id: "studio", name: "Studio", price: "R$ 99,99", features: ["Tudo do Pro", "Multi-usuários (em breve)", "IA avançada (em breve)", "Suporte prioritário"] },
  ];

  return (
    <div className="space-y-6">
      <div className="orbit-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Plano atual</p>
            <p className="text-2xl font-bold text-foreground capitalize">{plan}</p>
            <p className="text-xs text-muted-foreground mt-1">{isPro ? "Próxima cobrança simulada em 30 dias" : "Sem cobrança ativa"}</p>
          </div>
          <Badge className={isPro ? "orbit-gradient text-white border-0" : ""} variant={isPro ? "default" : "secondary"}>
            {isPro ? "Pro" : "Free"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          {(["clients", "projects", "tasks", "leads"] as const).map((k) => (
            <div key={k} className="p-3 rounded-lg bg-muted/40 border border-border">
              <p className="text-xs text-muted-foreground capitalize">{k}</p>
              <p className="text-lg font-bold text-foreground">
                {usage[k]} / {limits[`max${k[0].toUpperCase() + k.slice(1)}` as keyof typeof limits] === Infinity ? "∞" : limits[`max${k[0].toUpperCase() + k.slice(1)}` as keyof typeof limits]}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const current = (p.id === "pro" && isPro) || (p.id === "free" && !isPro);
          return (
            <div key={p.id} className={`orbit-card p-6 space-y-3 ${p.highlight ? "border-primary/40" : ""}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground">{p.name}</h4>
                {p.highlight && <Crown className="h-4 w-4 text-primary" />}
              </div>
              <p className="text-2xl font-bold text-foreground">{p.price}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
              <ul className="space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              {current ? (
                <Button disabled variant="outline" className="w-full">Plano atual</Button>
              ) : (
                <Button onClick={() => setUpgrade(true)} className="w-full orbit-gradient text-white border-0">Fazer upgrade</Button>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={upgrade} onOpenChange={setUpgrade}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upgrade simulado</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta é uma simulação. O checkout real será implementado futuramente.
          </p>
          <DialogFooter>
            <Button onClick={() => { toast.info("Checkout real será implementado futuramente."); setUpgrade(false); }} className="orbit-gradient text-white border-0">Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============== HELPERS ============== */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
