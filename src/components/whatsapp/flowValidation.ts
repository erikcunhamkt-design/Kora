// R10 — validação do fluxo do bot (função PURA, sem DOM). `validateFlow(nodes)`
// devolve os problemas do que o usuário montou no construtor, cada um com o
// `nodeId` do nó onde o aviso deve aparecer (a UI deixa clicar e selecionar o nó).
//
// Severidade (decisão do revisor): ERRO = o desenho tem um defeito que o motor
// não consegue cumprir (opção sem destino, destino que sumiu, menu sem opções,
// mensagem sem texto, ciclo/cadeia de mensagens que o motor corta). AVISO = o
// fluxo funciona, mas provavelmente não como o usuário imagina (nó que ninguém
// alcança, destino desligado, palavra de retorno que perde para o handover...).
// NENHUM bloqueia salvar — o usuário manda; a UI só nunca esconde a contagem (G29).
//
// As regras espelham o MOTOR (supabase/functions/_shared/botFlowMenu.ts): só nós
// HABILITADOS agem; a entrada é trigger.nextNodeId (menu/mensagem habilitados) ou o
// primeiro menu habilitado; mensagem encadeia até MAX_MESSAGE_HOPS; esgotar
// tentativas num menu com fallback "reprompt" (ou "node" sem destino) ENTREGA A
// HUMANO (R4) — por isso conta como "caminho pra humano".
import type { WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";
import { MAX_MESSAGE_HOPS, normalizeReturnWord } from "../../../supabase/functions/_shared/botFlowMenu";
import { matchesHandoverKeyword } from "../../../supabase/functions/_shared/botHandover";

export type FlowIssueSeverity = "error" | "warning";

export type FlowIssueCode =
  | "opcao-sem-destino"
  | "fallback-sem-destino"
  | "destino-removido"
  | "menu-sem-opcoes"
  | "mensagem-vazia"
  | "ciclo-mensagens"
  | "cadeia-longa"
  | "inalcancavel"
  | "destino-desabilitado"
  | "destino-sem-efeito"
  | "entrada-invalida"
  | "retorno-colide-handover"
  | "sem-caminho-humano-ia"
  | "entrada-ambigua";

export interface FlowIssue {
  code: FlowIssueCode;
  severity: FlowIssueSeverity;
  /** Nó onde o problema aparece (a lista da UI seleciona este nó ao clicar). */
  nodeId: string;
  message: string;
}

const ERROR_CODES: ReadonlySet<FlowIssueCode> = new Set([
  "opcao-sem-destino",
  "fallback-sem-destino",
  "destino-removido",
  "menu-sem-opcoes",
  "mensagem-vazia",
  "ciclo-mensagens",
  "cadeia-longa",
]);

function issue(code: FlowIssueCode, nodeId: string, message: string): FlowIssue {
  return { code, severity: ERROR_CODES.has(code) ? "error" : "warning", nodeId, message };
}

type EdgeKind = "option" | "fallback" | "next" | "entry";
interface Edge {
  kind: EdgeKind;
  /** "" / undefined = sem destino. */
  target: string | undefined;
  /** Como o aviso chama a aresta ("Opção 2", "Resposta inválida"...). */
  label: string;
}

/** Arestas de um nó que AGE (habilitado). Trigger só emite a entrada, e só quando preenchida. */
function edgesOf(node: WorkflowNode): Edge[] {
  if (!node.enabled) return [];
  if (node.type === "trigger") {
    return node.properties.nextNodeId ? [{ kind: "entry", target: node.properties.nextNodeId, label: "A entrada do fluxo" }] : [];
  }
  if (node.type === "menu") {
    const edges: Edge[] = node.properties.opcoes.map((o) => ({
      kind: "option" as const,
      target: o.nextNodeId || undefined,
      label: `Opção ${o.numero}${o.rotulo ? ` (“${o.rotulo}”)` : ""}`,
    }));
    if (node.properties.fallback.acao === "node") {
      edges.push({ kind: "fallback", target: node.properties.fallback.fallbackNodeId || undefined, label: "Resposta inválida" });
    }
    return edges;
  }
  if (node.type === "message") {
    return node.properties.nextNodeId ? [{ kind: "next", target: node.properties.nextNodeId, label: "Depois de enviar" }] : [];
  }
  return [];
}

const isMenuOrMessage = (n: WorkflowNode) => n.type === "menu" || n.type === "message";

/** Mesma regra do motor (resolveEntryNode): aresta explícita válida, senão o primeiro menu habilitado. */
function resolveEntry(nodes: WorkflowNode[], byId: Map<string, WorkflowNode>): WorkflowNode | null {
  const trigger = nodes.find((n) => n.type === "trigger" && n.enabled);
  if (trigger?.type === "trigger" && trigger.properties.nextNodeId) {
    const chosen = byId.get(trigger.properties.nextNodeId);
    if (chosen && chosen.enabled && isMenuOrMessage(chosen)) return chosen;
  }
  return nodes.find((n) => n.type === "menu" && n.enabled) ?? null;
}

export function validateFlow(nodes: WorkflowNode[]): FlowIssue[] {
  const issues: FlowIssue[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const trigger = nodes.find((n) => n.type === "trigger");
  const enabledMenus = nodes.filter((n) => n.type === "menu" && n.enabled);

  // ── nós: conteúdo ──
  for (const n of nodes) {
    if (!n.enabled) continue;
    if (n.type === "menu" && n.properties.opcoes.length === 0) {
      issues.push(issue("menu-sem-opcoes", n.id, `“${n.title}” é um menu sem nenhuma opção — o cliente não tem o que escolher. Adicione opções ou desabilite o nó.`));
    }
    if (n.type === "message" && n.properties.mensagem.trim() === "") {
      issues.push(issue("mensagem-vazia", n.id, `“${n.title}” está sem texto — o robô ignora uma mensagem vazia.`));
    }
  }

  // ── arestas: destino ──
  for (const n of nodes) {
    for (const e of edgesOf(n)) {
      if (!e.target) {
        if (e.kind === "option") issues.push(issue("opcao-sem-destino", n.id, `“${n.title}” — ${e.label} não leva a lugar nenhum: escolha o destino.`));
        if (e.kind === "fallback") issues.push(issue("fallback-sem-destino", n.id, `“${n.title}” — ${e.label} está em “Pular para outro nó” sem nó de destino: escolha o destino (ou volte para “Reapresentar o menu”).`));
        continue;
      }
      const target = byId.get(e.target);
      if (!target) {
        issues.push(issue("destino-removido", n.id, `“${n.title}” — ${e.label} aponta para um nó que não existe mais.`));
        continue;
      }
      if (!target.enabled) {
        issues.push(issue("destino-desabilitado", n.id, `“${n.title}” — ${e.label} leva a “${target.title}”, que está desabilitado: o robô não executa o nó e a conversa sai do fluxo.`));
        continue;
      }
      if (e.kind === "entry") {
        if (!isMenuOrMessage(target)) {
          issues.push(issue("entrada-invalida", n.id, `A entrada do fluxo aponta para “${target.title}”, que não é um menu nem uma mensagem: a entrada é ignorada e o robô começa pelo primeiro menu habilitado.`));
        }
      } else if (target.type === "trigger" || target.type === "send") {
        issues.push(issue("destino-sem-efeito", n.id, `“${n.title}” — ${e.label} leva a “${target.title}”, que não faz nada como destino: a conversa só sai do fluxo scriptado.`));
      }
    }
  }

  // ── mensagens: ciclo e cadeia longa ──
  const enabledMessages = nodes.filter((n) => n.type === "message" && n.enabled);
  const nextMessage = (n: WorkflowNode): WorkflowNode | undefined => {
    if (n.type !== "message") return undefined;
    const t = n.properties.nextNodeId ? byId.get(n.properties.nextNodeId) : undefined;
    return t && t.type === "message" && t.enabled ? t : undefined;
  };
  const inCycle = new Set<string>();
  const seenInWalk = new Set<string>();
  for (const start of enabledMessages) {
    if (seenInWalk.has(start.id)) continue;
    const path: WorkflowNode[] = [];
    const onPath = new Map<string, number>();
    let cur: WorkflowNode | undefined = start;
    while (cur && !seenInWalk.has(cur.id)) {
      onPath.set(cur.id, path.length);
      path.push(cur);
      seenInWalk.add(cur.id);
      cur = nextMessage(cur);
    }
    if (cur && onPath.has(cur.id)) {
      const cycle = path.slice(onPath.get(cur.id)!);
      cycle.forEach((c) => inCycle.add(c.id));
      const head = [...cycle].sort((a, b) => order.get(a.id)! - order.get(b.id)!)[0];
      const names = [...cycle.map((c) => `“${c.title}”`), `“${cycle[0].title}”`].join(" → ");
      issues.push(issue("ciclo-mensagens", head.id, `Ciclo de mensagens (${names}): o motor envia cada texto uma vez e corta o ciclo — nunca chega a um menu.`));
    }
  }
  // Onde uma cadeia COMEÇA no motor: destino de opção/fallback/entrada, ou mensagem que nenhuma outra aponta.
  const pointedByMessage = new Set(enabledMessages.map((m) => nextMessage(m)?.id).filter((x): x is string => !!x));
  const chainStarts = new Set<string>();
  for (const n of nodes) {
    for (const e of edgesOf(n)) {
      if (e.kind === "next" || !e.target) continue;
      const t = byId.get(e.target);
      if (t && t.type === "message" && t.enabled) chainStarts.add(t.id);
    }
  }
  for (const m of enabledMessages) if (!pointedByMessage.has(m.id)) chainStarts.add(m.id);
  for (const id of chainStarts) {
    if (inCycle.has(id)) continue;
    const start = byId.get(id)!;
    let length = 0;
    let reachesCycle = false;
    for (let cur: WorkflowNode | undefined = start; cur; cur = nextMessage(cur)) {
      if (inCycle.has(cur.id)) { reachesCycle = true; break; }
      length += 1;
    }
    if (!reachesCycle && length > MAX_MESSAGE_HOPS) {
      issues.push(issue("cadeia-longa", id, `Cadeia de ${length} mensagens seguidas a partir de “${start.title}”: o motor envia no máximo ${MAX_MESSAGE_HOPS} por resposta e corta o resto.`));
    }
  }

  // ── alcance a partir da entrada ──
  const entry = resolveEntry(nodes, byId);
  const reached = new Set<string>();
  if (entry) {
    const queue: WorkflowNode[] = [entry];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (reached.has(cur.id)) continue;
      reached.add(cur.id);
      for (const e of edgesOf(cur)) {
        const t = e.target ? byId.get(e.target) : undefined;
        if (t && t.enabled && t.type !== "trigger") queue.push(t);
      }
    }
  }
  for (const n of nodes) {
    if (n.enabled && isMenuOrMessage(n) && !reached.has(n.id)) {
      issues.push(issue("inalcancavel", n.id, `“${n.title}” não é alcançado por nenhum caminho a partir da entrada do fluxo — o cliente nunca chega nele.`));
    }
  }

  // ── caminho pra humano ou IA (só faz sentido se há menu em uso) ──
  const reachedMenus = [...reached].map((id) => byId.get(id)!).filter((n) => n.type === "menu");
  if (reachedMenus.length > 0) {
    const reachedList = [...reached].map((id) => byId.get(id)!);
    const hasAi = reachedList.some((n) => n.type === "ai");
    const hasHandover = reachedList.some((n) => n.type === "handover");
    // R4: esgotar tentativas entrega a humano quando o fallback é "reprompt" ou "node" sem destino.
    const exhaustionToHuman = reachedMenus.some(
      (n) => n.type === "menu" && (n.properties.fallback.acao === "reprompt" || !n.properties.fallback.fallbackNodeId),
    );
    if (!hasAi && !hasHandover && !exhaustionToHuman) {
      issues.push(issue("sem-caminho-humano-ia", (trigger ?? entry ?? nodes[0]).id, "Nenhum caminho do fluxo leva a um atendente humano nem à IA — o cliente pode ficar preso sem atendimento. Ligue uma opção ao Transbordo Humano ou ao Agente IA."));
    }
  }

  // ── entrada ambígua ──
  if (enabledMenus.length > 1 && trigger) {
    const explicit = trigger.enabled && trigger.type === "trigger" && trigger.properties.nextNodeId
      ? byId.get(trigger.properties.nextNodeId)
      : undefined;
    if (!(explicit && explicit.enabled && isMenuOrMessage(explicit))) {
      issues.push(issue("entrada-ambigua", trigger.id, `“Começar por” está em Automático com ${enabledMenus.length} menus habilitados — o robô entra no primeiro (“${enabledMenus[0].title}”). Escolha a entrada para não depender da ordem.`));
    }
  }

  // ── palavra de retorno × handover por palavra-chave ──
  const hasEnabledHandover = nodes.some((n) => n.type === "handover" && n.enabled);
  if (hasEnabledHandover) {
    for (const n of nodes) {
      if (n.type !== "ai" || !n.enabled) continue;
      const word = normalizeReturnWord(n.properties.palavraRetorno);
      if (word && matchesHandoverKeyword(word)) {
        issues.push(issue("retorno-colide-handover", n.id, `A palavra de retorno “${n.properties.palavraRetorno?.trim()}” contém uma palavra-chave de atendimento humano: ela vence (volta ao menu) e o cliente que a digitar não é encaminhado a um atendente.`));
      }
    }
  }

  // erros primeiro; dentro de cada grupo, na ordem em que os nós aparecem no fluxo
  return issues
    .map((it, i) => ({ it, i }))
    .sort((a, b) =>
      (a.it.severity === b.it.severity ? 0 : a.it.severity === "error" ? -1 : 1) ||
      (order.get(a.it.nodeId) ?? 0) - (order.get(b.it.nodeId) ?? 0) ||
      a.i - b.i,
    )
    .map(({ it }) => it);
}

export interface FlowIssueSummary {
  errors: number;
  warnings: number;
  /** "2 erros e 1 aviso" · "1 aviso" · "" quando não há nada. */
  label: string;
}

export function summarizeFlowIssues(issues: FlowIssue[]): FlowIssueSummary {
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} ${errors === 1 ? "erro" : "erros"}`);
  if (warnings > 0) parts.push(`${warnings} ${warnings === 1 ? "aviso" : "avisos"}`);
  return { errors, warnings, label: parts.join(" e ") };
}
