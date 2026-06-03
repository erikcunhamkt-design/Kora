import { useState, useEffect, useCallback } from "react";
import { Bot, Save, AlertCircle, Play, Pause, Loader2, Key, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useVertexCredentials } from "@/hooks/useVertexCredentials";
import type { Database } from "@/integrations/supabase/types";

type BotSettings = Database["public"]["Tables"]["whatsapp_bot_settings"]["Row"];

export function WhatsAppBotConfig({ workspaceId }: { workspaceId: string }) {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [isActive, setIsActive] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [model, setModel] = useState("gemini-1.5-flash");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_bot_settings")
        .select("*")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data);
        setIsActive(data.is_active || false);
        setInstruction(data.system_instruction || "");
        setModel(data.model_name || "gemini-1.5-flash");
      } else {
        // Default template
        setInstruction("Você é o atendente virtual do KORA Hub. Seja prestativo, educado e conciso.");
      }
    } catch (e) {
      toast.error("Erro ao carregar configurações", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId) return;
    loadSettings();
  }, [workspaceId, loadSettings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (settings?.id) {
        // Update
        const { error } = await supabase
          .from("whatsapp_bot_settings")
          .update({
            is_active: isActive,
            system_instruction: instruction,
            model_name: model,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);

        if (error) throw error;
        toast.success("Configurações atualizadas!");
      } else {
        // Insert
        const { data, error } = await supabase
          .from("whatsapp_bot_settings")
          .insert({
            workspace_id: workspaceId,
            is_active: isActive,
            system_instruction: instruction,
            model_name: model,
          })
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        toast.success("Configurações do Chatbot criadas com sucesso!");
      }
    } catch (e) {
      toast.error("Erro ao salvar configurações", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando definições do robô...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2 text-foreground/90">
            <Bot className="h-5 w-5 text-primary animate-pulse" /> Atendente com Inteligência Artificial
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure um robô alimentado pelo Google Gemini para responder seus clientes no WhatsApp.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-card/45 px-3 py-1.5 rounded-xl border border-border/40">
          <span className="text-xs font-semibold text-muted-foreground/80">Status do Bot</span>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-5">
        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground/90 leading-relaxed space-y-1">
            <span className="font-semibold text-foreground">Como funciona o atendimento de IA?</span>
            <p>
              Quando ativado, o robô responderá de forma autônoma a novas conversas ou sempre que o cliente enviar mensagem e o atendimento não estiver atribuído a um atendente humano.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
            Instrução do Sistema / Roteiro do Bot
          </label>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ex: Você atende na Imobiliária Orbyt. Seja prestativo, dê boas-vindas, explique nossos serviços de locação e peça o e-mail do contato..."
            className="min-h-48 text-sm bg-background/50 border-border/60 leading-relaxed"
            required
          />
          <p className="text-[10px] text-muted-foreground/60">
            Defina o comportamento completo do assistente: nome, regras comerciais, formas de falar e informações de contato.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
              Modelo de Linguagem (Google Gemini)
            </label>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemini-1.5-flash"
              className="h-9 text-sm bg-background/50 border-border/60"
              required
            />
          </div>
        </div>

        <Button type="submit" disabled={saving} className="w-full sm:w-auto h-9 text-sm gap-2 px-6">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar Configurações
        </Button>
      </form>
    </div>
  );
}
