import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Lightbulb, Pencil, Image as ImageIcon, Calendar, Send } from "lucide-react";
import {
  useContentItems, CONTENT_STATUS_LABEL, CONTENT_CHANNEL_LABEL, CONTENT_FORMAT_LABEL,
  type ContentStatus, type ContentChannel, type ContentFormat,
} from "@/hooks/useContentItems";
import { toast } from "@/hooks/use-toast";

const COLS: { key: ContentStatus; label: string; dot: string }[] = [
  { key: "idea", label: "Ideias", dot: "bg-muted-foreground" },
  { key: "writing", label: "Escrevendo", dot: "bg-amber-400" },
  { key: "design", label: "Design", dot: "bg-secondary" },
  { key: "scheduled", label: "Agendado", dot: "bg-primary" },
  { key: "published", label: "Publicado", dot: "bg-emerald-500" },
];

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export function ContentSection() {
  const { items, addContentItem, updateContentStatus } = useContentItems();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"kanban" | "calendar">("kanban");

  const metrics = useMemo(() => ({
    idea: items.filter((c) => c.status === "idea").length,
    inProd: items.filter((c) => c.status === "writing" || c.status === "design").length,
    scheduled: items.filter((c) => c.status === "scheduled").length,
    published: items.filter((c) => c.status === "published").length,
  }), [items]);

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    if (!title) { toast({ title: "Informe o título", variant: "destructive" }); return; }
    addContentItem({
      title,
      channel: (fd.get("channel") as ContentChannel) || "instagram",
      format: (fd.get("format") as ContentFormat) || "post",
      status: (fd.get("status") as ContentStatus) || "idea",
      publishDate: (fd.get("publishDate") as string) || undefined,
      clientName: (fd.get("clientName") as string) || undefined,
      campaign: (fd.get("campaign") as string) || undefined,
      caption: (fd.get("caption") as string) || undefined,
      tags: ((fd.get("tags") as string) || "").split(",").map((t) => t.trim()).filter(Boolean),
    });
    setOpen(false);
    toast({ title: "Conteúdo criado" });
  };

  const sortedByDate = [...items].sort((a, b) => (a.publishDate || "").localeCompare(b.publishDate || ""));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Conteúdo</h2>
          <p className="text-xs text-muted-foreground">Calendário editorial e produção.</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="sm" className="rounded-none" onClick={() => setView("kanban")}>Kanban</Button>
            <Button variant={view === "calendar" ? "secondary" : "ghost"} size="sm" className="rounded-none" onClick={() => setView("calendar")}>Calendário</Button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <Button onClick={() => setOpen(true)} className="orbit-gradient hover:opacity-90 gap-2"><Plus className="h-4 w-4" /> Novo conteúdo</Button>
            <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Novo conteúdo</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2"><Label>Título*</Label><Input name="title" required className="mt-1.5" /></div>
                <div><Label>Canal</Label>
                  <Select name="channel" defaultValue="instagram">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CONTENT_CHANNEL_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Formato</Label>
                  <Select name="format" defaultValue="post">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CONTENT_FORMAT_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Status</Label>
                  <Select name="status" defaultValue="idea">
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(CONTENT_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Data de publicação</Label><Input name="publishDate" type="date" className="mt-1.5" /></div>
                <div><Label>Cliente</Label><Input name="clientName" className="mt-1.5" /></div>
                <div><Label>Campanha</Label><Input name="campaign" className="mt-1.5" /></div>
                <div className="sm:col-span-2"><Label>Legenda</Label><Textarea name="caption" rows={2} className="mt-1.5" /></div>
                <div className="sm:col-span-2"><Label>Tags (vírgulas)</Label><Input name="tags" className="mt-1.5" /></div>
                <DialogFooter className="sm:col-span-2 mt-2">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="orbit-gradient hover:opacity-90">Criar conteúdo</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Ideias", value: metrics.idea, icon: Lightbulb, accent: "text-amber-400" },
          { label: "Em produção", value: metrics.inProd, icon: Pencil, accent: "text-secondary" },
          { label: "Agendados", value: metrics.scheduled, icon: Calendar, accent: "text-primary" },
          { label: "Publicados", value: metrics.published, icon: Send, accent: "text-emerald-400" },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="orbit-card p-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className={`h-4 w-4 ${m.accent}`} />{m.label}</div>
              <p className="text-lg font-bold text-foreground mt-1">{m.value}</p>
            </div>
          );
        })}
      </div>

      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-3 -mx-2 px-2">
          {COLS.map((col) => {
            const colItems = items.filter((i) => i.status === col.key);
            return (
              <div key={col.key} className="flex-shrink-0 w-[260px]">
                <div className="orbit-card p-3 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${col.dot}`} />
                    <h3 className="text-sm font-semibold text-foreground">{col.label}</h3>
                  </div>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{colItems.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {colItems.map((c) => (
                    <div key={c.id} className="orbit-card p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground leading-tight">{c.title}</p>
                        {c.isDemo && <Badge variant="outline" className="text-[10px] border-border text-muted-foreground shrink-0">demo</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{CONTENT_CHANNEL_LABEL[c.channel]}</Badge>
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{CONTENT_FORMAT_LABEL[c.format]}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(c.publishDate)}</span>
                        <Select value={c.status} onValueChange={(v) => updateContentStatus(c.id, v as ContentStatus)}>
                          <SelectTrigger className="h-6 px-2 text-[10px] w-auto"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(CONTENT_STATUS_LABEL).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <div className="orbit-card border-dashed p-4 text-center text-xs text-muted-foreground">Vazio</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="orbit-card divide-y divide-border">
          {sortedByDate.map((c) => (
            <div key={c.id} className="p-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="h-4 w-4 text-muted-foreground" /></div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{CONTENT_CHANNEL_LABEL[c.channel]} · {CONTENT_FORMAT_LABEL[c.format]} · {fmtDate(c.publishDate)}</p>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">{CONTENT_STATUS_LABEL[c.status]}</Badge>
            </div>
          ))}
          {sortedByDate.length === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Sem conteúdo agendado.</div>}
        </div>
      )}
    </div>
  );
}
