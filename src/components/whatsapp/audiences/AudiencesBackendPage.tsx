import { useEffect, useMemo, useState } from "react";
import { Plus, Users, Trash2, Loader2, Archive, AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  listAudiences,
  archiveAudience,
  deleteAudience,
  type WhatsAppAudience,
} from "@/lib/whatsapp/repositories/whatsappAudiencesRepository";
import { ImportAudienceWizard } from "./ImportAudienceWizard";
import { AudienceDetailDrawer } from "./AudienceDetailDrawer";

export function AudiencesBackendPage() {
  const { workspace } = useCurrentWorkspace();
  const [audiences, setAudiences] = useState<WhatsAppAudience[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<WhatsAppAudience | null>(null);

  const load = useMemo(
    () => async () => {
      if (!workspace) return;
      setLoading(true);
      try {
        const list = await listAudiences(workspace.id);
        setAudiences(list);
      } catch (e) {
        toast.error("Falha ao carregar audiências", { description: (e as Error).message });
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

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Audiências
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Listas de contatos para campanhas. Contatos importados aqui{" "}
              <strong className="text-foreground">não viram clientes automaticamente</strong>.
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova audiência
          </Button>
        </header>

        <Card className="bg-warning/5 border-warning/30">
          <CardContent className="p-4 flex gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground leading-relaxed">
              Campanhas para audiências exigem modelo de mensagem ativo e opt-in dos contatos. Texto livre
              só é permitido em conversas já abertas dentro da janela de atendimento.
            </p>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando audiências...
          </div>
        ) : audiences.length === 0 ? (
          <Card className="bg-card/40 border-dashed">
            <CardContent className="p-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhuma audiência criada ainda</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Crie sua primeira lista colando números, importando CSV ou adicionando manualmente.
              </p>
              <Button onClick={() => setWizardOpen(true)} size="sm" className="gap-2">
                <Plus className="h-4 w-4" /> Criar audiência
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {audiences.map((aud) => (
              <Card
                key={aud.id}
                className="hover:border-primary/40 transition cursor-pointer"
                onClick={() => setSelected(aud)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base truncate">{aud.name}</CardTitle>
                    <StatusBadge status={aud.status ?? "draft"} />
                  </div>
                  {aud.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{aud.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label="Total" value={aud.total_contacts ?? 0} />
                    <Stat label="Válidos" value={aud.valid_contacts ?? 0} tone="success" />
                    <Stat label="Inválidos" value={aud.invalid_contacts ?? 0} tone="destructive" />
                    <Stat label="Duplicados" value={aud.duplicate_contacts ?? 0} tone="warning" />
                  </div>
                  <div className="flex gap-1 pt-2 border-t border-border/40">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        void archiveAudience(workspace.id, aud.id).then(() => {
                          toast.success("Audiência arquivada");
                          void load();
                        });
                      }}
                    >
                      <Archive className="h-3 w-3 mr-1" /> Arquivar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!confirm(`Remover "${aud.name}"?`)) return;
                        void deleteAudience(workspace.id, aud.id).then(() => {
                          toast.success("Audiência removida");
                          void load();
                        });
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ImportAudienceWizard
        open={wizardOpen}
        workspaceId={workspace.id}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          setWizardOpen(false);
          void load();
        }}
      />

      {selected && (
        <AudienceDetailDrawer
          audience={selected}
          workspaceId={workspace.id}
          onClose={() => setSelected(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    draft: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
    clean: { label: "Limpa", className: "bg-success/15 text-success border-success/30" },
    needs_review: {
      label: "Revisar",
      className: "bg-warning/15 text-warning border-warning/30",
    },
    archived: { label: "Arquivada", className: "bg-muted/50 text-muted-foreground" },
  };
  const s = map[status] ?? map.draft;
  return (
    <Badge variant="outline" className={`text-[10px] ${s.className}`}>
      {s.label}
    </Badge>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const colors: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };
  return (
    <div className="flex justify-between items-center bg-background/40 rounded px-2 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${colors[tone]}`}>{value}</span>
    </div>
  );
}
