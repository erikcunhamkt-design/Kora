import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Edit3, Trash2, CheckCircle2, Clock, XCircle, Pause, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  listTemplates,
  deleteTemplate,
  markTemplatePending,
  markTemplateApproved,
  markTemplateRejected,
  markTemplatePaused,
  markTemplateDraft,
  renderTemplatePreview,
  type WhatsAppTemplate,
  type TemplateStatus,
} from "@/lib/whatsapp/repositories/whatsappTemplatesRepository";
import { TemplateFormDialog } from "./TemplateFormDialog";

// UI labels: status conceitual "Rascunho / Ativo / Arquivado".
// Mapeamento interno: draft/pending/rejected -> Rascunho, approved -> Ativo, paused -> Arquivado.
const STATUS_META: Record<TemplateStatus, { label: string; className: string; icon: typeof Clock }> = {
  draft: { label: "Rascunho", className: "bg-muted text-muted-foreground", icon: FileText },
  pending: { label: "Rascunho", className: "bg-muted text-muted-foreground", icon: FileText },
  approved: { label: "Ativo", className: "bg-success/15 text-success border-success/30", icon: CheckCircle2 },
  rejected: { label: "Rascunho", className: "bg-muted text-muted-foreground", icon: FileText },
  paused: { label: "Arquivado", className: "bg-muted text-muted-foreground", icon: Pause },
};

export function TemplatesBackendPage() {
  const { workspace } = useCurrentWorkspace();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);

  const load = useMemo(
    () => async () => {
      if (!workspace) return;
      setLoading(true);
      try {
        const list = await listTemplates(workspace.id);
        setTemplates(list);
      } catch (e) {
        toast.error("Falha ao carregar templates", { description: (e as Error).message });
      } finally {
        setLoading(false);
      }
    },
    [workspace],
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!workspace) return null;

  const changeStatus = async (tpl: WhatsAppTemplate, status: TemplateStatus) => {
    try {
      if (status === "pending") await markTemplatePending(workspace.id, tpl.id);
      else if (status === "approved") await markTemplateApproved(workspace.id, tpl.id);
      else if (status === "rejected") await markTemplateRejected(workspace.id, tpl.id, "Reprovado manualmente");
      else if (status === "paused") await markTemplatePaused(workspace.id, tpl.id);
      else if (status === "draft") await markTemplateDraft(workspace.id, tpl.id);
      toast.success(`Template marcado como ${STATUS_META[status].label.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error("Falha ao atualizar status", { description: (e as Error).message });
    }
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Modelos de Mensagem</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Biblioteca de mensagens sugeridas para usar em campanhas. Os modelos são sugestões de
              copy — não são pré-aprovados por nenhuma plataforma. A responsabilidade pelo conteúdo,
              pela lista de contatos e pelo envio é do usuário.
            </p>
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" /> Novo modelo
          </Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando templates...
          </div>
        ) : templates.length === 0 ? (
          <Card className="bg-card/40 border-dashed">
            <CardContent className="p-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhum template criado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Crie seu primeiro template para usar em campanhas.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setEditing(null);
                  setDialogOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Criar template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => {
              const meta = STATUS_META[(tpl.status ?? "draft") as TemplateStatus] ?? STATUS_META.draft;
              const Icon = meta.icon;
              return (
                <Card key={tpl.id} className="hover:border-primary/40 transition">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate">{tpl.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${meta.className}`}>
                            <Icon className="h-2.5 w-2.5" /> {meta.label}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {tpl.category}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {tpl.language ?? "pt_BR"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md bg-background/60 border border-border/40 p-3 text-xs whitespace-pre-wrap line-clamp-5 font-mono">
                      {renderTemplatePreview(tpl.body, (tpl.sample_values ?? {}) as Record<string, string>)}
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs gap-1.5 h-7"
                        onClick={() => {
                          setEditing(tpl);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit3 className="h-3 w-3" /> Editar
                      </Button>
                      {tpl.status !== "pending" && tpl.status !== "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => changeStatus(tpl, "pending")}
                        >
                          Enviar para aprovação
                        </Button>
                      )}
                      {tpl.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-success hover:text-success"
                            onClick={() => changeStatus(tpl, "approved")}
                          >
                            Marcar aprovado
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-7 text-destructive hover:text-destructive"
                            onClick={() => changeStatus(tpl, "rejected")}
                          >
                            Reprovar
                          </Button>
                        </>
                      )}
                      {tpl.status === "approved" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs h-7"
                          onClick={() => changeStatus(tpl, "paused")}
                        >
                          Pausar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs h-7 text-destructive hover:text-destructive ml-auto"
                        onClick={() => {
                          if (!confirm(`Remover template "${tpl.name}"?`)) return;
                          void deleteTemplate(workspace.id, tpl.id).then(() => {
                            toast.success("Template removido");
                            void load();
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <TemplateFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        workspaceId={workspace.id}
        template={editing}
        onSaved={() => {
          setDialogOpen(false);
          void load();
        }}
      />
    </div>
  );
}
