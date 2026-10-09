// Pure logic for the "Cérebro" (AI brain) prompt composition — Etapa 9, item 2.
// No Deno.*, no npm: imports — safe to run under Deno (Edge Functions) and
// under Node/Vitest (unit tests). Mesmo padrão de anthropicParser.ts/
// botFlowTemplate.ts/retry.ts.
//
// Desenho: docs/architecture/etapa-9-item2-cerebro-fase-a.md §3. Fronteira
// com o item 3 (base de conhecimento): docs/architecture/etapa-9-item3-base-
// conhecimento-fase-a.md §4 — seções ROTULADAS no prompt composto, nunca
// misturadas sem cabeçalho (auditabilidade + exclusão seletiva futura).

export interface BrainProfileFields {
  tone?: string | null;
  talkAbout?: string | null;
  dontTalkAbout?: string | null;
  productsServices?: string | null;
  limits?: string | null;
}

export const BRAIN_SECTION_HEADER = "Sobre a empresa:";

// Monta o preâmbulo rotulado do cérebro. Campos vazios/só-espaço são
// omitidos da lista (nunca "- Tom: " em branco); se NENHUM campo tiver
// conteúdo, devolve string vazia — nunca só o cabeçalho sem itens. É essa
// string vazia (não um branch condicional à parte) que garante, em
// composeSystemInstruction, que um perfil "existe mas está vazio" degrade
// pro comportamento de hoje.
function buildBrainPreamble(brain: BrainProfileFields | null | undefined): string {
  if (!brain) return "";
  const lines: string[] = [];
  if (brain.tone?.trim()) lines.push(`- Tom: ${brain.tone.trim()}`);
  if (brain.talkAbout?.trim()) lines.push(`- Fale sobre: ${brain.talkAbout.trim()}`);
  if (brain.dontTalkAbout?.trim()) lines.push(`- Não fale sobre: ${brain.dontTalkAbout.trim()}`);
  if (brain.productsServices?.trim()) lines.push(`- Produtos/serviços: ${brain.productsServices.trim()}`);
  if (brain.limits?.trim()) lines.push(`- Limites: ${brain.limits.trim()}`);
  if (lines.length === 0) return "";
  return [BRAIN_SECTION_HEADER, ...lines].join("\n");
}

// Compõe o systemInstruction final: cérebro (rotulado, "Sobre a empresa:")
// como preâmbulo, a instrução existente do fluxo/bot depois — contexto antes
// de diretiva, nunca sobrescrevendo o que o operador já escreveu à mão em
// "Instruções de Personalidade" (WhatsAppBotConfig.tsx).
//
// Cérebro ausente/vazio: devolve `systemInstruction` INALTERADO, byte-a-byte
// idêntico — garantido por `.filter(Boolean)` descartar o preâmbulo vazio
// (uma string vazia é falsy), não por um branch condicional separado que
// pudesse divergir do caminho "com cérebro". É o que garante zero regressão
// pra todo workspace que nunca configurou um perfil (a esmagadora maioria,
// no dia em que esta fatia for ao ar).
//
// Item 3 (base de conhecimento): `knowledgeBlock` é o 3º parâmetro OPCIONAL —
// `[brainPreamble, knowledgeBlock, systemInstruction]`, mesmo padrão
// `.filter(Boolean).join("\n\n")` (etapa-9-item3-base-conhecimento-fase-a.md
// §4). Ausente/vazio/só-espaço: sai exatamente o que saía antes (nenhum
// chamador existente muda). Os dois blocos NUNCA se misturam sem rótulo
// (cabeçalhos distintos): é o que permite auditar a origem de um trecho da
// resposta e excluir só o conhecimento (revogação, LGPD art. 18 VI) sem tocar
// o preâmbulo que o operador escreveu à mão.
export function composeSystemInstruction(
  brain: BrainProfileFields | null | undefined,
  systemInstruction: string,
  knowledgeBlock?: string | null,
): string {
  const brainPreamble = buildBrainPreamble(brain);
  const knowledge = typeof knowledgeBlock === "string" ? knowledgeBlock.trim() : "";
  return [brainPreamble, knowledge, systemInstruction].filter(Boolean).join("\n\n");
}

// Cabeçalho do bloco de conhecimento — DISTINTO de BRAIN_SECTION_HEADER
// (Fase A item 3 §4: "Contexto relevante encontrado:").
export const KNOWLEDGE_SECTION_HEADER = "Contexto relevante encontrado:";

// Teto do bloco, em caracteres (~500-700 tokens em português). PROVISÓRIO: a
// Fase A deixou em aberto se existe um teto AGREGADO por chamada (R7); este é
// o menor controle que impede o bloco de crescer sem limite com a base do
// workspace. Decisão de valor final e de teto por categoria vs agregado:
// docs/qa/etapa-9-item3-r1-base-conhecimento-fundacao.md §3 (D6).
export const KNOWLEDGE_BLOCK_MAX_CHARS = 2000;

export interface KnowledgeBlockResult {
  /** Bloco pronto ("" quando não há nenhum item utilizável). */
  block: string;
  included: number;
  /** Itens válidos que ficaram de fora por causa do teto (observabilidade/log). */
  omitted: number;
}

// Monta o bloco rotulado a partir de linhas de texto JÁ derivadas pelo
// chamador (um item por linha, sem rótulo próprio). Itens vazios são
// descartados; a ordem do chamador é preservada; entra item INTEIRO ou não
// entra (nunca corta no meio de um fato — um preço pela metade é pior que
// nenhum). Sem itens utilizáveis → bloco vazio (nunca só o cabeçalho).
export function buildKnowledgeBlock(
  items: Array<string | null | undefined>,
  maxChars: number = KNOWLEDGE_BLOCK_MAX_CHARS,
): KnowledgeBlockResult {
  const valid = items
    .map((i) => (typeof i === "string" ? i.trim() : ""))
    .filter((i) => i.length > 0);
  if (valid.length === 0) return { block: "", included: 0, omitted: 0 };

  const lines: string[] = [];
  let used = KNOWLEDGE_SECTION_HEADER.length;
  for (const item of valid) {
    const line = `- ${item}`;
    const cost = line.length + 1; // +1: quebra de linha
    if (used + cost > maxChars) break; // ordem preservada: parou, o resto fica de fora
    lines.push(line);
    used += cost;
  }
  if (lines.length === 0) return { block: "", included: 0, omitted: valid.length };
  return {
    block: [KNOWLEDGE_SECTION_HEADER, ...lines].join("\n"),
    included: lines.length,
    omitted: valid.length - lines.length,
  };
}
