import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Plus, FileText, Link2, Send, MoreHorizontal, Copy, Trash2, Pencil,
  CheckCircle2, Clock, FileQuestion, Search, Archive, ExternalLink, Info,
} from "lucide-react";
import { useBriefings, type Briefing, type BriefingStatus } from "@/hooks/useBriefings";
import { useBriefingTemplates, type BriefingTemplate } from "@/hooks/useBriefingTemplates";
import { BriefingTemplateDialog } from "@/components/briefings/BriefingTemplateDialog";
import { BriefingCreateDialog } from "@/components/briefings/BriefingCreateDialog";
import { toast } from "@/hooks/use-toast";

const statusMeta: Record<BriefingStatus, { label: string; cls: string; icon: typeof Clock }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground border-border", icon: FileQuestion },
  enviado: { label: "Enviado", cls: "bg-primary/10 text-primary border-primary/30", icon: Send },
  respondido: { label: "Respondido", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30", icon: CheckCircle2 },
  arquivado: { label: "Arquivado", cls: "bg-muted/60 text-muted-foreground border-border", icon: Archive },
};

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function Briefings() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "briefings";
  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set("tab", t);
    setParams(next, { replace: true });
  };

  const { briefings, addBriefing, updateBriefing, removeBriefing, markSent } = useBriefings();
  const { templates, addTemplate, updateTemplate, removeTemplate, duplicateTemplate } = useBriefingTemplates();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [defaultTplId, setDefaultTplId] = useState<string | undefined>();
  const [tplOpen, setTplOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<BriefingTemplate | null>(null);
  const [viewBriefing, setViewBriefing] = useState<Briefing | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return briefings;
    return briefings.filter((b) =>
      b.clientName.toLowerCase().includes(q) ||
      b.templateName.toLowerCase().includes(q) ||
      (b.projectName ?? "").toLowerCase().includes(q),
    );
  }, [briefings, search]);

  const stats = useMemo(() => ({
    total: briefings.length,
    enviados: briefings.filter((b) => b.status === "enviado").length,
    respondidos: briefings.filter((b) => b.status === "respondido").length,
    rascunhos: briefings.filter((b) => b.status === "rascunho").length,
  }), [briefings]);

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/briefing/${token}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado", description: "Compartilhe com o cliente." });
  };

  const handleSend = (b: Briefing) => {
    markSent(b.id);
    copyLink(b.publicToken);
    toast({ title: "Briefing enviado", description: `Link copiado. Compartilhe com ${b.clientName}.` });
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageHeader
        title="Briefings"
        subtitle="Colete informações dos clientes com formulários personalizados."
        actions={
          <>
            <Button variant="outline" onClick={() => { setEditingTpl(null); setTplOpen(true); }}>
              <FileText className="h-4 w-4 mr-2" /> Novo template
            </Button>
            <Button onClick={() => { setDefaultTplId(undefined); setCreateOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> Novo briefing
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: FileText, accent: "text-foreground" },
          { label: "Rascunhos", value: stats.rascunhos, icon: FileQuestion, accent: "text-muted-foreground" },
          { label: "Enviados", value: stats.enviados, icon: Send, accent: "text-primary" },
          { label: "Respondidos", value: stats.respondidos, icon: CheckCircle2, accent: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
              </div>
              <s.icon className={`h-5 w-5 ${s.accent}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="briefings">Briefings</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="briefings" className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por cliente, template ou projeto" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-14 text-center space-y-3">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Nenhum briefing ainda</p>
                  <p className="text-sm text-muted-foreground">Crie a partir de um template para começar.</p>
                </div>
                <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo briefing</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filtered.map((b) => {
                const meta = statusMeta[b.status];
                const StatusIcon = meta.icon;
                return (
                  <Card key={b.id} className="hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setViewBriefing(b)}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{b.clientName}</CardTitle>
                          <CardDescription className="text-xs truncate mt-0.5">
                            {b.templateName}{b.projectName ? ` • ${b.projectName}` : ""}
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenuItem onClick={() => copyLink(b.publicToken)}>
                              <Copy className="h-4 w-4 mr-2" /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(`/briefing/${b.publicToken}`, "_blank")}>
                              <ExternalLink className="h-4 w-4 mr-2" /> Abrir como cliente
                            </DropdownMenuItem>
                            {b.status === "rascunho" && (
                              <DropdownMenuItem onClick={() => handleSend(b)}>
                                <Send className="h-4 w-4 mr-2" /> Marcar como enviado
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateBriefing(b.id, { status: "arquivado" })}>
                              <Archive className="h-4 w-4 mr-2" /> Arquivar
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => removeBriefing(b.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs">
                        <Badge variant="outline" className={meta.cls}>
                          <StatusIcon className="h-3 w-3 mr-1" /> {meta.label}
                        </Badge>
                        <span className="text-muted-foreground">{formatDate(b.sentAt ?? b.createdAt)}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {templates.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{t.name}</CardTitle>
                      <CardDescription className="text-xs truncate mt-0.5">
                        {t.category ?? "Sem categoria"} • {t.fields.length} pergunta{t.fields.length === 1 ? "" : "s"}
                      </CardDescription>
                    </div>
                    {t.isDemo && <Badge variant="outline" className="text-[0.65rem]">Demo</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => { setDefaultTplId(t.id); setCreateOpen(true); }}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Usar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingTpl(t); setTplOpen(true); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicateTemplate(t.id)}>
                      <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                    </Button>
                    {!t.isDemo && (
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <BriefingCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        templates={templates}
        defaultTemplateId={defaultTplId}
        onCreate={(data) => {
          const b = addBriefing(data);
          toast({ title: "Briefing criado", description: `Link gerado para ${b.clientName}.` });
        }}
      />

      <BriefingTemplateDialog
        open={tplOpen}
        onOpenChange={setTplOpen}
        template={editingTpl}
        onSave={(data) => {
          if (editingTpl) {
            updateTemplate(editingTpl.id, data);
            toast({ title: "Template atualizado" });
          } else {
            addTemplate(data);
            toast({ title: "Template criado" });
          }
        }}
      />

      <Sheet open={!!viewBriefing} onOpenChange={(o) => !o && setViewBriefing(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {viewBriefing && (() => {
            const tpl = templates.find((t) => t.id === viewBriefing.templateId);
            const meta = statusMeta[viewBriefing.status];
            return (
              <>
                <SheetHeader>
                  <SheetTitle>{viewBriefing.clientName}</SheetTitle>
                  <SheetDescription>{viewBriefing.templateName}</SheetDescription>
                </SheetHeader>
                <div className="mt-5 space-y-5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={meta.cls}>{meta.label}</Badge>
                    {viewBriefing.projectName && <Badge variant="outline">{viewBriefing.projectName}</Badge>}
                  </div>

                  <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Link público</p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={`${window.location.origin}/briefing/${viewBriefing.publicToken}`} className="text-xs" />
                      <Button size="icon" variant="outline" onClick={() => copyLink(viewBriefing.publicToken)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {viewBriefing.status === "rascunho" && (
                        <Button size="sm" onClick={() => handleSend(viewBriefing)}>
                          <Send className="h-3.5 w-3.5 mr-1.5" /> Marcar como enviado
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => window.open(`/briefing/${viewBriefing.publicToken}`, "_blank")}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Visualizar
                      </Button>
                    </div>
                  </div>

                  {viewBriefing.status === "respondido" && tpl && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Respostas</p>
                      {tpl.fields.map((f) => {
                        const r = viewBriefing.responses?.find((x) => x.fieldId === f.id);
                        return (
                          <div key={f.id} className="space-y-0.5">
                            <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
                            <p className="text-sm whitespace-pre-wrap">{r?.value || <span className="text-muted-foreground italic">— não respondido —</span>}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {viewBriefing.status !== "respondido" && (
                    <p className="text-sm text-muted-foreground">
                      Aguardando o cliente preencher. Você pode abrir o link público para pré-visualizar como o cliente verá.
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </div>
  );
}
