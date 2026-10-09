import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import {
  Save, AlertCircle, Loader2, Server, Key, BrainCircuit,
  Sparkles, MessageSquareCode, Settings2, HelpCircle,
  CheckCircle2, ShieldAlert, UserCog, Network,
  ArrowRight, ToggleLeft, ToggleRight, Play, Lock,
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
import {
  applyNodeDeletion, countNodeConnections, findDanglingEdges, gridPosition, isNodeDeletable,
  withAutoLayout, type FlowPosition,
} from "@/components/whatsapp/flowCanvasModel";
import { FlowSimulatorPanel } from "@/components/whatsapp/FlowSimulatorPanel";
import {
  INITIAL_SIM_STATE,
  SIM_GREETING,
  SIM_RESET_GREETING,
  applySimulationResponse,
  buildSimulatorRequest,
  describeSimState,
  type SimFlowState,
  type SimMessage,
} from "@/components/whatsapp/flowSimulatorModel";

// Canvas em chunk SEPARADO (React.lazy): @xyflow/react (+ d3-*, zustand, CSS)
// só é baixado quando a aba do robô abre, não no bundle principal do app.
// Só o `default` é re-exportado aqui; os tipos continuam vindo de FlowCanvas.tsx.
const FlowCanvas = lazy(() =>
  import("@/components/whatsapp/FlowCanvas").then((m) => ({ default: m.FlowCanvas })),
);

type BotSettings = Database["public"]["Tables"]["whatsapp_bot_settings"]["Row"];
type BotSettingsInsert = Database["public"]["Tables"]["whatsapp_bot_settings"]["Insert"];

export interface WorkflowNodeBase {
  id: string;
  title: string;
  enabled: boolean;
  /** R6 — posição no canvas. Ausente (flow_data salvo antes do R6) → auto-layout em grade no load; salvar grava a posição. */
  position?: { x: number; y: number };
}

export interface TriggerWorkflowNode extends WorkflowNodeBase {
  type: "trigger";
  // `nextNodeId` = aresta de ENTRADA (trigger → menu ou mensagem): id do nó
  // por onde o fluxo começa. Ausente = comportamento anterior (motor entra no
  // primeiro menu habilitado) — compat total com flow_data já salvo.
  properties: { respondAll: boolean; nextNodeId?: string };
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
// esgotado é que decide entre entregar a humano (acao "reprompt", decisão do
// operador implementada na R4 da lane D — NÃO é reprompt indefinido) ou pular pra outro nó
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
  /** "reprompt" reapresenta o mesmo menu até `maxTentativas` e então ENTREGA A HUMANO (default do produto); "node" pula pra `fallbackNodeId`. */
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

// Etapa 9 · item 4, R7 — nó "message": texto informativo montável pelo usuário
// entre menus (ex.: "Horário: seg–sex 9h–18h" → voltar ao menu). Ao ser
// alcançado o motor envia `mensagem` e segue `nextNodeId` na MESMA virada
// (menu → apresenta o menu junto; outra mensagem → encadeia, com teto de saltos
// e corte de ciclo). Ausente = encerra o fluxo scriptado (a próxima mensagem do
// cliente recomeça pelo nó de entrada). Compat total com flow_data salvo: é só
// um `type` novo na união.
export interface MessageWorkflowNode extends WorkflowNodeBase {
  type: "message";
  properties: {
    mensagem: string;
    /** Destino depois de enviar — id de um menu ou de outra mensagem. Ausente = encerra. */
    nextNodeId?: string;
  };
}

export type WorkflowNode =
  | TriggerWorkflowNode
  | AiWorkflowNode
  | SendWorkflowNode
  | HandoverWorkflowNode
  | MenuWorkflowNode
  | MessageWorkflowNode;

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

// Valor do item "Automático" do Select "Começar por" (Radix Select não aceita
// value ""); ausente em trigger.properties.nextNodeId.
const ENTRY_AUTOMATIC = "__automatico__";
// Idem pro item "Encerrar o fluxo" do destino do nó de mensagem (ausente em
// message.properties.nextNodeId).
const MESSAGE_END = "__encerrar__";

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
  const [nodes, setNodes] = useState<WorkflowNode[]>(() => withAutoLayout([
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
  ]));

  // Latest ref (padrão useTaskReminders.ts:22-23) — loadSettings lê o valor
  // atual de `nodes` no fallback legado sem precisar de `nodes` no dep array
  // do useCallback (isso recriaria a função a cada edição do fluxo e
  // re-disparia o useEffect de carga/fetch abaixo a cada edição).
  const nodesRef = useRef(nodes);
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);

  // Selected node for the side inspector panel
  const [selectedNodeId, setSelectedNodeId] = useState<string>("node-trigger");

  // Simulator states. `simState` é o estado de ida e volta do simulador do fluxo
  // (nó do menu/tentativas/entregue a humano — contrato em docs/qa/etapa-9-bot-
  // simulador-fluxo-cobertura.md §3); o MOTOR é do server, aqui só se carrega.
  const [simMessages, setSimMessages] = useState<SimMessage[]>([
    { role: "model", text: SIM_GREETING }
  ]);
  const [simState, setSimState] = useState<SimFlowState>(INITIAL_SIM_STATE);
  const [simInput, setSimInput] = useState("");
  const [simulating, setSimulating] = useState(false);

  // `|| nodes[0]` aqui é fallback de seleção inválida ("mostra algo em vez de
  // nada"), não suposição de tipo por posição — revisado na rodada R2 e
  // deixado como está de propósito, não esquecido.
  const activeNode = nodes.find(n => n.id === selectedNodeId) || nodes[0];

  // R6 — avisos de aresta com destino vazio/removido (a aresta NÃO é
  // desenhada no canvas; o aviso aparece no inspector do nó de origem).
  const danglingEdges = findDanglingEdges(nodes);

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
          setNodes(withAutoLayout(rehydrated));
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
          setNodes(withAutoLayout(updated));
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

  // useCallback (identidade estável): o FlowCanvas deriva os nós do React Flow
  // a partir deste callback.
  const toggleNodeEnabled = useCallback((nodeId: string) => {
    // Trigger and Send are core nodes, shouldn't be disabled
    if (nodeId === "node-trigger" || nodeId === "node-send") return;
    setNodes(prev => prev.map(node => {
      if (node.id === nodeId) {
        return { ...node, enabled: !node.enabled };
      }
      return node;
    }));
  }, []);

  // Item 4 · R5 (etapa-9-bot-fluxo-scriptado-r1-fundacao.md, UI do nó
  // "menu") — id gerado, mesmo padrão de `usePipelines.ts` (`newStageId`,
  // id de nó customizado é string livre, montada pelo usuário/app, não um
  // enum fixo).
  const generateMenuNodeId = () => `node-menu-${Math.random().toString(36).slice(2, 9)}`;

  // Novos nós SEMPRE vão pro FIM do array — handleSaveSettings/
  // handleSimulateMessage/loadSettings (rehydration legada) leem os 4 nós
  // fixos por índice (nodes[0..3]); manter o append no fim preserva essa
  // suposição sem precisar tocar nenhum desses 3 pontos nesta rodada.
  // Exclusão de nó "menu" (botão do inspector e Delete/Backspace no canvas).
  // applyNodeDeletion limpa TODA referência (opcoes[].nextNodeId, fallbackNodeId,
  // trigger.nextNodeId); nó fixo → no-op. O nó ativo volta pro gatilho.
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const deleteMenuNode = useCallback((nodeId: string) => {
    setNodes(prev => applyNodeDeletion(prev, nodeId));
    setSelectedNodeId(current => (current === nodeId ? "node-trigger" : current));
    setConfirmDeleteNodeId(null);
  }, []);

  const generateMessageNodeId = () => `node-message-${Math.random().toString(36).slice(2, 9)}`;

  // R7 — "+ Adicionar nó de mensagem". Texto vazio de propósito (o usuário
  // escreve); sem destino = encerra o fluxo scriptado depois de enviar.
  const addMessageNode = (position?: FlowPosition) => {
    const messageCount = nodes.filter(n => n.type === "message").length;
    const newNode: MessageWorkflowNode = {
      id: generateMessageNodeId(),
      type: "message",
      title: `Mensagem ${messageCount + 1}`,
      enabled: true,
      position: position ?? gridPosition(nodes.length),
      properties: { mensagem: "" },
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Destino depois de enviar: grava/limpa message.properties.nextNodeId.
  // "Encerrar" REMOVE a chave (mesma disciplina do trigger — sem string vazia).
  const setMessageNextNode = (nodeId: string, nextNodeId: string | undefined) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId || node.type !== "message") return node;
      const { nextNodeId: _removed, ...rest } = node.properties;
      return { ...node, properties: nextNodeId ? { ...rest, nextNodeId } : rest };
    }));
  };

  const addMenuNode = (position?: FlowPosition) => {
    const menuCount = nodes.filter(n => n.type === "menu").length;
    const newNode: MenuWorkflowNode = {
      id: generateMenuNodeId(),
      type: "menu",
      title: `Menu ${menuCount + 1}`,
      enabled: true,
      // R6: "+ Nó de menu" cria no centro do viewport (FlowCanvas passa a posição).
      position: position ?? gridPosition(nodes.length),
      properties: {
        mensagem: "",
        opcoes: [],
        fallback: { maxTentativas: 3, acao: "reprompt" },
      },
    };
    setNodes(prev => [...prev, newNode]);
    setSelectedNodeId(newNode.id);
  };

  // Aresta de entrada: grava/limpa trigger.properties.nextNodeId. "Automático"
  // REMOVE a chave (não grava string vazia) — flow_data sem a chave é
  // idêntico ao salvo antes desta rodada.
  const setTriggerEntryNode = (nodeId: string, entryNodeId: string | undefined) => {
    setNodes(prev => prev.map(node => {
      if (node.id !== nodeId || node.type !== "trigger") return node;
      const { nextNodeId: _removed, ...rest } = node.properties;
      return { ...node, properties: entryNodeId ? { ...rest, nextNodeId: entryNodeId } : rest };
    }));
  };

  // Só nós criados pelo usuário ("menu" e "message") ganham título editável —
  // os 4 nós fixos nunca tiveram esse campo na UI, e mudar título deles está
  // fora do escopo.
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
    const updatedMessages: SimMessage[] = [...simMessages, { role: "user", text: userText }];
    setSimMessages(updatedMessages);
    setSimulating(true);

    try {
      // U1: sem `return` silencioso quando não há nó "ai" — um fluxo só-menu é
      // simulável (o server responde `skipped` sozinho se de fato não há IA).
      // Call the edge function in test mode, levando o estado do fluxo (U3).
      const { data, error } = await supabase.functions.invoke("whatsapp-bot-reply", {
        body: buildSimulatorRequest({ workspaceId, nodes, userText, messages: updatedMessages, simState }),
      });

      if (error) throw error;

      // U2/U4: o resultado (menu, handover que SUBSTITUI a resposta da IA, robô
      // em silêncio) vem do server — nada de handover fabricado no navegador.
      const { messages: replies, nextState } = applySimulationResponse(data, simState);
      setSimMessages(prev => [...prev, ...replies]);
      setSimState(nextState);
    } catch (err) {
      console.error(err);
      setSimMessages(prev => [
        ...prev,
        { role: "system", text: `❌ Falha no fluxo: ${(err as Error).message || "Erro desconhecido. Verifique as credenciais."}` }
      ]);
    } finally {
      setSimulating(false);
    }
  };

  // "Reiniciar simulação": limpa o chat E devolve o robô ao início do fluxo
  // (zera o estado de ida e volta — espelha, no simulador, a devolução ao robô).
  const handleResetSimulation = () => {
    setSimMessages([{ role: "model", text: SIM_RESET_GREETING }]);
    setSimState(INITIAL_SIM_STATE);
  };

  // "Excluir nó" em 2 passos, compartilhado pelo inspector do menu e da
  // mensagem (nada persiste até "Salvar Fluxo", mas a exclusão leva junto as
  // conexões que chegam/saem do nó).
  const renderDeleteControl = (node: WorkflowNode) =>
    confirmDeleteNodeId === node.id ? (
      <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
        <span className="flex-1 min-w-[200px] text-destructive">
          Excluir “{node.title}”? {countNodeConnections(nodes, node.id)} conexão(ões) que chegam ou saem dele serão removidas.
        </span>
        <Button type="button" size="sm" variant="destructive" className="h-7 text-[11px]" onClick={() => deleteMenuNode(node.id)}>
          Confirmar exclusão
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setConfirmDeleteNodeId(null)}>
          Cancelar
        </Button>
      </div>
    ) : (
      <div className="flex justify-end">
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => setConfirmDeleteNodeId(node.id)}
          className="h-7 gap-1 text-[11px] text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3 w-3" /> Excluir nó
        </Button>
      </div>
    );

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
          
          {/* Workflow Canvas — R6: React Flow (nós soltos, arrastar, ligar com
              linha). A edição de campos continua no inspector abaixo. */}
          <div className="rounded-xl border border-border/40 bg-card/60 p-4 shadow-md relative flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Visual Canvas</span>
            </div>

            <Suspense
              fallback={
                <div className="flex h-[520px] w-full items-center justify-center gap-2 rounded-xl border border-border/40 bg-card/60 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Carregando canvas do fluxo...
                </div>
              }
            >
              <FlowCanvas
                nodes={nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                onNodesModelChange={setNodes}
                onToggleEnabled={toggleNodeEnabled}
                onAddMenuNode={addMenuNode}
                onAddMessageNode={addMessageNode}
                onDeleteNode={deleteMenuNode}
              />
            </Suspense>

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
            {!isNodeDeletable(activeNode) && (
              <p className="mt-2 text-[10px] text-muted-foreground/70">
                Nó fixo do fluxo — não pode ser excluído, só desabilitado.
              </p>
            )}

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

                  {/* R6 — aresta de ENTRADA (trigger → menu). Mesmo campo que a
                      linha do canvas edita (trigger.properties.nextNodeId).
                      "Automático" = comportamento anterior: o motor entra no
                      primeiro menu habilitado. */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Começar por
                    </label>
                    <Select
                      value={activeNode.properties.nextNodeId ?? ENTRY_AUTOMATIC}
                      onValueChange={(val) => setTriggerEntryNode(activeNode.id, val === ENTRY_AUTOMATIC ? undefined : val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ENTRY_AUTOMATIC}>Automático (primeiro menu habilitado)</SelectItem>
                        {nodes.filter((n): n is MenuWorkflowNode | MessageWorkflowNode => n.type === "menu" || n.type === "message").map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.enabled ? m.title : `${m.title} (desabilitado)`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {danglingEdges.filter((e) => e.fromNodeId === activeNode.id).map((e) => (
                      <p key={e.id} role="alert" className="text-[10px] text-destructive/90">
                        ⚠ A entrada aponta pra um nó que não existe mais — o motor usa o primeiro menu habilitado.
                      </p>
                    ))}
                    {(() => {
                      const chosen = nodes.find((n) => n.id === activeNode.properties.nextNodeId);
                      return chosen && !((chosen.type === "menu" || chosen.type === "message") && chosen.enabled) ? (
                        <p role="alert" className="text-[10px] text-destructive/90">
                          ⚠ “{chosen.title}” não é um menu habilitado nem uma mensagem habilitada — a entrada é ignorada e o motor usa o primeiro menu habilitado.
                        </p>
                      ) : null;
                    })()}
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Sem escolha, o fluxo começa no primeiro menu habilitado. Você também pode ligar o ponto “Início do fluxo” do gatilho a um menu ou a uma mensagem no canvas.
                    </p>
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

                  {/* Excluir nó: 2 passos (nada persiste até "Salvar Fluxo", mas a
                      exclusão leva junto as conexões que chegam/saem dele). */}
                  {renderDeleteControl(activeNode)}

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

                  {/* R6 — arestas com destino vazio/removido NÃO são desenhadas no
                      canvas; o aviso aparece aqui (e o campo continua editável
                      pelos selects abaixo). */}
                  {danglingEdges.filter((e) => e.fromNodeId === activeNode.id).map((e) => (
                    <p key={e.id} role="alert" className="text-[10px] text-destructive/90">
                      ⚠ {e.kind === "option" ? `Opção ${e.optionNumero}` : "Resposta inválida"}:{" "}
                      {e.problem === "removido"
                        ? "o nó de destino não existe mais — escolha outro."
                        : "sem destino — escolha pra onde leva."}
                    </p>
                  ))}

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
                            {/* Texto da UI = comportamento real (G40/G49): decisão do
                                operador, implementada na R4 da lane D — reprompt com
                                maxTentativas esgotado ENTREGA A HUMANO (não é mais
                                "reprompt indefinido"). */}
                            <SelectItem value="reprompt">
                              Reapresentar o menu (até {activeNode.properties.fallback.maxTentativas}x, depois entrega a humano) — padrão
                            </SelectItem>
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
                      Uma resposta que não bate com nenhuma opção sempre reapresenta o menu primeiro — isto só decide o que fazer depois de {activeNode.properties.fallback.maxTentativas} tentativa{activeNode.properties.fallback.maxTentativas === 1 ? "" : "s"} inválida{activeNode.properties.fallback.maxTentativas === 1 ? "" : "s"} seguida{activeNode.properties.fallback.maxTentativas === 1 ? "" : "s"}:{" "}
                      {activeNode.properties.fallback.acao === "reprompt"
                        ? "a conversa é entregue a um atendente humano."
                        : "o fluxo segue para o nó de destino escolhido."}
                    </p>
                  </div>
                </div>
              )}

              {/* MESSAGE INSPECTOR (Item 4 · R7 — nó de mensagem montável) */}
              {activeNode.type === "message" && (
                <div className="space-y-5">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Texto informativo enviado de uma vez — sem opções e sem custo de IA. Depois de enviar, o fluxo segue para o destino escolhido (normalmente de volta a um menu).
                  </p>

                  {renderDeleteControl(activeNode)}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Título do nó
                    </label>
                    <Input
                      value={activeNode.title}
                      onChange={(e) => updateMenuNodeTitle(activeNode.id, e.target.value)}
                      placeholder="Ex: Horário de atendimento"
                      className="h-9 text-xs bg-background/30"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Texto da mensagem
                    </label>
                    <Textarea
                      value={activeNode.properties.mensagem}
                      onChange={(e) => updateNodeProperty(activeNode.id, "mensagem", e.target.value)}
                      placeholder="Ex: Atendemos de segunda a sexta, das 9h às 18h."
                      className="min-h-[90px] text-xs bg-background/30"
                    />
                    {activeNode.properties.mensagem.trim() === "" && (
                      <p role="alert" className="text-[10px] text-destructive/90">
                        ⚠ Texto vazio — o robô ignora este nó até você escrever a mensagem.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                      Depois de enviar, ir para
                    </label>
                    <Select
                      value={activeNode.properties.nextNodeId ?? MESSAGE_END}
                      onValueChange={(val) => setMessageNextNode(activeNode.id, val === MESSAGE_END ? undefined : val)}
                    >
                      <SelectTrigger className="h-9 text-xs bg-background/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={MESSAGE_END}>Encerrar o fluxo — padrão</SelectItem>
                        {nodes
                          .filter((n) => n.id !== activeNode.id && (n.type === "menu" || n.type === "message"))
                          .map((n) => (
                            <SelectItem key={n.id} value={n.id}>{n.enabled ? n.title : `${n.title} (desabilitado)`}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {danglingEdges.filter((e) => e.fromNodeId === activeNode.id).map((e) => (
                      <p key={e.id} role="alert" className="text-[10px] text-destructive/90">
                        ⚠ O destino depois de enviar não existe mais — escolha outro (sem destino a mensagem encerra o fluxo).
                      </p>
                    ))}
                    {(() => {
                      const chosen = nodes.find((n) => n.id === activeNode.properties.nextNodeId);
                      return chosen && !((chosen.type === "menu" || chosen.type === "message") && chosen.enabled) ? (
                        <p role="alert" className="text-[10px] text-destructive/90">
                          ⚠ “{chosen.title}” não é um menu habilitado nem uma mensagem habilitada — o fluxo encerra depois de enviar este texto.
                        </p>
                      ) : null;
                    })()}
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                      Voltar a um menu apresenta o menu na mesma resposta. Sem destino, o fluxo scriptado termina aqui e a próxima mensagem do cliente recomeça pelo nó de entrada.
                    </p>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>

        {/* Right: Interactive Simulator Playground (4/12) — painel extraído (FlowSimulatorPanel); lógica em flowSimulatorModel.ts */}
        <FlowSimulatorPanel
          messages={simMessages}
          simulating={simulating}
          input={simInput}
          onInputChange={setSimInput}
          onSubmit={handleSimulateMessage}
          onReset={handleResetSimulation}
          stateSummary={describeSimState(simState, nodes)}
        />

      </div>
    </div>
  );
}
