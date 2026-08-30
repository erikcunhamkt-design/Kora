import { useState, useEffect, useCallback, useRef } from "react";
import {
  Bot, Save, AlertCircle, Loader2, Server, Key, BrainCircuit,
  Sparkles, MessageSquareCode, Settings2, HelpCircle, Send,
  RefreshCw, CheckCircle2, ShieldAlert, UserCog, Network,
  ArrowRight, ToggleLeft, ToggleRight, Play, Eye, Lock,
  Plus, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { toastError } from "@/lib/supabase/errors";

type BotSettings = Database["public"]["Tables"]["whatsapp_bot_settings"]["Row"];
type BotSettingsInsert = Database["public"]["Tables"]["whatsapp_bot_settings"]["Insert"];

export interface WorkflowNodeBase {
  id: string;
  title: string;
  enabled: boolean;
}

export interface TriggerWorkflowNode extends WorkflowNodeBase {
  type: "trigger";
  properties: { respondAll: boolean };
}

export interface AiWorkflowNode extends WorkflowNodeBase {
  type: "ai";
  properties: {
    instruction: string;
    model: string;
    provider: string;
    geminiApiKey: string;
    gcpProjectId: string;
    gcpRegion: string;
    gcpServiceAccount: string;
    customModelName: string;
  };
}

export interface SendWorkflowNode extends WorkflowNodeBase {
  type: "send";
  properties: { template: string };
}

export interface HandoverWorkflowNode extends WorkflowNodeBase {
  type: "handover";
  properties: { assignTo: string };
}

// Etapa 9 · Item 4 (construtor de fluxo scriptado), fatia R1 — fundação de
// dados (docs/qa/etapa-9-bot-fluxo-scriptado-r1-fundacao.md). Decisão do
// operador ("Opção B-Kora"): árvore 100% montável pelo usuário — cada
// opção do menu aponta pra outro nó via `nextNodeId` (mesmo padrão de
// `PipelineStage.id` do CRM, string livre, não um enum fixo, porque quem
// monta a árvore é o próprio usuário). Fallback default é RE-PROMPT
// ("responda com uma opção válida", reapresenta o mesmo menu) — nunca um
// transbordo automático no primeiro erro; só depois de `maxTentativas`
// esgotado é que decide entre reprompt indefinido ou pular pra outro nó
// (tipicamente um `HandoverWorkflowNode`, mas `fallbackNodeId` aceita
// qualquer nó — a árvore não impõe destino fixo). Nó "menu" é uma
// alternativa ao nó "ai" na árvore (mensagem scriptada, sem custo de IA),
// nunca uma dependência dele — a IA continua um nó OPCIONAL na árvore
// inteira, nunca obrigatório em nenhum caminho.
//
// ZERO mudança de runtime/UI nesta rodada — o tipo existe na união, mas
// `nodes` (estado inicial do componente) e o inspector/renderer (`activeNode.type
// === "..."`) não ganham nenhum caso "menu" ainda; isso é fatia futura,
// quando o construtor visual de árvore for desenhado.
export interface MenuWorkflowNodeOption {
  numero: number;
  rotulo: string;
  /** Id de outro nó da árvore (`WorkflowNode.id`) — string livre, montada pelo usuário. */
  nextNodeId: string;
}

export interface MenuWorkflowNodeFallback {
  /** Quantas respostas inválidas em sequência antes de aplicar `acao`. */
  maxTentativas: number;
  /** "reprompt" reapresenta o mesmo menu (default do produto); "node" pula pra `fallbackNodeId`. */
  acao: "reprompt" | "node";
  /** Obrigatório quando `acao === "node"` — não validado em tipo (união discriminada faria o node perder a forma comum), validar em runtime quando a fatia de execução existir. */
  fallbackNodeId?: string;
}

export interface MenuWorkflowNode extends WorkflowNodeBase {
  type: "menu";
  properties: {
    mensagem: string;
    opcoes: MenuWorkflowNodeOption[];
    fallback: MenuWorkflowNodeFallback;
  };
}

export type WorkflowNode =
  | TriggerWorkflowNode
  | AiWorkflowNode
  | SendWorkflowNode
  | HandoverWorkflowNode
  | MenuWorkflowNode;

// Etapa 9 · item 4, rodada R2 — busca por tipo, não por posição no array.
// `nodes[0]`/`nodes[1]`/`nodes[3]` assumiam a ordem fixa hoje (trigger, ai,
// send, handover) — quebra no momento em que a árvore ganhar um nó `menu`
// (R1) em posição arbitrária. O runtime (whatsapp-bot-reply/index.ts:422-424,
// _shared/botFlowTemplate.ts:14) já busca por tipo — só a UI ficou pra trás.
// Sem mudança de comportamento hoje (mesmos 4 nós, mesma ordem) — só deixa de
// depender de posição pra continuar certo quando a ordem deixar de ser fixa.
function isTriggerNode(n: WorkflowNode): n is TriggerWorkflowNode {
  return n.type === "trigger";
}
function isAiNode(n: WorkflowNode): n is AiWorkflowNode {
  return n.type === "ai";
}
function isHandoverNode(n: WorkflowNode): n is HandoverWorkflowNode {
  return n.type === "handover";
}

export function WhatsAppBotConfig({ workspaceId }: { workspaceId: string }) {
  // G71 (adendo de backlog de UI) — leitura fica aberta pra qualquer membro;
  // escrita (Salvar Fluxo) vira admin-gated na UI, espelhando o draft de RLS
  // já proposto pra whatsapp_bot_settings (docs/qa/g71-credenciais-
  // terceiros-pacote-operador.md §3.2). isAdmin nasce false durante o
  // loading (useWorkspaceRole) — nunca pisca habilitado antes de saber.
  const { isAdmin } = useWorkspaceRole();
  const [settings, setSettings] = useState<BotSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Bot active status (master switch)
  const [isActive, setIsActive] = useState(false);

  // Workflow nodes state (JSON representation)
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    {
      id: "node-trigger",
      type: "trigger",
      title: "Gatilho de Entrada",
      enabled: true,
      properties: { respondAll: true }
    },
    {
      id: "node-ai",
      type: "ai",
      title: "Agente IA (Gemini)",
      enabled: true,
      properties: {
        instruction: "Você é o atendente virtual do KORA Hub. Seja prestativo, educado e conciso.",
        model: "gemini-3.6-flash",
        provider: "gemini_api_key",
        geminiApiKey: "",
        gcpProjectId: "",
        gcpRegion: "us-central1",
        gcpServiceAccount: "",
        customModelName: ""
      }
    },
    {
      id: "node-send",
      type: "send",
      title: "Enviar Mensagem",
      enabled: true,
      properties: { template: "{{reply}}" }
    },
    {
      id: "node-handover",
      type: "handover",
      title: "Transbordo Humano",
      enabled: false,
      properties: { assignTo: "" }
    }
  ]);

  // Latest ref (padrão useTaskReminders.ts:22-23) — loadSettings lê o valor
  // atual de `nodes` no fallback legado sem precisar de `nodes` no dep array
  // do useCallback (isso recriaria a função a cada edição do fluxo e
  // re-disparia o useEffect de carga/fetch abaixo a cada edição).
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Selected node for the side inspector panel
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-trigger");

  // Simulator states
  const [simMessages, setSimMessages] = useState<Array<{ role: "user" | "model"; text: string }>>([
    { role: "model", text: "Olá! Eu sou o simulador do seu fluxo visual. Salve seu fluxo e envie uma mensagem para testar as respostas e transbordos em tempo real!" }
  ]);
  const [simInput, setSimInput] = useState("");
  const [simulating, setSimulating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // `|| nodes[0]` aqui é fallback de seleção inválida ("mostra algo em vez de
  // nada"), não suposição de tipo por posição — revisado na rodada R2 e
  // deixado como está de propósito, não esquecido.
  const activeNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

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
        
        // Try parsing flow_data from DB
        const savedFlow = data.flow_data;
        if (savedFlow && Array.isArray(savedFlow)) {
          // G71: flow_data não carrega mais geminiApiKey/gcpServiceAccount
          // (produtor sanitiza no save, ver handleSaveSettings) — reidrata
          // o no "ai" a partir das colunas dedicadas, senão o formulário
          // reabriria com os campos de senha em branco mesmo com credencial
          // gravada. Também cobre linhas antigas (salvas antes do G71, ainda
          // com a credencial dentro do jsonb): a coluna dedicada sempre
          // prevalece.
          const rehydrated = (savedFlow as unknown as WorkflowNode[]).map((node) =>
            node.type === "ai"
              ? {
                  ...node,
                  properties: {
                    ...node.properties,
                    geminiApiKey: data.gemini_api_key || "",
                    gcpServiceAccount: data.gcp_service_account || "",
                  },
                }
              : node,
          );
          setNodes(rehydrated);
        } else {
          // Fallback legacy conversion
          const legacyInstruction = data.system_instruction || "Você é o atendente virtual do KORA Hub. Seja prestativo, educado e conciso.";
          const legacyModel = data.model_name || "gemini-2.5-flash";
          const legacyProvider = data.provider || "lovable";
          const legacyApiKey = data.gemini_api_key || "";
          const legacyProjectId = data.gcp_project_id || "";
          const legacyRegion = data.gcp_region || "us-central1";
          const legacySA = data.gcp_service_account || "";
          const legacyRespondAll = data.respond_all ?? true;

          const updated = [...nodesRef.current];
          // Update trigger
          const triggerNode = updated.find(isTriggerNode);
          if (triggerNode) {
            triggerNode.properties.respondAll = legacyRespondAll;
          }
          // Update AI
          const aiNode = updated.find(isAiNode);
          if (aiNode) {
            aiNode.properties = {
              instruction: legacyInstruction,
              model: legacyModel === "custom" ? "custom" : legacyModel,
              provider: legacyProvider,
              geminiApiKey: legacyApiKey,
              gcpProjectId: legacyProjectId,
              gcpRegion: legacyRegion,
              gcpServiceAccount: legacySA,
              customModelName: !["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"].includes(legacyModel) && legacyModel !== "custom" ? legacyModel : ""
            };
          }
          setNodes(updated);
        }
      }
    } catch (e) {
      // G71 (adendo): erro cru trocado pelo normalizador ja existente
      // (src/lib/supabase/errors.ts) - 42501 (RLS) agora vira mensagem
      // amigavel em vez do texto tecnico do Postgres.
      toastError(e, "Erro ao carregar configurações");
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

  // Item 4 · R5 — o valor aceito ganhou number/array/objeto pra servir as
  // propriedades do nó "menu" (opções, fallback), além de string/boolean
  // já usados pelos 4 nós existentes. Mesmo mutator genérico, tipo mais
  // largo — nenhum call site existente muda de comportamento.
  const updateNodeProperty = (
    nodeId: string,
    key: string,
    value: string | boolean | number | MenuWorkflowNodeOption[] | MenuWorkflowNodeFallback,
  ) => {
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          properties: {
            ...node.properties,
            [key]: value
          }
        } as WorkflowNode;
      }
      return node;
    }));
  };

  const toggleNodeEnabled = (nodeId: string) => {
    // Trigger and Send are core nodes, shouldn't be disabled
    if (nodeId === "node-trigger" || nodeId === "node-send") return;
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        return { ...node, enabled: !node.enabled };
      }
      return node;
    }));
  };

  // Item 4 · R5 (etapa-9-bot-fluxo-scriptado-r1-fundacao.md, UI do nó
  // "menu") — id gerado, mesmo padrão de `usePipelines.ts` (`newStageId`,
  // id de nó customizado é string livre, montada pelo usuário/app, não um
  // enum fixo).
  const generateMenuNodeId = () => `node-menu-${Math.random().toString(36).slice(2, 9)}`;

  // Novos nós SEMPRE vão pro FIM do array — handleSaveSettings/
  // handleSimulateMessage/loadSettings (rehydration legada) leem os 4 nós
  // fixos por índice (nodes[0..3]); manter o append no fim preserva essa
  // suposição sem precisar tocar nenhum desses 3 pontos nesta rodada.
  const addMenuNode = () => {
    const menuCount = nodes.filter(n => n.type === "menu").length;
    const newNode: MenuWorkflowNode = {
      id: generateMenuNodeId(),
      type: "menu",
      title: `Menu ${menuCount + 1}`,
      enabled: true,
      properties: {
        mensagem: "",
        opcoes: [],
        fallback: { maxTentativas: 3, acao: "reprompt" },
      },
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Só nós "menu" (criados pelo usuário nesta rodada) ganham título
  // editável — os 4 nós fixos nunca tiveram esse campo na UI, e mudar
  // título deles está fora do escopo desta rodada.
  const updateMenuNodeTitle = (nodeId: string, title: string) => {
    setNodes(prev => prev.map(node => (node.id === nodeId ? { ...node, title } : node)));
  };

  const addMenuOption = (menuNode: MenuWorkflowNode) => {
    const nextNumero = menuNode.properties.opcoes.reduce((max, o) => Math.max(max, o.numero), 0) + 1;
    const opcoes: MenuWorkflowNodeOption[] = [
      ...menuNode.properties.opcoes,
      { numero: nextNumero, rotulo: "", nextNodeId: "" },
    ];
    updateNodeProperty(menuNode.id, "opcoes", opcoes);
  };

  const updateMenuOption = (
    menuNode: MenuWorkflowNode,
    index: number,
    patch: Partial<MenuWorkflowNodeOption>,
  ) => {
    const opcoes = menuNode.properties.opcoes.map((o, i) => (i === index ? { ...o, ...patch } : o));
    updateNodeProperty(menuNode.id, "opcoes", opcoes);
  };

  const removeMenuOption = (menuNode: MenuWorkflowNode, index: number) => {
    const opcoes = menuNode.properties.opcoes.filter((_, i) => i !== index);
    updateNodeProperty(menuNode.id, "opcoes", opcoes);
  };

  const updateMenuFallback = (menuNode: MenuWorkflowNode, patch: Partial<MenuWorkflowNodeFallback>) => {
    const fallback: MenuWorkflowNodeFallback = { ...menuNode.properties.fallback, ...patch };
    // "reprompt" nunca usa fallbackNodeId — limpa pra não deixar um valor
    // órfão de uma seleção anterior de "node" escondido no estado.
    if (fallback.acao === "reprompt") delete fallback.fallbackNodeId;
    updateNodeProperty(menuNode.id, "fallback", fallback);
  };

  const handleSaveSettings = async () => {
    const triggerNode = nodes.find(isTriggerNode);
    const aiNode = nodes.find(isAiNode);
    if (!triggerNode || !aiNode) return;

    setSaving(true);

    let activeGcpProjectId = aiNode.properties.gcpProjectId;
    if (!activeGcpProjectId && aiNode.properties.gcpServiceAccount) {
      try {
        const parsed = JSON.parse(aiNode.properties.gcpServiceAccount);
        if (parsed.project_id) {
          activeGcpProjectId = parsed.project_id;
        }
      } catch (err) {
        // ignore
      }
    }

    const finalModel = aiNode.properties.model === "custom" 
      ? aiNode.properties.customModelName 
      : aiNode.properties.model;

    // G71: flow_data é lido de volta tanto por esta tela (loadSettings)
    // quanto pela edge function whatsapp-bot-reply (nó "ai" do fluxo visual)
    // — mas a credencial real já tem coluna dedicada logo abaixo
    // (gemini_api_key/gcp_service_account, gravadas no MESMO payload).
    // Duplicá-la dentro do jsonb sem redação é o mesmo padrão-raiz do G63
    // (raw_payload). Sanitiza só esses 2 campos antes de serializar — o
    // resto do fluxo (instruction/provider/model) não é segredo e continua
    // igual. `nodes` (estado do formulário) permanece intacto, só
    // `sanitizedNodes` vai pro payload.
    const sanitizedNodes = nodes.map((node) =>
      node.type === "ai"
        ? { ...node, properties: { ...node.properties, geminiApiKey: "", gcpServiceAccount: "" } }
        : node,
    );

    try {
      const payload: BotSettingsInsert = {
        workspace_id: workspaceId,
        is_active: isActive,
        system_instruction: aiNode.properties.instruction,
        model_name: finalModel,
        provider: aiNode.properties.provider,
        gemini_api_key: aiNode.properties.geminiApiKey || null,
        gcp_project_id: activeGcpProjectId || null,
        gcp_region: aiNode.properties.gcpRegion || null,
        gcp_service_account: aiNode.properties.gcpServiceAccount || null,
        respond_all: triggerNode.properties.respondAll,
        flow_data: sanitizedNodes as unknown as Json, // G71: sem geminiApiKey/gcpServiceAccount no no "ai"
      };

      if (settings?.id) {
        payload.updated_at = new Date().toISOString();
        const { error } = await supabase
          .from("whatsapp_bot_settings")
          .update(payload)
          .eq("id", settings.id);

        if (error) throw error;
        toast.success("Fluxo de Atendimento salvo com sucesso!");
      } else {
        const { data, error } = await supabase
          .from("whatsapp_bot_settings")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        setSettings(data);
        toast.success("Fluxo de Atendimento criado e ativado!");
      }
    } catch (e) {
      // G71 (adendo): idem loadSettings - 42501 (RLS, ex.: nao-admin apos o
      // draft de RLS ser aplicado) agora vira mensagem amigavel.
      toastError(e, "Erro ao salvar configurações");
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
      const aiNode = nodes.find(isAiNode);
      if (!aiNode) return;
      const activeModelName = aiNode.properties.model === "custom"
        ? aiNode.properties.customModelName 
        : aiNode.properties.model;
      
      // Call the edge function in test mode
      const { data, error } = await supabase.functions.invoke("whatsapp-bot-reply", {
        body: {
          isTest: true,
          workspaceId,
          systemInstruction: aiNode.properties.instruction,
          provider: aiNode.properties.provider,
          modelName: activeModelName,
          geminiApiKey: aiNode.properties.provider === "gemini_api_key" ? aiNode.properties.geminiApiKey : null,
          gcpProjectId: aiNode.properties.provider === "vertex_ai" ? aiNode.properties.gcpProjectId : null,
          gcpRegion: aiNode.properties.provider === "vertex_ai" ? aiNode.properties.gcpRegion : "us-central1",
          gcpServiceAccount: aiNode.properties.provider === "vertex_ai" ? aiNode.properties.gcpServiceAccount : null,
          messageText: userText,
          history: updatedHistory.slice(1).map(m => ({ role: m.role, text: m.text })),
          flowData: nodes
        }
      });

      if (error) throw error;

      if (data && data.reply) {
        setSimMessages(prev => [...prev, { role: "model", text: data.reply }]);
        
        // Simulation of Human Handover node action
        const handoverNode = nodes.find(isHandoverNode);
        if (handoverNode?.enabled && userText.toLowerCase().includes("atendente")) {
          setSimMessages(prev => [...prev, { 
            role: "model", 
            text: "🔀 [Simulação de Transbordo] Fluxo encaminhado para a fila de atendimento humano. Robô pausado." 
          }]);
        }
      } else {
        throw new Error("Resposta da IA vazia");
      }
    } catch (err) {
      console.error(err);
      setSimMessages(prev => [
        ...prev, 
        { role: "model", text: `❌ Falha no fluxo: ${(err as Error).message || "Erro desconhecido. Verifique as credenciais."}` }
      ]);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-3 text-sm text-muted-foreground bg-card/10 backdrop-blur-lg rounded-2xl border border-border/20 m-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" /> 
        <span>Carregando construtor de fluxo visual...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      
      {/* Header Panel */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card-elevated/70 via-background/90 to-primary/10 p-6 md:p-8 shadow-lg backdrop-blur-md">
        <div className="absolute -right-10 -top-10 h-48 w-48 bg-primary/20 rounded-full blur-3xl -z-10" />
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 shrink-0">
              <Network className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                  Gestor de Fluxo Visual do Robô
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-400 uppercase tracking-wider">
                  Workflow Builder
                </span>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl mt-1.5 leading-relaxed">
                Desenhe a jornada de atendimento do seu WhatsApp. Conecte gatilhos, IA Gemini, respostas automáticas e redirecionamentos para humanos em um fluxo lógico e visual.
              </p>
            </div>
          </div>

          {/* Active switch */}
          <div className="flex items-center justify-between gap-4 bg-card-elevated/80 border border-border/60 px-5 py-3 rounded-xl shrink-0 shadow-sm">
            <div className="text-left pr-2">
              <p className="text-xs font-bold text-foreground">Status do Robô</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {isActive ? "🟢 Ativo em Produção" : "🔴 Pausado"}
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Left: Canvas & Inspector Area (8/12) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* Workflow Canvas */}
          <div className="rounded-xl border border-border/40 bg-card/60 p-6 shadow-md relative min-h-[380px] overflow-hidden flex flex-col justify-between"
               style={{
                 backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)",
                 backgroundSize: "20px 20px"
               }}>
            
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Visual Canvas</span>
            </div>

            {/* Nodes Layout Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center my-auto pt-8 pb-4 relative z-10">
              {nodes.map((node, index) => {
                const isSelected = selectedNodeId === node.id;
                let borderCol = "border-border/60";
                let shadowCol = "";
                let iconBg = "bg-muted";
                let iconCol = "text-muted-foreground";

                if (node.enabled) {
                  if (node.type === "trigger") {
                    borderCol = isSelected ? "border-emerald-500 ring-1 ring-emerald-500" : "border-emerald-500/30";
                    iconBg = "bg-emerald-500/10";
                    iconCol = "text-emerald-400";
                    shadowCol = isSelected ? "shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)]" : "";
                  } else if (node.type === "ai") {
                    borderCol = isSelected ? "border-violet-500 ring-1 ring-violet-500" : "border-violet-500/30";
                    iconBg = "bg-violet-500/10";
                    iconCol = "text-violet-400";
                    shadowCol = isSelected ? "shadow-[0_0_15px_-3px_rgba(139,92,246,0.2)]" : "";
                  } else if (node.type === "send") {
                    borderCol = isSelected ? "border-blue-500 ring-1 ring-blue-500" : "border-blue-500/30";
                    iconBg = "bg-blue-500/10";
                    iconCol = "text-blue-400";
                    shadowCol = isSelected ? "shadow-[0_0_15px_-3px_rgba(59,130,246,0.2)]" : "";
                  } else if (node.type === "handover") {
                    borderCol = isSelected ? "border-orange-500 ring-1 ring-orange-500" : "border-orange-500/30";
                    iconBg = "bg-orange-500/10";
                    iconCol = "text-orange-400";
                    shadowCol = isSelected ? "shadow-[0_0_15px_-3px_rgba(249,115,22,0.2)]" : "";
                  } else if (node.type === "menu") {
                    borderCol = isSelected ? "border-pink-500 ring-1 ring-pink-500" : "border-pink-500/30";
                    iconBg = "bg-pink-500/10";
                    iconCol = "text-pink-400";
                    shadowCol = isSelected ? "shadow-[0_0_15px_-3px_rgba(236,72,153,0.2)]" : "";
                  }
                } else {
                  borderCol = "border-dashed border-border/40 opacity-50";
                }

                return (
                  <div key={node.id} className="relative flex items-center">
                    {/* SVG Connector Line — achado a reportar (Item 4 · R5,
                        pedir ID ao revisor, não numerado por conta própria):
                        esta seta sempre liga node[index] a node[index+1] por
                        POSIÇÃO NO ARRAY, nunca pela aresta real de um nó
                        "menu" (`opcoes[].nextNodeId`). Com a árvore 100%
                        montável do operador, um nó "menu" pode apontar pra
                        qualquer outro nó, não necessariamente o próximo do
                        array — a partir de agora esta seta pode mostrar uma
                        sequência que não corresponde ao fluxo real montado
                        pelo usuário. Não corrigido nesta rodada (fora de
                        escopo — R5 é só CRUD de nó "menu", não um redesenho
                        do canvas pra grafo real). */}
                    {index < nodes.length - 1 && (
                      <div className="hidden md:block absolute left-full top-1/2 w-6 h-[2px] bg-border/40 -translate-y-1/2 z-0">
                        <div className={`h-full bg-gradient-to-r from-primary to-transparent transition-all duration-300 ${nodes[index+1].enabled ? "opacity-100" : "opacity-20"}`} />
                        <ArrowRight className="h-3 w-3 absolute -right-1.5 -top-[5px] text-border/60" />
                      </div>
                    )}

                    {/* Node Box */}
                    <div 
                      onClick={() => setSelectedNodeId(node.id)}
                      className={`w-full rounded-xl border p-4 bg-background/80 hover:scale-[1.02] cursor-pointer transition-all duration-200 backdrop-blur-sm z-10 flex flex-col justify-between gap-3 min-h-[135px] ${borderCol} ${shadowCol}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg} ${iconCol}`}>
                          {node.type === "trigger" && <Sparkles className="h-4.5 w-4.5" />}
                          {node.type === "ai" && <BrainCircuit className="h-4.5 w-4.5" />}
                          {node.type === "send" && <Send className="h-4.5 w-4.5" />}
                          {node.type === "handover" && <UserCog className="h-4.5 w-4.5" />}
                          {node.type === "menu" && <MessageSquareCode className="h-4.5 w-4.5" />}
                        </div>

                        {/* Switch for toggleable nodes */}
                        {node.type !== "trigger" && node.type !== "send" && (
                          <Switch
                            checked={node.enabled}
                            onCheckedChange={() => toggleNodeEnabled(node.id)}
                            className="scale-75"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                      </div>

                      <div>
                        <h4 className="text-xs font-bold text-foreground">{node.title}</h4>
                        <p className="text-[9px] text-muted-foreground truncate mt-0.5">
                          {node.type === "trigger" && (node.properties.respondAll ? "Irrestrito" : "Apenas Novos")}
                          {node.type === "ai" && `Provedor: ${node.properties.provider}`}
                          {node.type === "send" && node.properties.template}
                          {node.type === "handover" && (node.enabled ? "Fila Humana Ativa" : "Desativado")}
                          {node.type === "menu" && (
                            node.properties.opcoes.length === 0
                              ? "Sem opções"
                              : `${node.properties.opcoes.length} opç${node.properties.opcoes.length === 1 ? "ão" : "ões"}`
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Item 4 · R5 — único jeito de criar nó nesta rodada: um
                  tile "+" no fim da grade. Sem exclusão de nó ainda (fora
                  do escopo pedido — "criar/editar", não "excluir"); um nó
                  "menu" criado por engano só pode ser desabilitado (toggle
                  já genérico pra qualquer nó exceto trigger/send), não
                  removido da árvore. */}
              <button
                type="button"
                onClick={addMenuNode}
                className="w-full min-h-[135px] rounded-xl border border-dashed border-pink-500/40 hover:border-pink-500 hover:bg-pink-500/5 transition-all duration-200 flex flex-col items-center justify-center gap-2 text-pink-400"
              >
                <MessageSquareCode className="h-5 w-5" />
                <span className="text-[11px] font-bold">+ Adicionar nó de menu</span>
              </button>
            </div>

            <div className="flex justify-between items-center bg-violet-950/10 border border-violet-500/20 rounded-xl p-3 relative z-10">
              <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 leading-normal">
                <ShieldAlert className="h-4 w-4 text-violet-400" /> Salve o fluxo antes de testar no simulador ao lado ou no celular.
              </span>
              {isAdmin ? (
                <Button size="sm" onClick={handleSaveSettings} disabled={saving} className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 text-xs h-8 text-white px-4 border-0">
                  {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Save className="h-3 w-3 mr-1.5" />}
                  Salvar Fluxo
                </Button>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>
                        <Button size="sm" disabled title="Apenas administradores do workspace podem alterar esta configuração." className="bg-gradient-to-r from-violet-600 to-indigo-600 text-xs h-8 text-white px-4 border-0 opacity-60 cursor-not-allowed">
                          <Lock className="h-3 w-3 mr-1.5" />
                          Salvar Fluxo
                        </Button>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Apenas administradores do workspace podem alterar esta configuração.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

          </div>

          {/* Inspector / Parameter Details Panel */}
          <div className="rounded-xl border border-border/40 bg-card p-6 shadow-md flex-1">
            <h3 className="text-sm font-semibold text-foreground/90 flex items-center gap-2 border-b border-border/40 pb-3">
              <Settings2 className="h-4 w-4 text-violet-500" /> Configuração do Nó: {activeNode.title}
            </h3>

            <div className="mt-4 space-y-4">
              
              {/* TRIGGER INSPECTOR */}
              {activeNode.type === "trigger" && (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Configure as condições que ativam o seu assistente virtual do WhatsApp.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div 
                      onClick={() => updateNodeProperty("node-trigger", "respondAll", true)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                        activeNode.properties.respondAll 
                          ? "border-violet-500 bg-violet-500/5 shadow-md" 
                          : "border-border/60 bg-background/20"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-violet-400" /> Qualquer Conversa (Irrestrito)
                      </span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        O robô responderá a todas as mensagens, mesmo em conversas em andamento ou chats antigos.
                      </p>
                    </div>

                    <div 
                      onClick={() => updateNodeProperty("node-trigger", "respondAll", false)}
                      className={`rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:border-violet-500 flex flex-col justify-between space-y-2 ${
                        !activeNode.properties.respondAll 
                          ? "border-violet-500 bg-violet-500/5 shadow-md" 
                          : "border-border/60 bg-background/20"
                      }`}
                    >
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <UserCog className="h-4 w-4 text-violet-400" /> Apenas Conversas Novas (Triagem)
                      </span>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        O robô responderá apenas se não houver um atendente humano atribuído à conversa no painel.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI INSPECTOR */}
              {activeNode.type === "ai" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Instruções de Personalidade (Prompt) *
                    </label>
                    <Textarea
                      value={activeNode.properties.instruction}
                      onChange={(e) => updateNodeProperty("node-ai", "instruction", e.target.value)}
                      placeholder="Ex: Você é a Sofia, atendente da Kora Hub. Seja conciso e cordal..."
                      className="min-h-[100px] text-xs bg-background/30"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        Modelo de IA
                      </label>
                      <Select 
                        value={activeNode.properties.model} 
                        onValueChange={(val) => updateNodeProperty("node-ai", "model", val)}
                      >
                        <SelectTrigger className="bg-background/30 text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {activeNode.properties.provider === "vertex_ai" ? (
                            <>
                              <SelectItem value="gemini-2.5-flash-001">Gemini 2.5 Flash (001)</SelectItem>
                              <SelectItem value="gemini-2.5-pro-001">Gemini 2.5 Pro (001)</SelectItem>
                            </>
                          ) : activeNode.properties.provider === "anthropic" ? (
                            <>
                              <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5 (Recomendado, custo baixo)</SelectItem>
                              <SelectItem value="claude-sonnet-5">Claude Sonnet 5 (Avançado)</SelectItem>
                            </>
                          ) : (
                            <>
                              <SelectItem value="gemini-3.6-flash">Gemini 3.6 Flash (Recomendado)</SelectItem>
                              <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro (Avançado)</SelectItem>
                              <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash (legado)</SelectItem>
                            </>
                          )}
                          <SelectItem value="custom">Outro Modelo (Digitar ID)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        Provedor & Cobrança
                      </label>
                      <Select 
                        value={activeNode.properties.provider} 
                        onValueChange={(val) => updateNodeProperty("node-ai", "provider", val)}
                      >
                        <SelectTrigger className="bg-background/30 text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lovable">Créditos KORA</SelectItem>
                          <SelectItem value="gemini_api_key">Gemini API Key Studio (Taxa 0)</SelectItem>
                          <SelectItem value="vertex_ai">Vertex AI GCP (Taxa 0)</SelectItem>
                          <SelectItem value="anthropic">Claude (Anthropic) — Beta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {activeNode.properties.model === "custom" && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                        ID do Modelo Customizado *
                      </label>
                      <Input
                        value={activeNode.properties.customModelName}
                        onChange={(e) => updateNodeProperty("node-ai", "customModelName", e.target.value)}
                        placeholder="ex: gemini-2.5-pro"
                        className="h-9 text-xs bg-background/30"
                      />
                    </div>
                  )}

                  {/* Provider Key Settings */}
                  {activeNode.properties.provider === "gemini_api_key" && (
                    <div className="space-y-2 bg-background/30 p-3 rounded-lg border border-border/40">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          API Key do Gemini *
                        </label>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-violet-400 hover:underline">
                          Obter chave no AI Studio ↗
                        </a>
                      </div>
                      <Input
                        type="password"
                        value={activeNode.properties.geminiApiKey}
                        onChange={(e) => updateNodeProperty("node-ai", "geminiApiKey", e.target.value)}
                        placeholder="AIzaSy..."
                        className="h-9 text-xs"
                      />
                    </div>
                  )}

                  {activeNode.properties.provider === "vertex_ai" && (
                    <div className="space-y-3 bg-background/30 p-3 rounded-lg border border-border/40">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Conta de Serviço GCP (JSON) *
                        </label>
                        <Textarea
                          value={activeNode.properties.gcpServiceAccount}
                          onChange={(e) => updateNodeProperty("node-ai", "gcpServiceAccount", e.target.value)}
                          placeholder='{"type": "service_account", ...}'
                          className="min-h-[90px] text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* SEND MESSAGE INSPECTOR */}
              {activeNode.type === "send" && (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Define o formato final da mensagem enviada no WhatsApp.
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Template de Resposta
                    </label>
                    <Input
                      value={activeNode.properties.template}
                      onChange={(e) => updateNodeProperty("node-send", "template", e.target.value)}
                      placeholder="{{reply}}"
                      className="h-9 text-xs bg-background/30"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      A tag <code className="bg-muted px-1 py-0.5 rounded text-violet-400 font-mono">{"{{reply}}"}</code> será substituída automaticamente pela resposta gerada pela IA.
                    </p>
                  </div>
                </div>
              )}

              {/* HANDOVER INSPECTOR */}
              {activeNode.type === "handover" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${activeNode.enabled ? "bg-emerald-500" : "bg-muted"}`} />
                    <p className="text-xs font-bold text-foreground">
                      Status do Nó: {activeNode.enabled ? "Ativo (Habilitado)" : "Inativo (Pausado)"}
                    </p>
                  </div>
                  
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Se ativado, quando o cliente demonstrar urgência ou solicitar atendimento com um humano (ex: palavras como "falar com atendente", "humano"), a IA encaminhará a conversa e pausará a automação.
                  </p>
                </div>
              )}

              {/* MENU INSPECTOR (Item 4 · R5 — construtor de fluxo scriptado,
                  etapa-9-bot-fluxo-scriptado-r1-fundacao.md) */}
              {activeNode.type === "menu" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Mensagem scriptada com opções numeradas — sem custo de IA. Cada opção aponta pra outro nó da árvore.
                  </p>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Título do nó
                    </label>
                    <Input
                      value={activeNode.title}
                      onChange={(e) => updateMenuNodeTitle(activeNode.id, e.target.value)}
                      placeholder="Ex: Menu principal"
                      className="h-9 text-xs bg-background/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Mensagem
                    </label>
                    <Textarea
                      value={activeNode.properties.mensagem}
                      onChange={(e) => updateNodeProperty(activeNode.id, "mensagem", e.target.value)}
                      placeholder={"Escolha uma opção:\n1 - Suporte\n2 - Vendas"}
                      className="min-h-[90px] text-xs bg-background/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        Opções
                      </label>
                      <Button
                        type="button" size="sm" variant="outline"
                        onClick={() => addMenuOption(activeNode)}
                        className="h-7 text-[11px] gap-1"
                      >
                        <Plus className="h-3 w-3" /> Adicionar opção
                      </Button>
                    </div>

                    {activeNode.properties.opcoes.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70 italic">Nenhuma opção ainda.</p>
                    ) : (
                      <div className="space-y-2">
                        {activeNode.properties.opcoes.map((opcao, index) => (
                          <div key={index} className="flex items-center gap-2 bg-background/30 p-2.5 rounded-lg border border-border/40">
                            <span className="h-7 w-7 rounded-md bg-pink-500/10 text-pink-400 text-xs font-bold flex items-center justify-center shrink-0">
                              {opcao.numero}
                            </span>
                            <Input
                              value={opcao.rotulo}
                              onChange={(e) => updateMenuOption(activeNode, index, { rotulo: e.target.value })}
                              placeholder="Rótulo (ex: Suporte)"
                              className="h-8 text-xs bg-background/40 flex-1"
                            />
                            <Select
                              value={opcao.nextNodeId || undefined}
                              onValueChange={(val) => updateMenuOption(activeNode, index, { nextNodeId: val })}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background/40 w-[180px] shrink-0">
                                <SelectValue placeholder="Ir para..." />
                              </SelectTrigger>
                              <SelectContent>
                                {nodes.map((n) => (
                                  <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button" size="icon" variant="ghost"
                              onClick={() => removeMenuOption(activeNode, index)}
                              aria-label="Remover opção"
                              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 bg-background/30 p-3.5 rounded-lg border border-border/40">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <HelpCircle className="h-3.5 w-3.5 text-pink-400" /> Resposta inválida
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Tentativas antes de decidir
                        </label>
                        <Input
                          type="number"
                          min={1}
                          value={activeNode.properties.fallback.maxTentativas}
                          onChange={(e) => updateMenuFallback(activeNode, { maxTentativas: Math.max(1, Number(e.target.value) || 1) })}
                          className="h-9 text-xs bg-background/40"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Depois de esgotar
                        </label>
                        <Select
                          value={activeNode.properties.fallback.acao}
                          onValueChange={(val: "reprompt" | "node") => updateMenuFallback(activeNode, { acao: val })}
                        >
                          <SelectTrigger className="h-9 text-xs bg-background/40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="reprompt">Reapresentar o menu (padrão)</SelectItem>
                            <SelectItem value="node">Pular para outro nó</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {activeNode.properties.fallback.acao === "node" && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Nó de destino
                        </label>
                        <Select
                          value={activeNode.properties.fallback.fallbackNodeId || undefined}
                          onValueChange={(val) => updateMenuFallback(activeNode, { fallbackNodeId: val })}
                        >
                          <SelectTrigger className="h-9 text-xs bg-background/40">
                            <SelectValue placeholder="Selecione um nó" />
                          </SelectTrigger>
                          <SelectContent>
                            {nodes.filter(n => n.id !== activeNode.id).map((n) => (
                              <SelectItem key={n.id} value={n.id}>{n.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Uma resposta que não bate com nenhuma opção sempre reapresenta o menu primeiro — isto só decide o que fazer depois de {activeNode.properties.fallback.maxTentativas} tentativa{activeNode.properties.fallback.maxTentativas === 1 ? "" : "s"} inválida{activeNode.properties.fallback.maxTentativas === 1 ? "" : "s"} seguida{activeNode.properties.fallback.maxTentativas === 1 ? "" : "s"}.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Right: Interactive Simulator Playground (4/12) */}
        <div className="lg:col-span-4 h-full flex flex-col rounded-xl border border-border/40 bg-card shadow-md overflow-hidden min-h-[580px]">
          
          <div className="bg-gradient-to-r from-violet-950/30 to-indigo-950/30 px-4 py-3.5 border-b border-border/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> Simulador do Fluxo
              </span>
            </div>
            
            <Button 
              type="button" 
              variant="ghost" 
              size="icon" 
              onClick={() => setSimMessages([{ role: "model", text: "Simulador limpo! Digite algo para rodar o fluxo." }])}
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Simulator Messages Screen */}
          <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-background/25 flex flex-col min-h-0">
            {simMessages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start flex-row"}`}
              >
                <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === "user" ? "bg-violet-600/20 text-violet-400" : "bg-card-elevated text-violet-500 border border-border/40"
                }`}>
                  {msg.role === "user" ? "U" : <Bot className="h-4 w-4" />}
                </div>

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
                  <span>Processando fluxo de nós...</span>
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
              placeholder="Envie uma mensagem de teste..."
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
