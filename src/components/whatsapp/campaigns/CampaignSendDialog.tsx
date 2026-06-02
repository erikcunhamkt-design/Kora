import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, AlertTriangle, Pause, Ban, Play } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  invokeCampaignSenderBatch,
  listCampaignRecipients,
  listCampaignSendLogs,
  type CampaignSendLog,
  type WhatsAppCampaignV2,
  type WhatsAppCampaignRecipient,
} from "@/lib/whatsapp/repositories/whatsappCampaignsRepository";
import { isCampaignSenderEnabled } from "@/lib/whatsapp/featureFlags";
import { formatPhoneBR } from "@/lib/whatsapp/phone";

interface Props {
  open: boolean;
  workspaceId: string;
  campaign: WhatsAppCampaignV2 | null;
  onClose: () => void;
  onUpdated?: () => void;
}

type Phase = "confirm" | "progress";

export function CampaignSendDialog({ open, workspaceId, campaign, onClose, onUpdated }: Props) {
  const [phase, setPhase] = useState<Phase>("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recipients, setRecipients] = useState<WhatsAppCampaignRecipient[]>([]);
  const [logs, setLogs] = useState<CampaignSendLog[]>([]);
  const senderEnabled = isCampaignSenderEnabled();

  useEffect(() => {
    if (!open) {
      setPhase("confirm");
      setConfirmText("");
      setAcceptedResponsibility(false);
      setRecipients([]);
      setLogs([]);
      return;
    }
    if (campaign && campaign.status === "sending") {
      setPhase("progress");
    }
  }, [open, campaign]);

  useEffect(() => {
    if (!open || !campaign || phase !== "progress") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [r, l] = await Promise.all([
          listCampaignRecipients(workspaceId, campaign.id),
          listCampaignSendLogs(workspaceId, campaign.id, 10),
        ]);
        if (!cancelled) {
          setRecipients(r);
          setLogs(l);
        }
      } catch {
        /* silencioso no polling */
      }
    };
    void tick();
    const t = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [open, phase, workspaceId, campaign]);

  const tally = useMemo(() => {
    const t = { total: recipients.length, sent: 0, failed: 0, queued: 0, skipped: 0, pending: 0, sending: 0 };
    recipients.forEach((r) => {
      const s = r.status as keyof typeof t;
      if (s in t) (t as Record<string, number>)[s]++;
    });
    return t;
  }, [recipients]);

  if (!campaign) return null;

  const canSend =
    senderEnabled && acceptedResponsibility && confirmText.trim().toUpperCase() === "ENVIAR" && !busy;
  const progressPct = tally.total === 0 ? 0 : Math.round(((tally.sent + tally.failed + tally.skipped) / tally.total) * 100);

  async function handleAction(action: "send_batch" | "pause" | "cancel") {
    if (!campaign) return;
    setBusy(true);
    try {
      const res = await invokeCampaignSenderBatch(workspaceId, campaign.id, action);
      if (action === "send_batch") {
        toast.success(`Lote processado`, {
          description: `Enviados: ${res.sent} · Falhas: ${res.failed} · Restantes: ${res.remaining}`,
        });
      } else if (action === "pause") {
        toast.success("Campanha pausada");
      } else {
        toast.success("Campanha cancelada");
      }
      setPhase("progress");
      onUpdated?.();
    } catch (e) {
      toast.error("Falha no sender", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        {phase === "confirm" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" /> Enviar campanha WhatsApp?
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed pt-2">
                Esta campanha usará o <strong>modelo de mensagem ativo</strong> vinculado e será
                enviada apenas para contatos válidos, sem opt-out e sem bloqueio. O envio será
                feito em <strong>lotes pequenos</strong> para reduzir risco operacional.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2 items-start">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <p className="text-muted-foreground leading-relaxed">
                  <strong>Atenção:</strong> o envio de mensagens em massa pelo WhatsApp pode gerar
                  bloqueios, restrições ou banimento do número caso os contatos não tenham
                  autorizado o recebimento ou denunciem a conversa. A KORA fornece a ferramenta de
                  organização e envio, mas a responsabilidade pelo uso, pela lista de contatos,
                  pelo consentimento e pelo conteúdo enviado é do usuário.
                </p>
              </div>

              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>✓ Modelo de mensagem ativo</li>
                <li>✓ Audiência selecionada</li>
                <li>✓ Apenas contatos válidos</li>
                <li>✓ Opt-outs removidos</li>
                <li>✓ Duplicados removidos</li>
                <li>✓ Texto livre bloqueado</li>
                <li>✓ Envio em lotes</li>
              </ul>

              {!senderEnabled && (
                <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xs flex gap-2 items-start">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <span>
                    Envio real de campanhas ainda está desativado.
                    Ative <code>kora.whatsapp.campaignSender.enabled</code> em localStorage para liberar.
                  </span>
                </div>
              )}

              <label className="flex gap-2 items-start text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acceptedResponsibility}
                  onChange={(e) => setAcceptedResponsibility(e.target.checked)}
                  disabled={!senderEnabled || busy}
                />
                <span>
                  Declaro que tenho autorização para contatar esta lista e assumo a
                  responsabilidade pelo envio.
                </span>
              </label>

              <div>
                <label className="text-xs font-medium">Digite <code>ENVIAR</code> para confirmar</label>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="ENVIAR"
                  className="mt-1"
                  disabled={!senderEnabled || busy || !acceptedResponsibility}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
              <Button
                disabled={!canSend}
                onClick={() => handleAction("send_batch")}
                className="gap-2"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Confirmar envio
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Send className="h-5 w-5 text-primary" /> {campaign.name}
              </DialogTitle>
              <DialogDescription className="text-xs flex items-center gap-2 pt-1">
                Status: <Badge variant="outline" className="text-[10px]">{campaign.status}</Badge>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <Progress value={progressPct} />
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Progresso: {progressPct}%</span>
                <span>
                  Sucesso:{" "}
                  <strong className="text-success">
                    {tally.total > 0 ? Math.round((tally.sent / Math.max(1, tally.total - tally.skipped)) * 100) : 0}%
                  </strong>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Total" value={tally.total} />
                <Stat label="Queued" value={tally.queued + tally.pending + tally.sending} />
                <Stat label="Enviados" value={tally.sent} tone="success" />
                <Stat label="Falhas" value={tally.failed} tone="destructive" />
                <Stat label="Skipped" value={tally.skipped} tone="muted" />
                <Stat label="Delivered" value={campaign.delivered_count ?? 0} tone="muted" />
              </div>


              <div className="rounded-md border border-border/50 p-2 max-h-40 overflow-y-auto text-[11px]">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground text-center py-2">Sem eventos ainda.</p>
                ) : (
                  <ul className="space-y-1">
                    {logs.map((l) => (
                      <li
                        key={l.id}
                        className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-border/30 pb-1 last:border-0"
                      >
                        <span className="text-muted-foreground shrink-0 tabular-nums">
                          {new Date(l.created_at).toLocaleTimeString()}
                        </span>
                        <span
                          className={`truncate ${l.event === "failed" ? "text-destructive" : "text-foreground"}`}
                          title={l.error_message ?? l.event}
                        >
                          {l.event}
                          {l.error_message ? `: ${l.error_message}` : ""}
                        </span>
                        <span className="text-muted-foreground font-mono text-[10px] shrink-0">
                          {formatPhoneBR(l.phone)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>


            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={onClose} disabled={busy}>Fechar</Button>
              <Button
                variant="outline"
                onClick={() => handleAction("cancel")}
                disabled={busy || campaign.status === "completed" || campaign.status === "cancelled"}
                className="gap-2"
              >
                <Ban className="h-4 w-4" /> Cancelar campanha
              </Button>
              <Button
                variant="outline"
                onClick={() => handleAction("pause")}
                disabled={busy || campaign.status !== "sending"}
                className="gap-2"
              >
                <Pause className="h-4 w-4" /> Pausar
              </Button>
              <Button
                onClick={() => handleAction("send_batch")}
                disabled={
                  busy ||
                  !senderEnabled ||
                  campaign.status === "completed" ||
                  campaign.status === "cancelled" ||
                  tally.queued + tally.pending === 0
                }
                className="gap-2"
              >

                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Processar próximo lote
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" | "muted" }) {
  const color =
    tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : tone === "muted" ? "text-muted-foreground" : "";
  return (
    <div className="rounded-md border border-border/40 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
