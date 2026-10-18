// R11 — exportar/importar o fluxo (funções PURAS): round-trip, arquivo inválido recusado
// com o motivo, plano de importação (ids únicos e reescritos, ligações remapeadas,
// posições, "preencher vazio" nos fixos, problemas que a importação INTRODUZ).
import { describe, it, expect } from "vitest";
import {
  FLOW_EXPORT_SCHEMA, FLOW_EXPORT_VERSION, exportFlow, flowExportFileName, parseFlowImport, planFlowImport, serializeFlow,
  type FlowImportPlan,
} from "@/components/whatsapp/flowTransfer";
import { buildFlowExample, EXAMPLE_IDS } from "@/components/whatsapp/flowExample";
import { validateFlow } from "@/components/whatsapp/flowValidation";
import { withAutoLayout } from "@/components/whatsapp/flowCanvasModel";
import type { AiWorkflowNode, MenuWorkflowNode, MessageWorkflowNode, WorkflowNode } from "@/components/whatsapp/WhatsAppBotConfig";

function pristine(over: { handover?: boolean; entry?: string; palavra?: string; key?: string; sa?: string } = {}): WorkflowNode[] {
  return withAutoLayout([
    {
      id: "node-trigger", type: "trigger", title: "Gatilho de Entrada", enabled: true,
      properties: { respondAll: true, ...(over.entry ? { nextNodeId: over.entry } : {}) },
    },
    {
      id: "node-ai", type: "ai", title: "Agente IA (Gemini)", enabled: true,
      properties: {
        instruction: "Seja breve", model: "gemini-3.6-flash", provider: "gemini_api_key",
        geminiApiKey: over.key ?? "", gcpProjectId: "proj", gcpRegion: "us-central1", gcpServiceAccount: over.sa ?? "", customModelName: "",
        ...(over.palavra === undefined ? {} : { palavraRetorno: over.palavra }),
      },
    },
    { id: "node-send", type: "send", title: "Enviar Mensagem", enabled: true, properties: { template: "{{reply}}" } },
    { id: "node-handover", type: "handover", title: "Transbordo Humano", enabled: over.handover ?? false, properties: { assignTo: "" } },
  ]);
}

const exampleFlow = () => buildFlowExample(pristine());
const exportedText = (nodes: WorkflowNode[]) => serializeFlow(nodes, new Date("2026-10-20T12:00:00Z"));
const get = (ns: WorkflowNode[], id: string) => ns.find((n) => n.id === id)!;

/** Gerador determinístico: devolve ids que COLIDEM de propósito nas primeiras tentativas. */
function seqGen(...forced: string[]) {
  let i = 0;
  let n = 0;
  return (prefix: string) => (i < forced.length ? forced[i++] : `${prefix}-g${n++}`);
}

describe("exportFlow / serializeFlow", () => {
  it("cabeçalho: schema, versão, data e todos os nós (posições inclusas)", () => {
    const file = exportFlow(exampleFlow(), new Date("2026-10-20T12:00:00Z"));
    expect(file.schema).toBe(FLOW_EXPORT_SCHEMA);
    expect(file.version).toBe(FLOW_EXPORT_VERSION);
    expect(file.exportedAt).toBe("2026-10-20T12:00:00.000Z");
    expect(file.nodes).toHaveLength(7);
    expect(file.nodes.every((n) => typeof n.position?.x === "number")).toBe(true);
  });

  it("G71: NUNCA exporta credenciais (chave Gemini e service account saem vazias); o resto do nó ai segue", () => {
    const text = exportedText(pristine({ key: "AIzaSEGREDO", sa: '{"private_key":"SEGREDO-SA"}' }));
    expect(text).not.toContain("AIzaSEGREDO");
    expect(text).not.toContain("SEGREDO-SA");
    const ai = JSON.parse(text).nodes.find((n: WorkflowNode) => n.type === "ai") as AiWorkflowNode;
    expect(ai.properties).toMatchObject({ geminiApiKey: "", gcpServiceAccount: "", instruction: "Seja breve", gcpProjectId: "proj" });
  });

  it("não muta os nós de entrada (credenciais continuam no estado da tela)", () => {
    const nodes = pristine({ key: "AIzaSEGREDO" });
    const snapshot = JSON.stringify(nodes);
    serializeFlow(nodes);
    expect(JSON.stringify(nodes)).toBe(snapshot);
  });

  it("nome do arquivo com a data; JSON indentado", () => {
    expect(flowExportFileName(new Date("2026-10-20T12:00:00Z"))).toBe("fluxo-robo-2026-10-20.json");
    expect(exportedText(pristine())).toContain('\n  "schema"');
  });
});

describe("parseFlowImport — round-trip e arquivos válidos", () => {
  it("ROUND-TRIP: exportar → serializar → ler devolve exatamente os nós exportados", () => {
    const original = exampleFlow();
    const parsed = parseFlowImport(exportedText(original));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.nodes).toEqual(exportFlow(original).nodes);
    expect(parsed.exportedAt).toBe("2026-10-20T12:00:00.000Z");
  });

  it("round-trip preserva posições, palavra de retorno, entrada do gatilho e fallback 'node'", () => {
    const menu: MenuWorkflowNode = {
      id: "m", type: "menu", title: "Menu", enabled: true, position: { x: 10.5, y: -3 },
      properties: { mensagem: "oi", opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "msg" }], fallback: { maxTentativas: 4, acao: "node", fallbackNodeId: "msg" } },
    };
    const msg: MessageWorkflowNode = { id: "msg", type: "message", title: "Msg", enabled: false, position: { x: 0, y: 0 }, properties: { mensagem: "x", nextNodeId: "m" } };
    const flow = [...pristine({ entry: "m", palavra: "voltar" }), menu, msg];
    const parsed = parseFlowImport(exportedText(flow));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(get(parsed.nodes, "m")).toEqual(menu);
    expect(get(parsed.nodes, "msg")).toEqual(msg);
    expect(get(parsed.nodes, "node-trigger").properties).toEqual({ respondAll: true, nextNodeId: "m" });
    expect((get(parsed.nodes, "node-ai") as AiWorkflowNode).properties.palavraRetorno).toBe("voltar");
  });

  it("credenciais que apareçam no ARQUIVO são ignoradas na leitura (arquivo adulterado não injeta chave)", () => {
    const file = JSON.parse(exportedText(pristine()));
    file.nodes.find((n: WorkflowNode) => n.type === "ai").properties.geminiApiKey = "INJETADA";
    file.nodes.find((n: WorkflowNode) => n.type === "ai").properties.gcpServiceAccount = "INJETADA-SA";
    const parsed = parseFlowImport(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(JSON.stringify(parsed.nodes)).not.toContain("INJETADA");
  });

  it("propriedades desconhecidas são descartadas; posição inválida é descartada (o resto do nó vale)", () => {
    const file = JSON.parse(exportedText(exampleFlow()));
    const menu = file.nodes.find((n: WorkflowNode) => n.type === "menu");
    menu.properties.lixo = "x";
    menu.position = { x: "1", y: 2 };
    const parsed = parseFlowImport(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);
    const parsedMenu = get(parsed.nodes, EXAMPLE_IDS.menu) as MenuWorkflowNode;
    expect("lixo" in parsedMenu.properties).toBe(false);
    expect(parsedMenu.position).toBeUndefined();
  });
});

describe("parseFlowImport — arquivo INVÁLIDO é recusado com o motivo", () => {
  const refuse = (text: string) => {
    const r = parseFlowImport(text);
    if (r.ok) throw new Error("devia recusar");
    return r.error;
  };
  const mutate = (fn: (file: { nodes: Array<Record<string, unknown>> } & Record<string, unknown>) => void) => {
    const file = JSON.parse(exportedText(exampleFlow()));
    fn(file);
    return JSON.stringify(file);
  };

  it("vazio, não-JSON, JSON de outra coisa", () => {
    expect(refuse("")).toMatch(/vazio/);
    expect(refuse("   \n")).toMatch(/vazio/);
    expect(refuse("{nao eh json")).toMatch(/não é um JSON válido/);
    expect(refuse("[]")).toMatch(/não é um fluxo exportado/);
    expect(refuse('{"nodes":[]}')).toMatch(/não é um fluxo exportado/);
    expect(refuse(mutate((f) => { f.schema = "outro"; }))).toMatch(/não é um fluxo exportado/);
  });

  it("versão ausente, futura ou inválida", () => {
    expect(refuse(mutate((f) => { delete f.version; }))).toMatch(/não informa a versão/);
    expect(refuse(mutate((f) => { f.version = FLOW_EXPORT_VERSION + 1; }))).toMatch(/versão 2/);
    expect(refuse(mutate((f) => { f.version = 0; }))).toMatch(/não é suportada/);
  });

  it("sem nós / nós que não são lista", () => {
    expect(refuse(mutate((f) => { f.nodes = []; }))).toMatch(/nenhum nó/);
    expect(refuse(mutate((f) => { (f as Record<string, unknown>).nodes = "x"; }))).toMatch(/nenhum nó/);
  });

  it("nó malformado: id, enabled, tipo desconhecido, properties", () => {
    expect(refuse(mutate((f) => { delete f.nodes[0].id; }))).toMatch(/Nó 1.*“id”/);
    expect(refuse(mutate((f) => { f.nodes[1].enabled = "sim"; }))).toMatch(/Nó 2.*enabled/);
    expect(refuse(mutate((f) => { f.nodes[2].type = "banana"; }))).toMatch(/tipo de nó desconhecido “banana”/);
    expect(refuse(mutate((f) => { delete f.nodes[0].properties; }))).toMatch(/properties/);
    expect(refuse(mutate((f) => { (f.nodes as unknown[])[0] = 42; }))).toMatch(/Nó 1: não é um objeto/);
  });

  it("menu malformado: sem mensagem, opção incompleta, fallback inválido", () => {
    const menuIdx = (f: { nodes: Array<Record<string, unknown>> }) => f.nodes.findIndex((n) => n.type === "menu");
    expect(refuse(mutate((f) => { (f.nodes[menuIdx(f)].properties as Record<string, unknown>).mensagem = 7; }))).toMatch(/menu sem “mensagem”/);
    expect(refuse(mutate((f) => { (f.nodes[menuIdx(f)].properties as { opcoes: unknown[] }).opcoes[0] = { numero: 1 }; }))).toMatch(/opção 1 inválida/);
    expect(refuse(mutate((f) => { (f.nodes[menuIdx(f)].properties as Record<string, unknown>).fallback = { maxTentativas: 0, acao: "reprompt" }; }))).toMatch(/fallback.*inválido/);
    expect(refuse(mutate((f) => { (f.nodes[menuIdx(f)].properties as Record<string, unknown>).fallback = { maxTentativas: 3, acao: "pular" }; }))).toMatch(/fallback.*inválido/);
  });

  it("mensagem sem texto e gatilho sem respondAll", () => {
    expect(refuse(mutate((f) => { (f.nodes.find((n) => n.type === "message")!.properties as Record<string, unknown>).mensagem = null; }))).toMatch(/mensagem sem “mensagem”/);
    expect(refuse(mutate((f) => { delete (f.nodes[0].properties as Record<string, unknown>).respondAll; }))).toMatch(/respondAll/);
  });

  it("ids duplicados no arquivo", () => {
    expect(refuse(mutate((f) => { f.nodes[1].id = f.nodes[0].id; }))).toMatch(/aparece em mais de um nó/);
  });

  it("arquivo grande demais", () => {
    expect(refuse("x".repeat(1_000_001))).toMatch(/grande demais/);
  });

  it("nunca lança, mesmo com entrada estranha", () => {
    for (const bad of ["null", "true", "123", '"texto"', "{}", '{"schema":"kora.whatsapp-bot-flow","version":1}']) {
      expect(() => parseFlowImport(bad)).not.toThrow();
      expect(parseFlowImport(bad).ok).toBe(false);
    }
  });
});

describe("planFlowImport — ids, ligações e posições", () => {
  const parsedExample = () => {
    const r = parseFlowImport(exportedText(exampleFlow()));
    if (!r.ok) throw new Error(r.error);
    return r.nodes;
  };
  const plan = (current: WorkflowNode[], nodes = parsedExample(), gen?: (p: string) => string): FlowImportPlan => {
    const p = planFlowImport(current, nodes, gen);
    if (!p.ok) throw new Error(p.error);
    return p;
  };

  it("importa o exemplo num fluxo limpo: 1 menu + 2 mensagens ADICIONADOS, os 4 fixos intactos", () => {
    const current = pristine({ handover: true });
    const p = plan(current);
    expect(p).toMatchObject({ menus: 1, messages: 2, clearedLinks: 0 });
    expect(p.merged).toHaveLength(7);
    expect(p.merged.slice(0, 4).map((n) => n.id)).toEqual(current.map((n) => n.id));
    expect(p.addedIds).toHaveLength(3);
  });

  it("IDS reescritos: nenhum id do arquivo é reaproveitado e todos são únicos no fluxo resultante", () => {
    const p = plan(pristine({ handover: true }));
    const ids = p.merged.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const original of Object.values(EXAMPLE_IDS)) expect(ids).not.toContain(original);
  });

  it("colisão de id: se o gerador devolve um id que já existe (no fluxo atual ou já usado), tenta de novo", () => {
    const current = [...pristine({ handover: true }), { id: "node-menu-dup", type: "message", title: "X", enabled: true, properties: { mensagem: "x" } } as WorkflowNode];
    const p = plan(current, parsedExample(), seqGen("node-menu-dup", "node-menu-dup", "node-menu-dup", "node-menu-novo"));
    const ids = p.merged.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(p.addedIds).toContain("node-menu-novo");
  });

  it("importar duas vezes seguidas o mesmo arquivo não colide (cada importação gera ids novos)", () => {
    const first = plan(pristine({ handover: true }));
    const second = plan(first.merged);
    const ids = second.merged.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.merged).toHaveLength(10);
  });

  it("LIGAÇÕES remapeadas: opções, volta ao menu, saudação→IA e fallback apontam pros ids NOVOS ou pros fixos ATUAIS", () => {
    const p = plan(pristine({ handover: true }));
    const [menuId, horarioId, iaId] = p.addedIds;
    const menu = get(p.merged, menuId) as MenuWorkflowNode;
    expect(menu.properties.opcoes.map((o) => o.nextNodeId)).toEqual([horarioId, iaId, "node-handover"]);
    expect((get(p.merged, horarioId) as MessageWorkflowNode).properties.nextNodeId).toBe(menuId);
    expect((get(p.merged, iaId) as MessageWorkflowNode).properties.nextNodeId).toBe("node-ai");
  });

  it("os fixos do ARQUIVO viram os fixos do fluxo ATUAL mesmo com ids diferentes", () => {
    const current = withAutoLayout(pristine({ handover: true }).map((n) => ({ ...n, id: `x-${n.id}` }) as WorkflowNode));
    const p = plan(current);
    const menu = get(p.merged, p.addedIds[0]) as MenuWorkflowNode;
    expect(menu.properties.opcoes[2].nextNodeId).toBe("x-node-handover");
    expect((get(p.merged, p.addedIds[2]) as MessageWorkflowNode).properties.nextNodeId).toBe("x-node-ai");
  });

  it("ligação para id que NÃO está no arquivo vira 'sem destino' (nunca herda um id que exista aqui) e é contada", () => {
    const nodes = parsedExample().map((n) =>
      n.type === "menu"
        ? { ...n, properties: { ...n.properties, opcoes: [{ numero: 1, rotulo: "A", nextNodeId: "node-ai-que-existe-aqui-mas-nao-no-arquivo" }, ...n.properties.opcoes.slice(1)] } }
        : n,
    ) as WorkflowNode[];
    const current = [...pristine({ handover: true }), { id: "node-ai-que-existe-aqui-mas-nao-no-arquivo", type: "message", title: "Outro", enabled: true, properties: { mensagem: "x" } } as WorkflowNode];
    const p = plan(current, nodes);
    const menu = get(p.merged, p.addedIds[0]) as MenuWorkflowNode;
    expect(menu.properties.opcoes[0].nextNodeId).toBe("");
    expect(p.clearedLinks).toBe(1);
    expect(p.notes.join(" ")).toMatch(/1 ligação\(ões\).*sem destino/);
  });

  it("POSIÇÕES preservadas no fluxo limpo (exatamente as do arquivo)", () => {
    const parsed = parsedExample();
    const p = plan(pristine({ handover: true }), parsed);
    const fileUser = parsed.filter((n) => n.type === "menu" || n.type === "message");
    expect(p.addedIds.map((id) => get(p.merged, id).position)).toEqual(fileUser.map((n) => n.position));
  });

  it("fluxo atual já tem menu/mensagem: o bloco inteiro desce (desenho relativo mantido) e uma nota avisa", () => {
    const first = plan(pristine({ handover: true }));
    const second = plan(first.merged);
    const a = first.addedIds.map((id) => get(first.merged, id).position!);
    const b = second.addedIds.map((id) => get(second.merged, id).position!);
    const maxCurrentY = Math.max(...first.merged.map((n) => n.position!.y));
    expect(Math.min(...b.map((p) => p.y))).toBeGreaterThan(maxCurrentY);
    expect(b.map((p) => p.x)).toEqual(a.map((p) => p.x));
    expect(b[1].y - b[0].y).toBe(a[1].y - a[0].y);
    expect(second.notes.join(" ")).toMatch(/abaixo/);
  });

  it("nós sem posição no arquivo ganham posição de grade", () => {
    const noPos = parsedExample().map((n) => { const { position: _p, ...rest } = n; return rest as WorkflowNode; });
    const p = plan(pristine({ handover: true }), noPos);
    expect(p.addedIds.every((id) => typeof get(p.merged, id).position?.x === "number")).toBe(true);
  });

  it("arquivo SEM menu/mensagem: não há o que importar (recusa)", () => {
    const only = parsedExample().filter((n) => n.type !== "menu" && n.type !== "message");
    const r = planFlowImport(pristine(), only);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/não há o que importar/) });
  });

  it("NÃO muta o fluxo atual nem os nós lidos do arquivo", () => {
    const current = pristine({ handover: true });
    const parsed = parsedExample();
    const a = JSON.stringify(current);
    const b = JSON.stringify(parsed);
    plan(current, parsed);
    expect(JSON.stringify(current)).toBe(a);
    expect(JSON.stringify(parsed)).toBe(b);
  });
});

describe("planFlowImport — nós fixos: só 'preencher vazio'", () => {
  const parsedExample = () => {
    const r = parseFlowImport(exportedText(exampleFlow()));
    if (!r.ok) throw new Error(r.error);
    return r.nodes;
  };
  const plan = (current: WorkflowNode[]) => {
    const p = planFlowImport(current, parsedExample());
    if (!p.ok) throw new Error(p.error);
    return p;
  };

  it("entrada do gatilho e palavra de retorno do arquivo preenchem os campos VAZIOS do fluxo atual", () => {
    const p = plan(pristine({ handover: true }));
    expect(get(p.merged, "node-trigger").properties).toMatchObject({ nextNodeId: p.addedIds[0] });
    expect((get(p.merged, "node-ai") as AiWorkflowNode).properties.palavraRetorno).toBe("menu");
    expect(p.notes.join(" ")).toMatch(/palavra de retorno “menu”.*aplicada/);
  });

  it("entrada e palavra de retorno JÁ definidas no fluxo atual NÃO são sobrescritas (e a nota diz)", () => {
    const current = [...pristine({ handover: true, entry: "meu-menu", palavra: "voltar" }), { id: "meu-menu", type: "message", title: "M", enabled: true, properties: { mensagem: "x" } } as WorkflowNode];
    const p = plan(current);
    expect(get(p.merged, "node-trigger").properties).toMatchObject({ nextNodeId: "meu-menu" });
    expect((get(p.merged, "node-ai") as AiWorkflowNode).properties.palavraRetorno).toBe("voltar");
    const notes = p.notes.join(" ");
    expect(notes).toMatch(/entrada do fluxo do arquivo não foi aplicada/);
    expect(notes).toMatch(/já tem a palavra de retorno “voltar”/);
  });

  it("configuração do Agente IA e CREDENCIAIS do fluxo atual ficam intactas", () => {
    const current = pristine({ handover: true, key: "CHAVE-DO-WORKSPACE", sa: "SA-DO-WORKSPACE" });
    const p = plan(current);
    expect((get(p.merged, "node-ai") as AiWorkflowNode).properties).toMatchObject({
      geminiApiKey: "CHAVE-DO-WORKSPACE", gcpServiceAccount: "SA-DO-WORKSPACE", instruction: "Seja breve",
    });
  });

  it("Transbordo habilitado no arquivo mas desligado aqui: NÃO é ligado em silêncio — vira nota + aviso de destino desabilitado", () => {
    const p = plan(pristine({ handover: false }));
    expect(get(p.merged, "node-handover").enabled).toBe(false);
    expect(p.notes.join(" ")).toMatch(/Transbordo Humano estava habilitado.*desabilitado/);
    expect(p.issues.map((i) => i.code)).toContain("destino-desabilitado");
  });
});

describe("planFlowImport — problemas que a importação INTRODUZ", () => {
  it("fluxo importado limpo num fluxo limpo (handover ligado): nenhum problema novo", () => {
    const r = parseFlowImport(exportedText(exampleFlow()));
    if (!r.ok) throw new Error(r.error);
    const p = planFlowImport(pristine({ handover: true }), r.nodes);
    expect(p.ok && p.issues).toEqual([]);
    expect(validateFlow((p as FlowImportPlan).merged)).toEqual([]);
  });

  it("arquivo COM problemas: eles são listados (com nodeId dos ids NOVOS), mesmo sendo estruturalmente válido", () => {
    const broken = JSON.parse(exportedText(exampleFlow()));
    const menu = broken.nodes.find((n: WorkflowNode) => n.type === "menu");
    menu.properties.opcoes[0].nextNodeId = "";
    const msg = broken.nodes.find((n: WorkflowNode) => n.id === EXAMPLE_IDS.horario);
    msg.properties.mensagem = "   ";
    const r = parseFlowImport(JSON.stringify(broken));
    if (!r.ok) throw new Error(r.error);
    const p = planFlowImport(pristine({ handover: true }), r.nodes);
    if (!p.ok) throw new Error(p.error);
    const codes = p.issues.map((i) => i.code);
    expect(codes).toContain("opcao-sem-destino");
    expect(codes).toContain("mensagem-vazia");
    expect(p.issues.every((i) => p.merged.some((n) => n.id === i.nodeId))).toBe(true);
    expect(p.issues.filter((i) => i.severity === "error").length).toBeGreaterThanOrEqual(2);
  });

  it("problemas que JÁ existiam no fluxo atual não são atribuídos à importação", () => {
    const current = [...pristine({ handover: true }), { id: "vazia", type: "message", title: "Vazia", enabled: true, properties: { mensagem: "" } } as WorkflowNode];
    expect(validateFlow(current).length).toBeGreaterThan(0);
    const r = parseFlowImport(exportedText(exampleFlow()));
    if (!r.ok) throw new Error(r.error);
    const p = planFlowImport(current, r.nodes);
    if (!p.ok) throw new Error(p.error);
    expect(p.issues.some((i) => i.nodeId === "vazia" && i.code === "mensagem-vazia")).toBe(false);
  });
});
