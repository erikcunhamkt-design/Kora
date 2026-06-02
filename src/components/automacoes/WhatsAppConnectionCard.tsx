import { useState } from "react";
import { Download, Loader2, Plug, QrCode, RefreshCw, RotateCw, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { WhatsAppInstance } from "@/hooks/useWhatsAppInstance";

interface WhatsAppConnectionCardProps {
  instance: WhatsAppInstance | null;
  loading?: boolean;
  busy?: boolean;
  syncing?: boolean;
  showSync?: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  removeInstance: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  importInstance: (token: string, subdomain?: string) => Promise<WhatsAppInstance | undefined | null>;
  onSync?: () => Promise<void> | void;
}

export function WhatsAppConnectionCard({
  instance,
  loading,
  busy,
  syncing,
  showSync = false,
  connect,
  disconnect,
  removeInstance,
  refreshStatus,
  importInstance,
  onSync,
}: WhatsAppConnectionCardProps) {
  const [qrOpen, setQrOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importToken, setImportToken] = useState("");
  const [importSubdomain, setImportSubdomain] = useState("free");
  const [importing, setImporting] = useState(false);
  const [removing, setRemoving] = useState(false);

  const status = instance?.status ?? "disconnected";
  const qrCode = instance?.qr_code ?? null;

  const handleConnect = async () => {
    try {
      await connect();
      setQrOpen(true);
      toast.success("Instância criada. Escaneie o QR Code.");
    } catch (e) {
      toast.error("Falha ao conectar", { description: (e as Error).message });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast.success("WhatsApp desconectado do atendimento");
    } catch (e) {
      toast.error("Falha ao desconectar", { description: (e as Error).message });
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await removeInstance();
      setQrOpen(false);
      toast.success("Conexão removida", { description: "Você já pode conectar ou importar outra instância." });
    } catch (e) {
      toast.error("Falha ao remover conexão", { description: (e as Error).message });
    } finally {
      setRemoving(false);
    }
  };

  const handleImport = async () => {
    if (!importToken.trim()) {
      toast.error("Informe o Instance Token");
      return;
    }
    setImporting(true);
    try {
      const inst = await importInstance(importToken.trim(), importSubdomain.trim() || "free");
      toast.success("Instância importada", {
        description: inst?.status === "connected" ? "Já está conectada." : "Escaneie o QR para conectar.",
      });
      setImportOpen(false);
      setImportToken("");
      if (inst && inst.status !== "connected") setQrOpen(true);
    } catch (e) {
      toast.error("Falha ao importar", { description: (e as Error).message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/15 text-success">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-semibold">
                Conexão WhatsApp
                <Badge variant="outline" className="text-[10px]">uazapi</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                {status === "connected" && `Conectado: ${instance?.phone_name ?? instance?.phone ?? "WhatsApp"}`}
                {status === "connecting" && "Aguardando leitura do QR Code..."}
                {status === "disconnected" && "Desconectado"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {status === "connected" && showSync && onSync && (
              <Button variant="outline" onClick={() => void onSync()} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                Sincronizar conversas
              </Button>
            )}
            {status === "connected" && (
              <Button variant="outline" onClick={handleDisconnect} disabled={busy}>Desconectar</Button>
            )}
            {instance && status !== "connected" && (
              <Button variant="outline" onClick={() => setQrOpen(true)} disabled={busy}>
                <QrCode className="h-4 w-4" /> Ver QR
              </Button>
            )}
            {instance && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" disabled={busy || removing}>
                    {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remover conexão
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover conexão do WhatsApp?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso remove a instância ativa deste workspace e libera a tela de Integrações para conectar outro WhatsApp. Também tentaremos encerrar a sessão no provedor.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemove}>Remover conexão</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {status !== "connected" && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)} disabled={busy}>
                  <Download className="h-4 w-4" /> Importar token
                </Button>
                <Button onClick={handleConnect} disabled={busy || loading}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  {instance ? "Reconectar" : "Conectar WhatsApp"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar um aparelho.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrCode ? (
              <img
                src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                alt="QR Code WhatsApp"
                className="h-64 w-64 rounded-lg bg-foreground p-2"
              />
            ) : (
              <div className="flex h-64 w-64 items-center justify-center rounded-lg bg-muted/40">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => refreshStatus()}>
                <RefreshCw className="h-3 w-3" /> Atualizar
              </Button>
            </div>
            {status === "connected" && <p className="text-xs text-success">Conectado com sucesso!</p>}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Importar instância existente</DialogTitle>
            <DialogDescription>
              Cole o Instance Token de uma instância uazapi já criada. O webhook será reconfigurado para este workspace automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="imp-subdomain" className="text-xs">Servidor / Subdomain</Label>
              <Input
                id="imp-subdomain"
                value={importSubdomain}
                onChange={(e) => setImportSubdomain(e.target.value)}
                placeholder="free  ou  free.uazapi.com"
              />
              <p className="text-[11px] text-muted-foreground">
                Use <code>free</code> para <code>https://free.uazapi.com</code>.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="imp-token" className="text-xs">Instance Token</Label>
              <Input
                id="imp-token"
                value={importToken}
                onChange={(e) => setImportToken(e.target.value)}
                placeholder="ex.: e039ef2f-0efc-4676-8965-8d7752b4fd45"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={handleImport} disabled={importing || !importToken.trim()}>
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}