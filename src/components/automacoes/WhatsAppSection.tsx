import { useState } from "react";
import { MessageCircle, QrCode, Plug, Send, Plus, Smartphone, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWhatsAppMock } from "@/hooks/useWhatsAppMock";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";

export function WhatsAppSection() {
  const { conversations, messages, sendMessage, createConversation } = useWhatsAppMock();
  const { instance, loading, busy, connect, disconnect, refreshStatus } = useWhatsAppInstance();
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [form, setForm] = useState({ contactName: "", phone: "", firstMessage: "" });

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const thread = messages.filter((m) => m.conversationId === selectedId);

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
      toast.success("WhatsApp desconectado");
    } catch (e) {
      toast.error("Falha ao desconectar", { description: (e as Error).message });
    }
  };

  const handleSend = () => {
    if (!input.trim() || !selectedId) return;
    sendMessage(selectedId, input);
    setInput("");
  };

  const handleCreate = () => {
    if (!form.contactName.trim() || !form.phone.trim()) return toast.error("Nome e telefone obrigatórios");
    const id = createConversation(form);
    setSelectedId(id);
    setForm({ contactName: "", phone: "", firstMessage: "" });
    setNewOpen(false);
    toast.success("Conversa criada");
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
            {status === "connected" ? (
              <Button variant="outline" onClick={handleDisconnect} disabled={busy}>Desconectar</Button>
            ) : (
              <>
                {instance && (
                  <Button variant="outline" onClick={() => setQrOpen(true)} disabled={busy}>
                    <QrCode className="h-4 w-4" /> Ver QR
                  </Button>
                )}
                <Button onClick={handleConnect} disabled={busy || loading}>
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
        <Button variant="outline" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nova conversa</Button>
      </div>

      <Card className="grid md:grid-cols-[280px_1fr] overflow-hidden min-h-[400px]">
        <div className="border-r border-border/40 overflow-y-auto max-h-[500px]">
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className={`w-full text-left p-3 border-b border-border/40 hover:bg-muted/30 transition-colors ${selectedId === c.id ? "bg-muted/40" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm truncate">{c.contactName}</span>
                {c.isDemo && <Badge variant="outline" className="text-[9px]">demo</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
              <div className="flex items-center gap-1 mt-1">
                <Badge variant="secondary" className="text-[9px]">{c.status}</Badge>
              </div>
            </button>
          ))}
        </div>
        <div className="flex flex-col">
          {selected ? (
            <>
              <div className="p-3 border-b border-border/40">
                <p className="font-medium text-sm">{selected.contactName}</p>
                <p className="text-xs text-muted-foreground">{selected.phone}</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[380px]">
                {thread.map((m) => (
                  <div key={m.id} className={`max-w-[75%] p-2 rounded-lg text-sm ${m.direction === "outbound" ? "ml-auto bg-primary/20" : "bg-muted/50"}`}>
                    {m.text}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 p-3 border-t border-border/40">
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Mensagem..." onKeyDown={(e) => e.key === "Enter" && handleSend()} />
                <Button onClick={handleSend}><Send className="h-4 w-4" /></Button>
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

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova conversa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome do contato *</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></div>
            <div><Label>Telefone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+55 11 9..." /></div>
            <div><Label>Mensagem inicial</Label><Textarea value={form.firstMessage} onChange={(e) => setForm({ ...form, firstMessage: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
