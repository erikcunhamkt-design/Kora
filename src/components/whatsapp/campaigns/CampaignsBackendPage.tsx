import { useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Send, Inbox, Trash2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import {
  listCampaigns,
  deleteCampaign,
  type WhatsAppCampaignV2,
} from "@/lib/whatsapp/repositories/whatsappCampaignsRepository";
import { isCampaignSenderEnabled } from "@/lib/whatsapp/featureFlags";
import { CampaignWizard } from "./CampaignWizard";
import { CampaignSendDialog } from "./CampaignSendDialog";

export function CampaignsBackendPage() {
  const { workspace } = useCurrentWorkspace();
  const [campaigns, setCampaigns] = useState<WhatsAppCampaignV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [sendDialog, setSendDialog] = useState<WhatsAppCampaignV2 | null>(null);
  const senderEnabled = isCampaignSenderEnabled();

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
              Disparos para audiências usando modelos de mensagem ativos. Texto livre não é permitido
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
                Crie uma audiência e um modelo de mensagem ativo para começar.
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
                  <th className="text-right px-4 py-2 font-medium">Sucesso</th>
                  <th className="text-right px-4 py-2 font-medium">Criada</th>
                  <th className="px-2" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => {
                  const status = c.status ?? "draft";
                  const isFinalized = status === "completed" || status === "cancelled";
                  const base = c.valid_recipients ?? c.total_recipients ?? 0;
                  const sent = c.sent_count ?? 0;
                  const successPct = base > 0 ? Math.round((sent / base) * 100) : 0;
                  const statusLabel =
                    status === "completed"
                      ? "concluída"
                      : status === "cancelled"
                        ? "cancelada"
                        : status === "sending"
                          ? "enviando"
                          : status === "paused"
                            ? "pausada"
                            : status;
                  const statusTone =
                    status === "completed"
                      ? "border-success/40 text-success"
                      : status === "cancelled"
                        ? "border-destructive/40 text-destructive"
                        : status === "sending"
                          ? "border-primary/40 text-primary"
                          : "";
                  return (
                    <tr key={c.id} className="border-t border-border/40 hover:bg-card/30">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant="outline" className={`text-[10px] ${statusTone}`}>{statusLabel}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{c.total_recipients ?? 0}</td>
                      <td className="px-4 py-2 text-right text-success">{c.valid_recipients ?? 0}</td>
                      <td className="px-4 py-2 text-right">{sent}</td>
                      <td className="px-4 py-2 text-right text-destructive">{c.failed_count ?? 0}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {base > 0 ? `${successPct}%` : "—"}
                      </td>
                      <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-2 flex items-center gap-1 justify-end">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  disabled={
                                    isFinalized ||
                                    (!senderEnabled && !["sending", "paused"].includes(status))
                                  }
                                  onClick={() => setSendDialog(c)}
                                  aria-label={isFinalized ? "Campanha finalizada" : "Enviar campanha"}
                                >
                                  <PlayCircle className="h-3.5 w-3.5 text-primary" />
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="text-xs max-w-[220px]">
                              {isFinalized
                                ? `Campanha ${statusLabel}. Não é possível disparar novamente.`
                                : senderEnabled
                                  ? "Abrir confirmação e enviar em lotes"
                                  : "Envio real de campanhas ainda está desativado."}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
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
                  );
                })}
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

      <CampaignSendDialog
        open={sendDialog !== null}
        workspaceId={workspace.id}
        campaign={sendDialog}
        onClose={() => setSendDialog(null)}
        onUpdated={() => void load()}
      />
    </div>
  );
}
