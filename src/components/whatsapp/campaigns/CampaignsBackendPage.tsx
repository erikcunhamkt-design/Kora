import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Send, Inbox, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  listCampaigns,
  deleteCampaign,
  type WhatsAppCampaignV2,
} from "@/lib/whatsapp/repositories/whatsappCampaignsRepository";
import { CampaignWizard } from "./CampaignWizard";

export function CampaignsBackendPage() {
  const { workspace } = useCurrentWorkspace();
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useMemo(
    () => async () => {
      if (!workspace) return;
      setLoading(true);
      try {
        const list = await listCampaigns(workspace.id);
        setCampaigns(list);
      } catch (e) {
        toast.error("Falha ao carregar campanhas", { description: (e as Error).message });
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
              <Send className="h-5 w-5 text-primary" /> Campanhas
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Disparos para audiências usando templates aprovados. Texto livre não é permitido
              para listas — apenas para conversas ativas no inbox.
            </p>
          </div>
          <Button onClick={() => setWizardOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </header>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando campanhas...
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="bg-card/40 border-dashed">
            <CardContent className="p-12 text-center">
              <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">Nenhuma campanha criada</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Crie uma audiência e um template aprovado para começar.
              </p>
              <Button size="sm" onClick={() => setWizardOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Criar campanha
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border border-border/50 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-card/60 text-muted-foreground text-xs">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Nome</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-right px-4 py-2 font-medium">Total</th>
                  <th className="text-right px-4 py-2 font-medium">Válidos</th>
                  <th className="text-right px-4 py-2 font-medium">Enviados</th>
                  <th className="text-right px-4 py-2 font-medium">Falhas</th>
                  <th className="text-right px-4 py-2 font-medium">Criada</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-t border-border/40 hover:bg-card/30">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                    </td>
                    <td className="px-4 py-2 text-right">{c.total_recipients ?? 0}</td>
                    <td className="px-4 py-2 text-right text-success">{c.valid_recipients ?? 0}</td>
                    <td className="px-4 py-2 text-right">{c.sent_count ?? 0}</td>
                    <td className="px-4 py-2 text-right text-destructive">{c.failed_count ?? 0}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (!confirm(`Remover campanha "${c.name}"?`)) return;
                          void deleteCampaign(workspace.id, c.id).then(() => {
                            toast.success("Campanha removida");
                            void load();
                          });
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CampaignWizard
        open={wizardOpen}
        workspaceId={workspace.id}
        onClose={() => setWizardOpen(false)}
        onCreated={() => {
          setWizardOpen(false);
          void load();
        }}
      />
    </div>
  );
}
