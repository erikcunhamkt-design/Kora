import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plug, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { useIntegrations } from "@/hooks/useIntegrations";
import { useWhatsAppInstance } from "@/hooks/useWhatsAppInstance";
import { WhatsAppConnectionCard } from "@/components/automacoes/WhatsAppConnectionCard";

export function IntegrationsSection() {
  const { items, toggleConnection } = useIntegrations();
  const { instance, loading, busy, connect, disconnect, removeInstance, refreshStatus, importInstance } = useWhatsAppInstance();
  const visibleItems = items.filter((i) => i.id !== "whatsapp");

  const handle = (id: string, status: string) => {
    if (status === "coming_soon") return toast.info("Em breve");
    toggleConnection(id);
    toast.success(status === "connected" ? "Desconectado (simulado)" : "Conexão simulada");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Integrações</h2>
        <p className="text-sm text-muted-foreground">
          Conecte o WhatsApp do atendimento e gerencie as demais ferramentas externas.
        </p>
      </div>
      <WhatsAppConnectionCard
        instance={instance}
        loading={loading}
        busy={busy}
        connect={connect}
        disconnect={disconnect}
        removeInstance={removeInstance}
        refreshStatus={refreshStatus}
        importInstance={importInstance}
      />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleItems.map((i) => (
          <Card key={i.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold truncate">{i.name}</h3>
                <p className="text-xs text-muted-foreground">{i.category}</p>
              </div>
              {i.status === "connected" && <Badge className="bg-success/15 text-success border-success/30"><Check className="h-3 w-3" /> Conectado</Badge>}
              {i.status === "disconnected" && <Badge variant="outline">Desconectado</Badge>}
              {i.status === "coming_soon" && <Badge variant="secondary"><Clock className="h-3 w-3" /> Em breve</Badge>}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{i.description}</p>
            <Button
              variant={i.status === "connected" ? "outline" : "default"}
              className="w-full"
              disabled={i.status === "coming_soon"}
              onClick={() => handle(i.id, i.status)}
            >
              <Plug className="h-4 w-4" /> {i.status === "connected" ? "Desconectar" : "Conectar"}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
