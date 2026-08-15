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
// Estrutura pensada pra ser estendida pelo item 3 (base de conhecimento) sem
// reescrever esta função: `[brainPreamble, knowledgeBlock, systemInstruction]`
// no mesmo padrão `.filter(Boolean).join("\n\n")` — ver
// etapa-9-item3-base-conhecimento-fase-a.md §4.
export function composeSystemInstruction(
  brain: BrainProfileFields | null | undefined,
  systemInstruction: string,
): string {
  const brainPreamble = buildBrainPreamble(brain);
  return [brainPreamble, systemInstruction].filter(Boolean).join("\n\n");
}
