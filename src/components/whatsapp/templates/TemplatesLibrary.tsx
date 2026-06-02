import { useMemo, useState } from "react";
import { CheckCircle2, FileText, Layers, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateTemplateDialog } from "./CreateTemplateDialog";
import {
  useWhatsAppTemplates,
  type WhatsAppTemplate,
  type WhatsAppTemplateCategory,
  type WhatsAppTemplateStatus,
} from "@/hooks/useWhatsAppTemplates";
import { renderTemplatePreview } from "@/lib/whatsapp/templateVariables";
import { cn } from "@/lib/utils";

const categoryLabels: Record<WhatsAppTemplateCategory, string> = {
  marketing: "Marketing",
  utility: "Utilidade",
  authentication: "Autenticação",
  service: "Atendimento",
};

const statusMeta: Record<
  WhatsAppTemplateStatus,
  { label: string; className: string }
> = {
  draft:     { label: "Rascunho",   className: "bg-muted/40 text-muted-foreground border-border/60" },
  submitted: { label: "Em aprovação", className: "bg-sky-500/10 text-sky-300 border-sky-500/30" },
  approved:  { label: "Ativo",   className: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30" },
  rejected:  { label: "Rascunho",  className: "bg-destructive/10 text-destructive border-destructive/30" },
  paused:    { label: "Pausado",    className: "bg-amber-500/10 text-amber-300 border-amber-500/30" },
};

function timeAgo(iso?: string | null): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

export function TemplatesLibrary() {
  const { templates, addTemplate, deleteTemplate } = useWhatsAppTemplates();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | WhatsAppTemplateStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | WhatsAppTemplateCategory>("all");
  const [selectedId, setSelectedId] = useState<string | null>(templates[0]?.id ?? null);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.body.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [templates, query, statusFilter, categoryFilter]);

  const selected = useMemo<WhatsAppTemplate | null>(
    () => filtered.find((t) => t.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  const stats = useMemo(() => {
    const total = templates.length;
    const approved = templates.filter((t) => t.status === "approved").length;
    const pending = templates.filter((t) => t.status === "submitted").length;
    const draft = templates.filter((t) => t.status === "draft").length;
    return { total, approved, pending, draft };
  }, [templates]);

  return (
    <div className="p-4 md:p-6 space-y-5 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" /> Modelos de Mensagem
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
            Biblioteca de modelos de mensagem. Use-as em campanhas para audiências —
            mensagens livres só dentro da janela de 24h de atendimento.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo template
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        <StatCard label="Total" value={stats.total} />
        <StatCard label="Ativos" value={stats.approved} accent="text-emerald-300" />
        <StatCard label="Em aprovação" value={stats.pending} accent="text-sky-300" />
        <StatCard label="Rascunhos" value={stats.draft} accent="text-muted-foreground" />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou conteúdo…"
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(statusMeta).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
          <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {Object.entries(categoryLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela + Preview */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhum template encontrado"
          description="Crie seu primeiro modelo de mensagem ativo para começar a disparar campanhas em massa com segurança."
          primaryAction={{ label: "Novo template", onClick: () => setDialogOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr,360px]">
          {/* Tabela (desktop) */}
          <div className="hidden md:block rounded-xl border border-border/50 overflow-hidden bg-card/40">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Idioma</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead className="text-right">Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    onClick={() => setSelectedId(t.id)}
                    className={cn(
                      "cursor-pointer",
                      selected?.id === t.id && "bg-primary/5",
                    )}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span className="text-foreground">{t.name}</span>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">{t.body}</span>
                      </div>
                    </TableCell>
                    <TableCell><span className="text-[12px]">{categoryLabels[t.category]}</span></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", statusMeta[t.status].className)}>
                        {statusMeta[t.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell><span className="text-[12px] text-muted-foreground">{t.language}</span></TableCell>
                    <TableCell><span className="text-[12px] text-muted-foreground">{timeAgo(t.lastUsedAt)}</span></TableCell>
                    <TableCell className="text-right">
                      <span className="text-[12px] text-muted-foreground">
                        {t.responseRate != null ? `${Math.round(t.responseRate * 100)}%` : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Cards (mobile) */}
          <div className="md:hidden space-y-2">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                className={cn(
                  "w-full text-left rounded-xl border border-border/50 bg-card/40 p-3 space-y-2 transition-colors",
                  selected?.id === t.id && "border-primary/40 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge variant="outline" className={cn("text-[10px]", statusMeta[t.status].className)}>
                    {statusMeta[t.status].label}
                  </Badge>
                </div>
                <p className="text-[12px] text-muted-foreground line-clamp-2">{t.body}</p>
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span>{categoryLabels[t.category]}</span>
                  <span>•</span>
                  <span>{t.language}</span>
                  <span>•</span>
                  <span>{timeAgo(t.lastUsedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Preview lateral */}
          {selected && <TemplatePreviewCard template={selected} onDelete={() => deleteTemplate(selected.id)} />}
        </div>
      )}

      <CreateTemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={(data) => addTemplate(data)}
      />
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <p className={cn("text-xl font-semibold mt-1", accent ?? "text-foreground")}>{value}</p>
    </div>
  );
}

function TemplatePreviewCard({
  template,
  onDelete,
}: {
  template: WhatsAppTemplate;
  onDelete: () => void;
}) {
  const preview = renderTemplatePreview(template.body);
  return (
    <aside className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3 h-fit lg:sticky lg:top-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <p className="text-[11px] text-muted-foreground">{categoryLabels[template.category]} · {template.language}</p>
        </div>
        <Badge variant="outline" className={cn("text-[10px]", statusMeta[template.status].className)}>
          {statusMeta[template.status].label}
        </Badge>
      </div>

      <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 px-3.5 py-3 space-y-2">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{preview}</p>
        {template.cta && (
          <div className="pt-2 border-t border-emerald-500/15 text-center">
            <span className="text-[12px] font-medium text-emerald-300">{template.cta.label}</span>
          </div>
        )}
      </div>

      {template.variables.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Variáveis</span>
          <div className="flex flex-wrap gap-1">
            {template.variables.map((v) => (
              <Badge key={v} variant="secondary" className="text-[10px]">{`{{${v}}}`}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <span className="block text-muted-foreground">Último uso</span>
          <span className="text-foreground">{timeAgo(template.lastUsedAt)}</span>
        </div>
        <div>
          <span className="block text-muted-foreground">Taxa de resposta</span>
          <span className="text-foreground">
            {template.responseRate != null ? `${Math.round(template.responseRate * 100)}%` : "—"}
          </span>
        </div>
      </div>

      {template.notes && (
        <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Notas internas</span>
          <p className="text-[12px] text-muted-foreground mt-1">{template.notes}</p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" /> Pronto para campanhas
        </span>
        <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 gap-1.5 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      </div>
    </aside>
  );
}
