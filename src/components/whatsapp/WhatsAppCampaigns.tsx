import { useState, useEffect, useCallback } from "react";
import { Send, Users, Play, Pause, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Campaign = Database["public"]["Tables"]["whatsapp_campaigns"]["Row"];

export function WhatsAppCampaigns({ workspaceId }: { workspaceId: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState("");
  const [contactsText, setContactsText] = useState(""); // List of phone numbers (comma, semicolon or line separated)

  useEffect(() => {
    if (!workspaceId) return;
    loadCampaigns();
  }, [workspaceId, loadCampaigns]);

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_campaigns")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCampaigns(data || []);
    } catch (e) {
      toast.error("Erro ao carregar campanhas", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !template.trim() || !contactsText.trim()) {
      toast.warning("Preencha todos os campos obrigatórios.");
      return;
    }

    setCreating(true);
    try {
      // Parse contacts (extract numeric values)
      const phones = contactsText
        .split(/[\n,;]+/)
        .map((p) => p.replace(/\D/g, "").trim())
        .filter((p) => p.length >= 8);

      if (phones.length === 0) {
        toast.warning("Nenhum número de telefone válido encontrado.");
        setCreating(false);
        return;
      }

      // 1. Create Campaign row
      const { data: campaign, error: cError } = await supabase
        .from("whatsapp_campaigns")
        .insert({
          workspace_id: workspaceId,
          title,
          message_template: template,
          status: "draft",
          total_contacts: phones.length,
          sent_contacts: 0,
          failed_contacts: 0,
        })
        .select()
        .single();

      if (cError) throw cError;

      // 2. Add to Queue
      const queueItems = phones.map((phone) => ({
        campaign_id: campaign.id,
        workspace_id: workspaceId,
        phone,
        status: "pending",
      }));

      const { error: qError } = await supabase.from("whatsapp_queue").insert(queueItems);
      if (qError) throw qError;

      toast.success("Campanha criada com sucesso!");
      setTitle("");
      setTemplate("");
      setContactsText("");
      loadCampaigns();
    } catch (e) {
      toast.error("Falha ao criar campanha", { description: (e as Error).message });
    } finally {
      setCreating(false);
    }
  };

  const triggerProcessing = async (campaignId: string) => {
    try {
      // Executa a Edge Function que processa o envio das mensagens da fila
      await supabase.functions.invoke("whatsapp-campaign-processor", {
        body: { campaignId, workspaceId },
      });
      loadCampaigns();
    } catch (e) {
      console.error("Erro ao iniciar processador de disparos:", e);
    }
  };

  const handleStartCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_campaigns")
        .update({ status: "sending" })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Disparo iniciado!");
      triggerProcessing(campaignId);
    } catch (e) {
      toast.error("Erro ao iniciar disparo", { description: (e as Error).message });
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    try {
      const { error } = await supabase
        .from("whatsapp_campaigns")
        .update({ status: "paused" })
        .eq("id", campaignId);
      if (error) throw error;
      toast.success("Campanha pausada!");
      loadCampaigns();
    } catch (e) {
      toast.error("Erro ao pausar campanha", { description: (e as Error).message });
    }
  };

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-hidden">
      {/* Criar Campanha */}
      <div className="w-full lg:w-96 border-b lg:border-b-0 lg:border-r border-border/40 p-4 space-y-4 overflow-y-auto bg-card/25 flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground/90">
            <Send className="h-4 w-4 text-primary" /> Novo Disparo em Massa
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Envie mensagens de forma cadenciada para evitar bloqueios.
          </p>
        </div>

        <form onSubmit={handleCreateCampaign} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Título da Campanha
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Oferta de Lançamento"
              className="h-9 text-sm bg-background/50 border-border/60"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center justify-between">
              <span>Lista de Contatos</span>
              <span className="text-[9px] text-muted-foreground/60 normal-case font-normal">
                Um número por linha
              </span>
            </label>
            <Textarea
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              placeholder="5511999999999&#10;5521988888888"
              className="min-h-24 text-xs font-mono bg-background/50 border-border/60 resize-none"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Mensagem a Enviar
            </label>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              placeholder="Olá! Conheça nosso portfólio de serviços no link..."
              className="min-h-28 text-xs bg-background/50 border-border/60"
              required
            />
          </div>

          <Button type="submit" disabled={creating} className="w-full h-9 text-sm gap-2">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Criar Campanha
          </Button>
        </form>
      </div>

      {/* Listagem de Campanhas */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground/90">
            <Users className="h-4 w-4" /> Histórico de Disparos
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Acompanhe o andamento dos disparos ativos e concluídos.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-border/55 rounded-xl">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/35 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma campanha criada ainda.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => {
              const pct = c.total_contacts > 0 ? Math.round(((c.sent_contacts + c.failed_contacts) / c.total_contacts) * 100) : 0;
              return (
                <div key={c.id} className="border border-border/40 bg-card/25 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate text-foreground">{c.title}</span>
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          c.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                          c.status === "sending" ? "bg-primary/10 text-primary" :
                          c.status === "paused" ? "bg-amber-500/10 text-amber-400" :
                          "bg-muted/40 text-muted-foreground"
                        }`}>
                          {c.status === "completed" ? "Finalizado" :
                           c.status === "sending" ? "Enviando" :
                           c.status === "paused" ? "Pausado" : "Rascunho"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate max-w-lg mt-0.5">{c.message_template}</p>
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                      <span>Total: <strong>{c.total_contacts}</strong></span>
                      <span className="text-emerald-400">Enviados: <strong>{c.sent_contacts}</strong></span>
                      <span className="text-destructive">Falhas: <strong>{c.failed_contacts}</strong></span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground/60">
                        <span>Progresso</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-background/50 h-1.5 rounded-full overflow-hidden border border-border/30">
                        <div className="bg-primary h-full transition-all duration-300" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {c.status === "draft" || c.status === "paused" ? (
                      <Button size="sm" className="gap-1.5 h-8 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/10" onClick={() => handleStartCampaign(c.id)}>
                        <Play className="h-3.5 w-3.5" /> Iniciar
                      </Button>
                    ) : c.status === "sending" ? (
                      <Button size="sm" variant="outline" className="gap-1.5 h-8 border-amber-500/25 text-amber-400 hover:bg-amber-500/5" onClick={() => handlePauseCampaign(c.id)}>
                        <Pause className="h-3.5 w-3.5" /> Pausar
                      </Button>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium px-2 py-1 bg-emerald-500/5 border border-emerald-500/15 rounded-md">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Concluído
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
