import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Library, Plus, ExternalLink, Copy, Pencil, Trash2,
  FolderOpen, Figma, Palette, Type, Camera, Video, FileText,
  FileSignature, Sparkles, Instagram, LinkIcon, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  type ClientAsset, type ClientAssetType, type ClientAssetAccessStatus,
  CLIENT_ASSET_TYPE_LABELS, CLIENT_ASSET_ACCESS_LABELS,
} from "@/hooks/useClients";

const TYPE_ICON: Record<ClientAssetType, any> = {
  drive: FolderOpen,
  figma: Figma,
  canva: Palette,
  identidade_visual: Sparkles,
  tipografia: Type,
  fotos_ensaios: Camera,
  videos: Video,
  briefing: FileText,
  contrato: FileSignature,
  referencias: LinkIcon,
  redes_sociais: Instagram,
  outro: LinkIcon,
};

const ACCESS_TONE: Record<ClientAssetAccessStatus, string> = {
  liberado: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  publico: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  privado: "bg-muted text-muted-foreground border-border",
  solicitar_acesso: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  expirado: "bg-destructive/10 text-destructive border-destructive/20",
  revisar: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

const PREVIEW_COUNT = 3;

function genId() {
  return `asset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function isValidUrl(u: string) {
  return /^https?:\/\/.+/i.test(u.trim());
}

interface DraftAsset {
  id?: string;
  title: string;
  type: ClientAssetType | "";
  url: string;
  description: string;
  tags: string;
  accessStatus: ClientAssetAccessStatus;
}

const emptyDraft: DraftAsset = {
  title: "", type: "", url: "", description: "", tags: "", accessStatus: "liberado",
};

export function ClientLibrarySection({
  assets,
  onChange,
}: {
  assets: ClientAsset[];
  onChange: (next: ClientAsset[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftAsset>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const visible = useMemo(
    () => (expanded ? assets : assets.slice(0, PREVIEW_COUNT)),
    [assets, expanded]
  );
  const hiddenCount = Math.max(0, assets.length - PREVIEW_COUNT);

  const openNew = () => {
    setEditingId(null);
    setDraft(emptyDraft);
    setDialogOpen(true);
  };

  const openEdit = (a: ClientAsset) => {
    setEditingId(a.id);
    setDraft({
      id: a.id,
      title: a.title,
      type: a.type,
      url: a.url,
      description: a.description ?? "",
      tags: (a.tags ?? []).join(", "),
      accessStatus: a.accessStatus,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    const title = draft.title.trim();
    const url = draft.url.trim();
    if (!title) return toast.error("Informe o nome do material");
    if (!draft.type) return toast.error("Selecione o tipo");
    if (!url) return toast.error("Informe o link/URL");
    if (!isValidUrl(url)) return toast.error("URL deve começar com http:// ou https://");

    const now = new Date().toISOString();
    const tags = draft.tags
      .split(",").map((t) => t.trim()).filter(Boolean);

    if (editingId) {
      onChange(assets.map((a) => a.id === editingId
        ? { ...a, title, type: draft.type as ClientAssetType, url,
            description: draft.description.trim() || undefined,
            tags: tags.length ? tags : undefined,
            accessStatus: draft.accessStatus, updatedAt: now }
        : a));
      toast.success("Material atualizado");
    } else {
      const newAsset: ClientAsset = {
        id: genId(),
        title,
        type: draft.type as ClientAssetType,
        url,
        description: draft.description.trim() || undefined,
        tags: tags.length ? tags : undefined,
        accessStatus: draft.accessStatus,
        createdAt: now,
        updatedAt: now,
      };
      onChange([newAsset, ...assets]);
      toast.success("Material adicionado");
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    onChange(assets.filter((a) => a.id !== deleteId));
    setDeleteId(null);
    toast.success("Material removido");
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-2">
          <Library className="h-3.5 w-3.5" /> Biblioteca do cliente
        </h3>
        <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={openNew}>
          <Plus className="h-3 w-3" /> Adicionar material
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/70 mb-2 leading-snug">
        Registre links externos importantes (Drive, Figma, Canva, briefings, referências).
        Upload seguro, permissões e arquivos internos chegam em etapa futura.
      </p>

      {assets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 bg-card/30 p-5 text-center">
          <Library className="h-5 w-5 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-sm text-foreground">Nenhum material registrado para este cliente.</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Adicione links de Drive, Figma, identidade visual e referências.
          </p>
          <Button size="sm" className="mt-3 gap-1.5" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Adicionar material
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((a) => {
            const Icon = TYPE_ICON[a.type] ?? LinkIcon;
            return (
              <div
                key={a.id}
                className="rounded-lg border border-border/60 bg-card/40 p-3 hover:border-border transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted/50 text-muted-foreground flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.title}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                            {CLIENT_ASSET_TYPE_LABELS[a.type]}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px] px-1.5 py-0", ACCESS_TONE[a.accessStatus])}
                          >
                            {CLIENT_ASSET_ACCESS_LABELS[a.accessStatus]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Abrir"
                          onClick={() => window.open(a.url, "_blank", "noopener,noreferrer")}>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Copiar link"
                          onClick={() => handleCopy(a.url)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar"
                          onClick={() => openEdit(a)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={() => setDeleteId(a.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {a.description && (
                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{a.description}</p>
                    )}
                    {a.tags && a.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {a.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground border-border/70">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {hiddenCount > 0 && (
            <Button
              variant="ghost" size="sm" className="w-full gap-1.5 text-xs text-muted-foreground"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (<><ChevronUp className="h-3 w-3" /> Mostrar menos</>)
                : (<><ChevronDown className="h-3 w-3" /> Ver todos ({assets.length})</>)}
            </Button>
          )}
        </div>
      )}

      {/* Dialog add/edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar material" : "Novo material"}</DialogTitle>
            <DialogDescription className="text-xs">
              Use esta área para registrar links externos importantes do cliente.
              Upload de arquivos será uma etapa futura com armazenamento seguro.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="asset-title" className="text-xs">Nome do material *</Label>
              <Input id="asset-title" value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Ex.: Pasta do Drive, Identidade visual, Briefing"
                maxLength={120} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <Select value={draft.type || undefined}
                  onValueChange={(v) => setDraft((d) => ({ ...d, type: v as ClientAssetType }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLIENT_ASSET_TYPE_LABELS) as ClientAssetType[]).map((k) => (
                      <SelectItem key={k} value={k}>{CLIENT_ASSET_TYPE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Status de acesso</Label>
                <Select value={draft.accessStatus}
                  onValueChange={(v) => setDraft((d) => ({ ...d, accessStatus: v as ClientAssetAccessStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CLIENT_ASSET_ACCESS_LABELS) as ClientAssetAccessStatus[]).map((k) => (
                      <SelectItem key={k} value={k}>{CLIENT_ASSET_ACCESS_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asset-url" className="text-xs">Link / URL *</Label>
              <Input id="asset-url" value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://..." />
              <p className="text-[10px] text-muted-foreground/70">Deve começar com http:// ou https://</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asset-desc" className="text-xs">Descrição</Label>
              <Textarea id="asset-desc" rows={2} value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Observação curta sobre este material"
                maxLength={400} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="asset-tags" className="text-xs">Tags</Label>
              <Input id="asset-tags" value={draft.tags}
                onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                placeholder="separadas por vírgula" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingId ? "Salvar" : "Adicionar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o registro local do material. O arquivo/link original no destino não é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default ClientLibrarySection;
