import { useEffect, useMemo, useState } from "react";
import { MessageCircle, QrCode, Plug, Send, Smartphone, Loader2, RefreshCw, RotateCw, Download } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { useWhatsAppConversations } from "@/hooks/useWhatsAppConversations";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { supabase } from "@/integrations/supabase/client";

function formatTime(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

export function WhatsAppSection() {
  const { workspace } = useCurrentWorkspace();
  const { instance, loading: loadingInstance, busy, connect, disconnect, refreshStatus, importInstance } = useWhatsAppInstance();
  const { conversations, messages, selectedId, setSelectedId, loading: loadingConv, markRead } = useWhatsAppConversations(
    workspace?.id,
    instance?.id,
  );
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importToken, setImportToken] = useState("");
  const [importSubdomain, setImportSubdomain] = useState("free");
  const [importing, setImporting] = useState(false);

  const status = instance?.status ?? "disconnected";
  const qrCode = instance?.qr_code ?? null;
  const selected = useMemo(() => conversations.find((c) => c.id === selectedId) ?? null, [conversations, selectedId]);

  useEffect(() => {
    if (selectedId) void markRead(selectedId);
  }, [selectedId, markRead]);

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
    try { await disconnect(); toast.success("WhatsApp desconectado"); }
    catch (e) { toast.error("Falha ao desconectar", { description: (e as Error).message }); }
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


  const handleSync = async () => {
    if (!workspace) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "sync", workspaceId: workspace.id },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success(`Sincronizado: ${(data as { synced: number }).synced} conversas`);
    } catch (e) {
      toast.error("Falha ao sincronizar", { description: (e as Error).message });
    } finally { setSyncing(false); }
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedId || !workspace) return;
    setSending(true);
    const text = input.trim();
    setInput("");
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "send", workspaceId: workspace.id, conversationId: selectedId, text },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    } catch (e) {
      toast.error("Falha ao enviar", { description: (e as Error).message });
      setInput(text);
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center"><Smartphone className="h-5 w-5" /></div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
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
          <div className="flex gap-2">
            {status === "connected" && (
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
                Sincronizar conversas
              </Button>
            )}
            {status === "connected" ? (
              <Button variant="outline" onClick={handleDisconnect} disabled={busy}>Desconectar</Button>
            ) : (
              <>
                {instance && (
                  <Button variant="outline" onClick={() => setQrOpen(true)} disabled={busy}>
                    <QrCode className="h-4 w-4" /> Ver QR
                  </Button>
                )}
                <Button onClick={handleConnect} disabled={busy || loadingInstance}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
                  {instance ? "Reconectar" : "Conectar WhatsApp"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Conversas</h2>
        {conversations.length > 0 && (
          <span className="text-xs text-muted-foreground">{conversations.length} conversa(s)</span>
        )}
      </div>

      <Card className="grid md:grid-cols-[280px_1fr] overflow-hidden min-h-[400px]">
        <div className="border-r border-border/40 overflow-y-auto max-h-[500px]">
          {loadingConv && (
            <div className="p-4 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando...
            </div>
          )}
          {!loadingConv && conversations.length === 0 && (
            <div className="p-4 text-xs text-muted-foreground">
              {status === "connected"
                ? "Nenhuma conversa ainda. Clique em 'Sincronizar conversas' ou envie/receba uma mensagem."
                : "Conecte o WhatsApp para ver as conversas."}
            </div>
          )}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 border-b border-border/40 hover:bg-muted/30 transition-colors ${selectedId === c.id ? "bg-muted/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{c.contact_name ?? c.contact_phone}</span>
                {c.unread_count > 0 && (
                  <Badge variant="default" className="h-5 min-w-5 px-1.5 text-[10px]">{c.unread_count}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.last_message ?? "—"}</p>
              <div className="flex items-center justify-between gap-1 mt-1">
                <Badge variant="secondary" className="text-[9px]">{c.status}</Badge>
                <span className="text-[10px] text-muted-foreground">{formatTime(c.last_message_at)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          {selected ? (
            <>
              <div className="p-3 border-b border-border/40">
                <p className="font-medium text-sm">{selected.contact_name ?? selected.contact_phone}</p>
                <p className="text-xs text-muted-foreground">{selected.contact_phone}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px]">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center">Nenhuma mensagem nesta conversa ainda.</p>
                )}
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`max-w-[75%] p-2 rounded-lg text-sm ${m.direction === "outbound" ? "ml-auto bg-primary/20" : "bg-muted/50"}`}
                  >
                    <div>{m.content ?? <span className="italic text-muted-foreground">[{m.type}]</span>}</div>
                    <div className="text-[10px] opacity-60 mt-1 text-right">{formatTime(m.created_at)}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 p-3 border-t border-border/40">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={status === "connected" ? "Mensagem..." : "Conecte para enviar"}
                  disabled={status !== "connected" || sending}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button onClick={handleSend} disabled={sending || status !== "connected" || !input.trim()}>
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              <MessageCircle className="h-5 w-5 mr-2" /> Selecione uma conversa
            </div>
          )}
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
                className="h-64 w-64 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="h-64 w-64 bg-muted/40 rounded-lg flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => refreshStatus()}>
                <RefreshCw className="h-3 w-3" /> Atualizar
              </Button>
            </div>
            {status === "connected" && (
              <p className="text-xs text-emerald-400">Conectado com sucesso!</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
