import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Bot, Save, AlertCircle, Loader2, Server, Key, BrainCircuit, 
  Sparkles, MessageSquareCode, Settings2, HelpCircle, Send, 
  Trash2, RefreshCw, CheckCircle2, ShieldAlert, UserCog
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BotSettings = Database["public"]["Tables"]["whatsapp_bot_settings"]["Row"];

export function WhatsAppBotConfig({ workspaceId }: { workspaceId: string }) {
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [isActive, setIsActive] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [provider, setProvider] = useState<"lovable" | "gemini_api_key" | "vertex_ai">("lovable");
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [gcpProjectId, setGcpProjectId] = useState("");
  const [gcpRegion, setGcpRegion] = useState("us-central1");
  const [gcpServiceAccount, setGcpServiceAccount] = useState("");
  const [respondAll, setRespondAll] = useState(true);

  // Simulator states
  const [simMessages, setSimMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([
    { role: "model", text: "Olá! Eu sou o simulador da sua IA. Salve suas credenciais e envie uma mensagem para testar minhas respostas e regras de prompt em tempo real!" }
  ]);
  const [simInput, setSimInput] = useState("");
  const [simulating, setSimulating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
        
        const dbModel = data.model_name || "gemini-2.5-flash";
        const modelAliases: Record<string, string> = {
          "gemini-1.5-flash": "gemini-2.5-flash",
          "gemini-1.5-flash-001": "gemini-2.5-flash",
          "gemini-1.5-flash-002": "gemini-2.5-flash",
          "gemini-1.5-pro": "gemini-2.5-pro",
          "gemini-1.5-pro-001": "gemini-2.5-pro",
          "gemini-1.5-pro-002": "gemini-2.5-pro",
          "gemini-2.0-flash": "gemini-2.5-flash",
          "gemini-2.0-flash-001": "gemini-2.5-flash",
          "gemini-2.5-flash-001": "gemini-2.5-flash",
          "gemini-2.5-pro-001": "gemini-2.5-pro",
        };
        setModel(["gemini-2.5-flash", "gemini-2.5-pro"].includes(dbModel) ? dbModel : modelAliases[dbModel] || "gemini-2.5-flash");

        setProvider((data as any).provider || "lovable");
        setGeminiApiKey((data as any).gemini_api_key || "");
        setRespondAll((data as any).respond_all ?? true);
        setGcpRegion((data as any).gcp_region || "us-central1");
        const sa = (data as any).gcp_service_account || "";
        setGcpServiceAccount(sa);
        
        let loadedProjectId = (data as any).gcp_project_id || "";
        if (!loadedProjectId && sa) {
          try {
            const parsed = JSON.parse(sa);
            if (parsed.project_id) {
              loadedProjectId = parsed.project_id;
            }
          } catch {
            // ignore
          }
        }
        setGcpProjectId(loadedProjectId);
      } else {
        setInstruction("Você é o atendente virtual do KORA Hub. Seja prestativo, educado e conciso.");
        setIsActive(false);
        setProvider("lovable");
        setModel("gemini-2.5-flash");
        setRespondAll(true);
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

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [simMessages]);

  const handleModelChange = (val: string) => {
    setModel(val);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let activeGcpProjectId = gcpProjectId;
    if (!activeGcpProjectId && gcpServiceAccount) {
      try {
        const parsed = JSON.parse(gcpServiceAccount);
        if (parsed.project_id) {
          activeGcpProjectId = parsed.project_id;
        }
      } catch (err) {
        // ignore
      }
    }

    try {
      const payload: any = {
        workspace_id: workspaceId,
        is_active: isActive,
        system_instruction: instruction,
        model_name: model,
        provider,
        gemini_api_key: geminiApiKey || null,
        gcp_project_id: activeGcpProjectId || null,
        gcp_region: gcpRegion || null,
        gcp_service_account: gcpServiceAccount || null,
        respond_all: respondAll,
      };

      if (settings?.id) {
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from("whatsapp_bot_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
        toast.success("Configurações do Robô salvas com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("whatsapp_bot_settings")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        toast.success("Configurações do Robô ativadas e salvas!");
      }
    } catch (e) {
      toast.error("Erro ao salvar configurações", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleSimulateMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simInput.trim() || simulating) return;

    const userText = simInput;
    setSimInput("");
    
    // Append user message
    const updatedHistory = [...simMessages, { role: "user" as const, text: userText }];
    setSimMessages(updatedHistory);
    setSimulating(true);

    try {
      // Call the edge function in test mode
      const { data, error } = await supabase.functions.invoke("whatsapp-bot-reply", {
        body: {
          isTest: true,
          systemInstruction: instruction,
          provider,
          modelName: model,
          geminiApiKey: provider === "gemini_api_key" ? geminiApiKey : null,
          gcpProjectId: provider === "vertex_ai" ? gcpProjectId : null,
          gcpRegion: provider === "vertex_ai" ? gcpRegion : "us-central1",
          gcpServiceAccount: provider === "vertex_ai" ? gcpServiceAccount : null,
          messageText: userText,
          // Extract message history formatted for Deno serve format
          history: updatedHistory.slice(1).map(m => ({ role: m.role, text: m.text }))
        }
      });

      if (error) throw error;

      if (data && data.reply) {
        setSimMessages(prev => [...prev, { role: "model", text: data.reply }]);
      } else {
        throw new Error("Resposta da IA vazia");
      }
    } catch (err) {
      console.error(err);
      setSimMessages(prev => [
        ...prev, 
        { role: "model", text: `❌ Falha ao testar IA: ${(err as Error).message || "Erro desconhecido. Verifique suas chaves e o provedor selecionado."}` }
      ]);
    } finally {
      setSimulating(false);
    }
  };

  const handleResetSimulator = () => {
    setSimMessages([
      { role: "model", text: "Simulador resetado! Envie uma nova mensagem para conversar com a IA utilizando seu roteiro e chaves configuradas." }
    ]);
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-sm text-muted-foreground bg-card/10 backdrop-blur-lg rounded-2xl border border-border/20 m-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" /> 
        <span>Carregando definições e credenciais do assistente...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Premium Elegant Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card-elevated/70 via-background/90 to-primary/10 p-6 md:p-8 shadow-xl backdrop-blur-md">
        <div className="absolute -right-10 -top-10 h-48 w-48 bg-primary/20 rounded-full blur-3xl -z-10" />
        <div className="absolute right-1/4 bottom-0 h-28 w-28 bg-violet-500/10 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
              <Bot className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Assistente Virtual WhatsApp
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
                  Gemini & Vertex AI
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl mt-1.5 leading-relaxed">
                Automatize as conversas do seu WhatsApp integrando diretamente modelos de IA. Crie roteiros personalizados, configure sua própria chave de API para obter taxa zero e teste a inteligência antes do deploy.
              </p>
            </div>
          </div>

          {/* Active switch */}
          <div className="flex items-center justify-between gap-4 bg-card-elevated/80 border border-border/60 px-5 py-3 rounded-xl shrink-0 self-start md:self-center shadow-sm">
            <div className="text-left pr-2">
              <p className="text-xs font-bold text-foreground">Status do Robô</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isActive ? "🟢 Ativo e respondendo" : "🔴 Desativado / Pausado"}
              </p>
            </div>
            <Switch 
              checked={isActive} 
              onCheckedChange={setIsActive} 
              className="data-[state=checked]:bg-emerald-500" 
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left: Configuration Form (7/12) */}
        <form onSubmit={handleSaveSettings} className="lg:col-span-7 space-y-6">
          
          {/* Identity & Behavior Panel */}
          <div className="rounded-xl border border-border/40 bg-card p-6 space-y-5 shadow-md">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2 border-b border-border/40 pb-3">
              <MessageSquareCode className="h-4 w-4 text-violet-500" /> Roteiro e Inteligência
            </h3>

            {/* Instruction input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Instruções de Personalidade (Prompt) *
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-violet-400">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm text-xs p-3 leading-relaxed">
                      Defina quem a IA representa, como ela deve responder, se deve usar emojis, regras de cordialidade, escopo de produtos da empresa, e a ação principal (ex: coletar e-mail e encaminhar para atendente).
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex: Você é a Sofia, assistente virtual da Imobiliária Orbit. Seu tom deve ser amigável e focado em soluções. Pergunte se o cliente quer comprar ou alugar um imóvel. Sempre solicite o e-mail ou telefone para contato antes de encerrar o atendimento."
                className="min-h-56 text-sm bg-background/30 border-border/60 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 leading-relaxed font-sans"
                required
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Modelo de IA
              </label>
              <Select value={model} onValueChange={handleModelChange}>
                <SelectTrigger className="bg-background/30 border-border/60 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {provider === "vertex_ai" ? (
                    <>
                      <SelectItem value="gemini-2.5-flash-001">Gemini 2.5 Flash (001)</SelectItem>
                      <SelectItem value="gemini-2.5-pro-001">Gemini 2.5 Pro (001)</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (Recomendado)</SelectItem>
                      <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (Avançado)</SelectItem>
                      <SelectItem value="gemini-2.0-flash">Gemini 2.0 Flash (Mais rápido)</SelectItem>
                    </>
                  )}
                  <SelectItem value="custom">Outro Modelo (Digitar ID)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustomModel && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  ID do Modelo Customizado *
                </label>
                <Input
                  value={customModelName}
                  onChange={(e) => setCustomModelName(e.target.value)}
                  placeholder="ex: gemini-2.5-pro"
                  className="h-9 text-sm bg-background/30 border-border/60 focus:border-violet-500"
                  required
                />
                <p className="text-[10px] text-muted-foreground">Insira o ID oficial do modelo de IA do Google (ex: gemini-1.5-flash-latest).</p>
              </div>
            )}

            {/* Modo de Atendimento / Escopo do Robô */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block flex items-center gap-1.5">
                Modo de Atendimento / Escopo do Robô *
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="text-muted-foreground/60 hover:text-violet-400">
                        <HelpCircle className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Escolha se a IA deve responder a qualquer cliente ou apenas realizar a triagem inicial de novos atendimentos.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </label>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                
                {/* Option 1: Respond to any conversation */}
                <div 
                  onClick={() => setRespondAll(true)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                    respondAll 
                      ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5" 
                      : "border-border/60 bg-background/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-violet-400" /> Qualquer Conversa (Irrestrito)
                    </span>
                    {respondAll && <CheckCircle2 className="h-4 w-4 text-violet-500" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    O robô responderá a todas as mensagens de qualquer cliente, incluindo conversas que já estão em andamento ou antigas.
                  </p>
                </div>

                {/* Option 2: Respond only to new conversations */}
                <div 
                  onClick={() => setRespondAll(false)}
                  className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                    !respondAll 
                      ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5" 
                      : "border-border/60 bg-background/20"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <UserCog className="h-4 w-4 text-violet-400" /> Apenas Conversas Novas (Triagem)
                    </span>
                    {!respondAll && <CheckCircle2 className="h-4 w-4 text-violet-500" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    O robô responderá somente a contatos novos sem atendente atribuído. Se um atendente humano intervir, a IA pausará automaticamente.
                  </p>
                </div>

              </div>
            </div>
          </div>

          {/* Provider and Credentials Panel */}
          <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6 shadow-md">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2 border-b border-border/40 pb-3">
              <Settings2 className="h-4 w-4 text-violet-500" /> Provedor de IA & Cobrança
            </h3>

            {/* Provider Grid Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              
              {/* Option 1: Lovable Gateway */}
              <div 
                onClick={() => setProvider("lovable")}
                className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                  provider === "lovable" 
                    ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5" 
                    : "border-border/60 bg-background/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <BrainCircuit className={`h-5 w-5 ${provider === "lovable" ? "text-violet-400" : "text-muted-foreground"}`} />
                  {provider === "lovable" && <CheckCircle2 className="h-4 w-4 text-violet-500" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Créditos KORA</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                    Fácil configuração. Consome créditos de IA do seu plano KORA Hub.
                  </p>
                </div>
              </div>

              {/* Option 2: Gemini API Key */}
              <div 
                onClick={() => setProvider("gemini_api_key")}
                className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                  provider === "gemini_api_key" 
                    ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5" 
                    : "border-border/60 bg-background/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Key className={`h-5 w-5 ${provider === "gemini_api_key" ? "text-violet-400" : "text-muted-foreground"}`} />
                  {provider === "gemini_api_key" && <CheckCircle2 className="h-4 w-4 text-violet-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="text-xs font-bold text-foreground">Gemini API Key</h4>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.2 rounded font-semibold border border-emerald-500/20">Taxa 0</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                    Conecte sua API Key própria do Google AI Studio. Sem cobrança de créditos KORA.
                  </p>
                </div>
              </div>

              {/* Option 3: GCP Vertex AI */}
              <div 
                onClick={() => setProvider("vertex_ai")}
                className={`relative rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                  provider === "vertex_ai" 
                    ? "border-violet-500 bg-violet-500/5 shadow-md shadow-violet-500/5" 
                    : "border-border/60 bg-background/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Server className={`h-5 w-5 ${provider === "vertex_ai" ? "text-violet-400" : "text-muted-foreground"}`} />
                  {provider === "vertex_ai" && <CheckCircle2 className="h-4 w-4 text-violet-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <h4 className="text-xs font-bold text-foreground">Vertex AI (GCP)</h4>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.2 rounded font-semibold border border-emerald-500/20">Taxa 0</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-normal">
                    Integre credenciais corporativas do Google Cloud. Sem descontar créditos KORA.
                  </p>
                </div>
              </div>

            </div>

            {/* Credentials Inputs based on Provider */}
            <div className="transition-all duration-300">
              
              {provider === "lovable" && (
                <div className="bg-background/40 border border-border/40 p-4 rounded-xl space-y-1.5">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <BrainCircuit className="h-4 w-4 text-violet-400" /> Lovable AI Gateway
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Você está utilizando o servidor padrão da plataforma. As mensagens consumirão o saldo de créditos KORA Hub de sua conta. Nenhuma chave de API externa é necessária para este modo.
                  </p>
                </div>
              )}

              {provider === "gemini_api_key" && (
                <div className="space-y-3 bg-background/20 border border-border/40 p-4 rounded-xl">
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Key className="h-3.5 w-3.5 text-violet-400" /> API Key do Gemini *
                      </label>
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-violet-400 hover:underline flex items-center gap-0.5 font-medium"
                      >
                        Obter chave no AI Studio ↗
                      </a>
                    </div>
                    <Input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      placeholder="Insira sua chave AIzaSy..."
                      className="h-9 text-sm bg-background/40 border-border/60 focus:border-violet-500"
                      required
                    />
                  </div>
                </div>
              )}

              {provider === "vertex_ai" && (
                <div className="space-y-4 bg-background/20 border border-border/40 p-4 rounded-xl">

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      Conta de Serviço GCP (JSON) *
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button type="button" className="text-muted-foreground/60 hover:text-violet-400">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-[10px] leading-relaxed">
                            Crie uma Service Account no GCP Console, conceda a permissão "Vertex AI User" e gere uma chave em formato JSON. Cole o conteúdo completo do arquivo JSON aqui.
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </label>
                    <Textarea
                      value={gcpServiceAccount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setGcpServiceAccount(val);
                        try {
                          const parsed = JSON.parse(val);
                          if (parsed.project_id) {
                            setGcpProjectId(parsed.project_id);
                            toast.success("Project ID extraído do JSON automaticamente!");
                          }
                        } catch {
                          // ignore parser error as they type
                        }
                      }}
                      placeholder='{"type": "service_account", "project_id": "...", "private_key": "...", ...}'
                      className="min-h-[140px] text-xs bg-background/40 border-border/60 font-mono focus:border-violet-500 leading-relaxed"
                      required
                    />
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Alert check info */}
          <div className="bg-violet-950/20 border border-violet-500/25 rounded-xl p-4 flex gap-3 shadow-inner">
            <ShieldAlert className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground block mb-0.5">Nota sobre chaves de API</span>
              Sempre salve suas configurações clicando no botão abaixo antes de realizar o teste definitivo nos aparelhos conectados ou no simulador lateral.
            </div>
          </div>

          {/* Submit */}
          <Button 
            type="submit" 
            disabled={saving} 
            className="w-full h-11 text-sm gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0 text-white font-semibold shadow-lg shadow-violet-600/15 transition-all hover:scale-[1.005] hover:brightness-105 active:scale-[0.995]"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
            Salvar e Aplicar Configurações
          </Button>

        </form>

        {/* Right: Simulator Playground (5/12) */}
        <div className="lg:col-span-5 h-[640px] flex flex-col rounded-xl border border-border/40 bg-card shadow-md overflow-hidden">
          
          {/* Simulator Header */}
          <div className="bg-gradient-to-r from-violet-950/30 to-indigo-950/30 px-4 py-3.5 border-b border-border/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Simulador da IA</span>
            </div>
            
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={handleResetSimulator}
                      className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Reiniciar Chat</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Simulator Messages Screen */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-background/25 flex flex-col min-h-0">
            {simMessages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start flex-row"}`}
              >
                {/* Avatar icon */}
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === "user" ? "bg-violet-600/20 text-violet-400" : "bg-card-elevated text-violet-500 border border-border/40"
                }`}>
                  {msg.role === "user" ? "U" : <Bot className="h-4 w-4" />}
                </div>

                {/* Bubble content */}
                <div className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-violet-600 text-white rounded-tr-none" 
                    : "bg-card border border-border/40 text-foreground/90 rounded-tl-none"
                }`}>
                  <p className="whitespace-pre-line font-sans">{msg.text}</p>
                </div>
              </div>
            ))}

            {simulating && (
              <div className="flex gap-2.5 max-w-[80%] self-start flex-row">
                <div className="h-7 w-7 rounded-lg bg-card-elevated text-violet-500 border border-border/40 flex items-center justify-center shrink-0 animate-pulse">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-card border border-border/40 rounded-2xl rounded-tl-none px-3.5 py-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
                  <span>Gerando resposta com IA...</span>
                </div>
              </div>
            )}
            
            <div ref={chatEndRef} />
          </div>

          {/* Simulator Input Bar */}
          <form onSubmit={handleSimulateMessage} className="p-3 border-t border-border/40 bg-card-elevated/50 flex gap-2 shrink-0">
            <Input
              value={simInput}
              onChange={(e) => setSimInput(e.target.value)}
              placeholder="Digite uma mensagem de teste..."
              disabled={simulating}
              className="h-9 text-xs bg-background/40 border-border/60 focus:border-violet-500 focus:ring-violet-500"
            />
            <Button 
              type="submit" 
              disabled={!simInput.trim() || simulating} 
              size="icon" 
              className="h-9 w-9 shrink-0 bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>

        </div>

      </div>
    </div>
  );
}

// Simple Badge component
function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border ${className}`}>
      {children}
    </div>
  );
}
