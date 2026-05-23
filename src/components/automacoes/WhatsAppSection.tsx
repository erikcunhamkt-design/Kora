import { useState } from "react";
import { MessageCircle, QrCode, Plug, Send, Plus, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useWhatsAppMock } from "@/hooks/useWhatsAppMock";

export function WhatsAppSection() {
  const { connection, conversations, messages, simulateConnect, disconnect, sendMessage, createConversation } = useWhatsAppMock();
  const [selectedId, setSelectedId] = useState<string | null>(conversations[0]?.id ?? null);
  const [input, setInput] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [form, setForm] = useState({ contactName: "", phone: "", firstMessage: "" });

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const thread = messages.filter((m) => m.conversationId === selectedId);

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
              <h3 className="font-semibold">Conexão WhatsApp</h3>
              <p className="text-xs text-muted-foreground">
                {connection.status === "connected" && `Conectado: ${connection.phoneName}`}
                {connection.status === "connecting" && "Conectando..."}
                {connection.status === "disconnected" && "Desconectado"}
              </p>
            </div>
          </div>
          {connection.status === "connected" ? (
            <Button variant="outline" onClick={disconnect}>Desconectar</Button>
          ) : (
            <Button onClick={simulateConnect}><Plug className="h-4 w-4" /> Simular conexão</Button>
          )}
        </div>
        {connection.status !== "connected" && (
          <div className="mt-4 flex flex-col items-center gap-2 py-6 border border-dashed border-border/60 rounded-lg">
            <div className="h-32 w-32 bg-muted/40 rounded-lg flex items-center justify-center"><QrCode className="h-16 w-16 text-muted-foreground" /></div>
            <p className="text-xs text-muted-foreground">QR Code de exemplo — escaneie no app real (simulação)</p>
          </div>
        )}
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
