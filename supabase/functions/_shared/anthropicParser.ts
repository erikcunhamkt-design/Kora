// Pure logic for the Anthropic (Claude) provider branch of whatsapp-bot-reply.
// No Deno.*, no npm: imports — safe to run under Deno (Edge Functions) and
// under Node/Vitest (unit tests). Keep it that way (mesmo padrão de
// botFlowTemplate.ts / retry.ts).
//
// Etapa 9, item 1 — provider Anthropic no robô (paridade estrita com os 3
// providers atuais: sem streaming, sem tool-use, sem contagem de token).
// Ver docs/architecture/etapa-9-item1-parser-map.md.

export interface GeminiStyleContent {
  role: string;
  parts: Array<{ text: string }>;
}

export interface AnthropicMessageParam {
  role: "user" | "assistant";
  content: string;
}

// contents (shape Gemini local, role "user"|"model") -> messages (shape
// Anthropic, role "user"|"assistant") — mesma conversão mecânica que o
// branch `lovable` já faz pro shape OpenAI-like (index.ts:632-638).
// Diferença de protocolo: ao contrário do lovable (system embutido como
// primeira mensagem role:"system"), a Anthropic Messages API leva o system
// prompt num campo top-level `system`, fora do array de messages — por
// isso essa função não recebe/emite system, só o histórico de turnos.
export function buildAnthropicMessages(contents: GeminiStyleContent[]): AnthropicMessageParam[] {
  return contents.map((c) => ({
    role: c.role === "user" ? "user" : "assistant",
    content: c.parts[0]?.text ?? "",
  }));
}

export interface AnthropicContentBlock {
  type: string;
  text?: string;
}

export interface AnthropicMessageResponse {
  type?: string;
  content?: AnthropicContentBlock[];
  stop_reason?: string | null;
  error?: { type: string; message: string };
}

// Parser da resposta Anthropic: content[].text com checagem de type de
// bloco — só concatena blocos type:"text" (paridade estrita, item 1: sem
// tool-use, então blocos type:"tool_use"/"thinking" não são esperados em
// operação normal, mas o parser não assume isso, ignora silenciosamente
// qualquer bloco que não seja texto em vez de quebrar).
// Erro de API: a checagem de status HTTP já acontece em index.ts antes de
// chamar isto (mesmo padrão dos irmãos vertex/gemini/lovable) — este parser
// cobre o caso defensivo de um corpo de erro (`type: "error"`) vir com
// status 200 (não deveria acontecer na API real, mas não deve produzir
// silenciosamente uma reply vazia se acontecer).
export function parseAnthropicReply(data: AnthropicMessageResponse): string {
  if (data.type === "error" || data.error) {
    const detail = data.error?.message || "erro desconhecido";
    throw new Error(`API Anthropic retornou um erro: ${detail}`);
  }
  const blocks = Array.isArray(data.content) ? data.content : [];
  return blocks
    .filter((b): b is AnthropicContentBlock & { text: string } => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();
}
