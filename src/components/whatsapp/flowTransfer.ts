// R11 — exportar / importar o fluxo do bot em JSON. Funções PURAS (sem DOM, sem I/O):
//   exportFlow(nodes)              → objeto do arquivo { schema, version, exportedAt, nodes }
//   serializeFlow(nodes)           → texto JSON (indentado) pronto pra baixar
//   parseFlowImport(text)          → valida o arquivo; { ok:false, error } recusa com o motivo
//   planFlowImport(current, parsed)→ calcula (SEM aplicar) como ficaria o fluxo depois de importar
//
// Contrato (G29: nada escondido):
//  * O arquivo NUNCA carrega credenciais: geminiApiKey / gcpServiceAccount saem vazios
//    na exportação e são IGNORADOS na importação (as chaves vivem em colunas próprias do
//    workspace, G71). Importar nunca apaga a chave do workspace.
//  * Importar ADICIONA os nós de menu/mensagem do arquivo ao fluxo atual — não apaga nem
//    substitui nada do que já existe. Os ids são REESCRITOS (sem colisão com o fluxo atual
//    nem entre si) e TODAS as ligações são remapeadas. Ligações para os nós fixos do arquivo
//    (gatilho/IA/envio/transbordo) passam a apontar para o nó fixo do MESMO TIPO do fluxo atual.
//    Ligação para um id que não está no arquivo vira "sem destino" (nunca herda um id que
//    por acaso exista aqui).
//  * Os nós fixos do arquivo não sobrescrevem os atuais. Só dois ajustes de "preencher vazio":
//    a entrada do gatilho (se o atual não tem) e a palavra de retorno da IA (se a atual está
//    vazia). Tudo o que não foi aplicado vai em `notes`.
//  * Posições preservadas (relativas); se o fluxo atual já tem menu/mensagem, o bloco importado
//    desce inteiro para abaixo do que existe, para não sobrepor.
import type {
  AiWorkflowNode, HandoverWorkflowNode, MenuWorkflowNode, MessageWorkflowNode, SendWorkflowNode,
  TriggerWorkflowNode, WorkflowNode,
} from "@/components/whatsapp/WhatsAppBotConfig";
import { LAYOUT, gridPosition } from "@/components/whatsapp/flowCanvasModel";
import { validateFlow, type FlowIssue } from "@/components/whatsapp/flowValidation";

export const FLOW_EXPORT_SCHEMA = "kora.whatsapp-bot-flow";
export const FLOW_EXPORT_VERSION = 1;
/** Teto de tamanho do arquivo aceito (um fluxo grande tem dezenas de KB). */
export const FLOW_IMPORT_MAX_CHARS = 1_000_000;

export interface FlowExportFile {
  schema: typeof FLOW_EXPORT_SCHEMA;
  version: number;
  exportedAt: string;
  nodes: WorkflowNode[];
}

// ── exportação ────────────────────────────────────────────────────────────

/** Copia profunda dos nós SEM credenciais (G71): chave Gemini e service account saem vazias. */
export function exportFlow(nodes: WorkflowNode[], now: Date = new Date()): FlowExportFile {
  const clean = nodes.map((n): WorkflowNode =>
    n.type === "ai"
      ? { ...n, properties: { ...n.properties, geminiApiKey: "", gcpServiceAccount: "" } }
      : n,
  );
  return {
    schema: FLOW_EXPORT_SCHEMA,
    version: FLOW_EXPORT_VERSION,
    exportedAt: now.toISOString(),
    nodes: JSON.parse(JSON.stringify(clean)) as WorkflowNode[],
  };
}

export function serializeFlow(nodes: WorkflowNode[], now: Date = new Date()): string {
  return JSON.stringify(exportFlow(nodes, now), null, 2);
}

export function flowExportFileName(now: Date = new Date()): string {
  return `fluxo-robo-${now.toISOString().slice(0, 10)}.json`;
}

// ── validação do arquivo ──────────────────────────────────────────────────

export type FlowParseResult =
  | { ok: true; nodes: WorkflowNode[]; exportedAt?: string }
  | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const optStr = (v: unknown, fallback = ""): string => (str(v) ? v : fallback);

function parsePosition(v: unknown): { x: number; y: number } | undefined {
  if (!isObj(v)) return undefined;
  const { x, y } = v;
  return typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

class NodeError extends Error {}

function parseNode(raw: unknown, index: number): WorkflowNode {
  const where = `Nó ${index + 1}`;
  if (!isObj(raw)) throw new NodeError(`${where}: não é um objeto.`);
  const { id, type, title, enabled, properties } = raw;
  if (!str(id) || id.trim() === "" || id.length > 200) throw new NodeError(`${where}: “id” ausente ou inválido.`);
  if (!str(title)) throw new NodeError(`${where} (${id}): “title” ausente.`);
  if (typeof enabled !== "boolean") throw new NodeError(`${where} (${id}): “enabled” precisa ser verdadeiro/falso.`);
  if (!isObj(properties)) throw new NodeError(`${where} (${id}): “properties” ausente.`);
  const base = { id, title, enabled, ...(parsePosition(raw.position) ? { position: parsePosition(raw.position) } : {}) };

  switch (type) {
    case "trigger": {
      if (typeof properties.respondAll !== "boolean") throw new NodeError(`${where} (${id}): gatilho sem “respondAll”.`);
      const node: TriggerWorkflowNode = {
        ...base, type: "trigger",
        properties: {
          respondAll: properties.respondAll,
          ...(str(properties.nextNodeId) && properties.nextNodeId ? { nextNodeId: properties.nextNodeId } : {}),
        },
      };
      return node;
    }
    case "ai": {
      const node: AiWorkflowNode = {
        ...base, type: "ai",
        properties: {
          instruction: optStr(properties.instruction), model: optStr(properties.model), provider: optStr(properties.provider),
          // credenciais NUNCA entram pelo arquivo
          geminiApiKey: "", gcpServiceAccount: "",
          gcpProjectId: optStr(properties.gcpProjectId), gcpRegion: optStr(properties.gcpRegion),
          customModelName: optStr(properties.customModelName),
          ...(str(properties.palavraRetorno) ? { palavraRetorno: properties.palavraRetorno } : {}),
        },
      };
      return node;
    }
    case "send": {
      const node: SendWorkflowNode = { ...base, type: "send", properties: { template: optStr(properties.template, "{{reply}}") } };
      return node;
    }
    case "handover": {
      const node: HandoverWorkflowNode = { ...base, type: "handover", properties: { assignTo: optStr(properties.assignTo) } };
      return node;
    }
    case "menu": {
      if (!str(properties.mensagem)) throw new NodeError(`${where} (${id}): menu sem “mensagem”.`);
      if (!Array.isArray(properties.opcoes)) throw new NodeError(`${where} (${id}): menu sem a lista “opcoes”.`);
      const opcoes = properties.opcoes.map((o, i) => {
        if (!isObj(o) || typeof o.numero !== "number" || !Number.isFinite(o.numero) || !str(o.rotulo) || !str(o.nextNodeId)) {
          throw new NodeError(`${where} (${id}): opção ${i + 1} inválida (precisa de numero, rotulo e nextNodeId).`);
        }
        return { numero: o.numero, rotulo: o.rotulo, nextNodeId: o.nextNodeId };
      });
      const fb = properties.fallback;
      if (!isObj(fb) || typeof fb.maxTentativas !== "number" || !Number.isFinite(fb.maxTentativas) || fb.maxTentativas < 1
        || (fb.acao !== "reprompt" && fb.acao !== "node")) {
        throw new NodeError(`${where} (${id}): “fallback” inválido (maxTentativas ≥ 1 e acao “reprompt” ou “node”).`);
      }
      const node: MenuWorkflowNode = {
        ...base, type: "menu",
        properties: {
          mensagem: properties.mensagem, opcoes,
          fallback: {
            maxTentativas: fb.maxTentativas, acao: fb.acao,
            ...(str(fb.fallbackNodeId) && fb.fallbackNodeId ? { fallbackNodeId: fb.fallbackNodeId } : {}),
          },
        },
      };
      return node;
    }
    case "message": {
      if (!str(properties.mensagem)) throw new NodeError(`${where} (${id}): mensagem sem “mensagem” (texto).`);
      const node: MessageWorkflowNode = {
        ...base, type: "message",
        properties: {
          mensagem: properties.mensagem,
          ...(str(properties.nextNodeId) && properties.nextNodeId ? { nextNodeId: properties.nextNodeId } : {}),
        },
      };
      return node;
    }
    default:
      throw new NodeError(`${where} (${id}): tipo de nó desconhecido “${String(type)}”.`);
  }
}

/** Lê e VALIDA o conteúdo do arquivo. Nunca lança; arquivo inválido volta como `{ ok:false, error }`. */
export function parseFlowImport(text: string): FlowParseResult {
  if (typeof text !== "string" || text.trim() === "") return { ok: false, error: "O arquivo está vazio." };
  if (text.length > FLOW_IMPORT_MAX_CHARS) return { ok: false, error: "O arquivo é grande demais para ser um fluxo do robô." };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "O arquivo não é um JSON válido." };
  }
  if (!isObj(data) || data.schema !== FLOW_EXPORT_SCHEMA) {
    return { ok: false, error: "Este arquivo não é um fluxo exportado pelo Kora (campo “schema” ausente ou diferente)." };
  }
  if (typeof data.version !== "number") return { ok: false, error: "O arquivo não informa a versão do formato." };
  if (data.version > FLOW_EXPORT_VERSION) {
    return { ok: false, error: `O arquivo é da versão ${data.version} do formato; esta tela entende até a versão ${FLOW_EXPORT_VERSION}. Atualize o Kora.` };
  }
  if (data.version < 1) return { ok: false, error: `Versão ${data.version} do formato não é suportada.` };
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) return { ok: false, error: "O arquivo não tem nenhum nó." };

  const nodes: WorkflowNode[] = [];
  try {
    data.nodes.forEach((raw, i) => nodes.push(parseNode(raw, i)));
  } catch (e) {
    if (e instanceof NodeError) return { ok: false, error: e.message };
    throw e;
  }
  const seen = new Set<string>();
  for (const n of nodes) {
    if (seen.has(n.id)) return { ok: false, error: `O id “${n.id}” aparece em mais de um nó do arquivo.` };
    seen.add(n.id);
  }
  return { ok: true, nodes, ...(str(data.exportedAt) ? { exportedAt: data.exportedAt } : {}) };
}

// ── plano de importação (não aplica nada) ─────────────────────────────────

export interface FlowImportPlan {
  ok: true;
  /** Fluxo resultante (atual + importados). Só vira estado quando o usuário confirma. */
  merged: WorkflowNode[];
  /** Ids NOVOS dos nós adicionados, na ordem do arquivo. */
  addedIds: string[];
  menus: number;
  messages: number;
  /** Ligações do arquivo que apontavam pra um id fora do arquivo (esvaziadas). */
  clearedLinks: number;
  /** O que o arquivo tinha e NÃO foi aplicado (ou foi preenchido), em português. */
  notes: string[];
  /** Problemas que a importação INTRODUZ (os que já existiam no fluxo atual não entram). */
  issues: FlowIssue[];
}
export type FlowImportPlanResult = FlowImportPlan | { ok: false; error: string };

const issueKey = (i: FlowIssue) => `${i.code}|${i.nodeId}|${i.message}`;

function defaultGenerateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function planFlowImport(
  current: WorkflowNode[],
  parsedNodes: WorkflowNode[],
  generateId: (prefix: string) => string = defaultGenerateId,
): FlowImportPlanResult {
  const userNodes = parsedNodes.filter((n): n is MenuWorkflowNode | MessageWorkflowNode => n.type === "menu" || n.type === "message");
  if (userNodes.length === 0) {
    return { ok: false, error: "O arquivo não tem nenhum nó de menu ou de mensagem — não há o que importar." };
  }

  // ids novos, sem colisão com o fluxo atual nem entre si
  const used = new Set(current.map((n) => n.id));
  const idMap = new Map<string, string>();
  for (const n of userNodes) {
    const prefix = n.type === "menu" ? "node-menu" : "node-message";
    let next = generateId(prefix);
    while (used.has(next)) next = generateId(prefix);
    used.add(next);
    idMap.set(n.id, next);
  }

  // fixos do arquivo → fixos do fluxo atual (mesmo tipo)
  const currentFixed = (t: WorkflowNode["type"]) => current.find((n) => n.type === t);
  const fixedMap = new Map<string, string>();
  for (const n of parsedNodes) {
    if (n.type === "menu" || n.type === "message") continue;
    const target = currentFixed(n.type);
    if (target) fixedMap.set(n.id, target.id);
  }

  let clearedLinks = 0;
  const remap = (id: string): string => {
    if (id === "") return "";
    const mapped = idMap.get(id) ?? fixedMap.get(id);
    if (mapped) return mapped;
    clearedLinks += 1;
    return "";
  };

  // posições: preserva as relativas; desce o bloco se já existe menu/mensagem no fluxo atual
  const currentHasUserNodes = current.some((n) => n.type === "menu" || n.type === "message");
  const importedYs = userNodes.map((n) => n.position?.y).filter((y): y is number => typeof y === "number");
  const currentYs = current.map((n) => n.position?.y).filter((y): y is number => typeof y === "number");
  const dy = currentHasUserNodes && importedYs.length > 0 && currentYs.length > 0
    ? Math.max(...currentYs) + LAYOUT.yStep - Math.min(...importedYs)
    : 0;

  const added: WorkflowNode[] = userNodes.map((n, i): WorkflowNode => {
    const position = n.position
      ? { x: n.position.x, y: n.position.y + dy }
      : gridPosition(current.length + i);
    if (n.type === "menu") {
      const { fallbackNodeId, ...fb } = n.properties.fallback;
      const newFallbackTarget = fallbackNodeId ? remap(fallbackNodeId) : "";
      return {
        ...n, id: idMap.get(n.id)!, position,
        properties: {
          ...n.properties,
          opcoes: n.properties.opcoes.map((o) => ({ ...o, nextNodeId: remap(o.nextNodeId) })),
          fallback: { ...fb, ...(newFallbackTarget ? { fallbackNodeId: newFallbackTarget } : {}) },
        },
      };
    }
    const { nextNodeId, ...rest } = n.properties;
    const newNext = nextNodeId ? remap(nextNodeId) : "";
    return { ...n, id: idMap.get(n.id)!, position, properties: { ...rest, ...(newNext ? { nextNodeId: newNext } : {}) } };
  });

  // ajustes "preencher vazio" nos fixos + o que não foi aplicado
  const notes: string[] = [];
  const fileTrigger = parsedNodes.find((n): n is TriggerWorkflowNode => n.type === "trigger");
  const fileAi = parsedNodes.find((n): n is AiWorkflowNode => n.type === "ai");
  const fileHandover = parsedNodes.find((n): n is HandoverWorkflowNode => n.type === "handover");

  let patched = current;
  const entryFromFile = fileTrigger?.properties.nextNodeId ? idMap.get(fileTrigger.properties.nextNodeId) : undefined;
  if (entryFromFile) {
    patched = patched.map((n) => {
      if (n.type !== "trigger") return n;
      if (!n.properties.nextNodeId) return { ...n, properties: { ...n.properties, nextNodeId: entryFromFile } };
      notes.push("A entrada do fluxo do arquivo não foi aplicada: o gatilho atual já tem uma entrada escolhida. Ajuste em “Começar por” se quiser trocar.");
      return n;
    });
  }
  const wordFromFile = (fileAi?.properties.palavraRetorno ?? "").trim();
  if (wordFromFile) {
    patched = patched.map((n) => {
      if (n.type !== "ai") return n;
      const own = (n.properties.palavraRetorno ?? "").trim();
      if (!own) {
        notes.push(`A palavra de retorno “${wordFromFile}” do arquivo foi aplicada ao Agente IA (estava vazia).`);
        return { ...n, properties: { ...n.properties, palavraRetorno: wordFromFile } };
      }
      if (own !== wordFromFile) notes.push(`O Agente IA atual já tem a palavra de retorno “${own}”; a do arquivo (“${wordFromFile}”) não foi aplicada.`);
      return n;
    });
  }
  const currentHandover = currentFixed("handover");
  if (fileHandover?.enabled && currentHandover && !currentHandover.enabled) {
    notes.push("No arquivo o Transbordo Humano estava habilitado, mas neste fluxo ele está desabilitado — as opções que levam a ele ficam com aviso até você habilitá-lo.");
  }
  if (clearedLinks > 0) {
    notes.push(`${clearedLinks} ligação(ões) do arquivo apontavam para nós que não estão nele e ficaram “sem destino”.`);
  }
  if (dy > 0) notes.push("O fluxo atual já tem menus/mensagens: o bloco importado foi posicionado abaixo deles, mantendo o desenho.");

  const merged = [...patched, ...added];
  const baseline = new Set(validateFlow(current).map(issueKey));
  const issues = validateFlow(merged).filter((i) => !baseline.has(issueKey(i)));

  return {
    ok: true, merged, addedIds: added.map((n) => n.id),
    menus: userNodes.filter((n) => n.type === "menu").length,
    messages: userNodes.filter((n) => n.type === "message").length,
    clearedLinks, notes, issues,
  };
}
