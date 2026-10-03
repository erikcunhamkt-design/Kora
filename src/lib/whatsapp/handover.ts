// Etapa 9 · Item 4, R4 (UI de Atendimento) — "entregue a humano"
// (docs/qa/etapa-9-bot-fluxo-scriptado-r4-ui-atendimento-handover.md; contrato
// do server em docs/qa/etapa-9-bot-fluxo-scriptado-r4-handover-real.md §4).
// Pure logic — sem React, sem supabase client importado: quem chama injeta o
// `invoke`, então tudo aqui é testável sem montar a página.

// `whatsapp_conversations.handover_at` é uma coluna PROPOSTA (draft de
// migration da R4, §8-b do operador) — ainda não existe no schema real nem em
// `types.ts` (WAConversation). `select("*")` e o realtime só a trazem depois
// da migration; até lá o campo simplesmente não vem na linha. Por isso a
// leitura é por `unknown`, nunca por acesso tipado: coluna ausente →
// `null` → o indicador não aparece, nada quebra.
export function getHandoverAt(conversation: unknown): string | null {
  if (!conversation || typeof conversation !== "object") return null;
  const raw = (conversation as Record<string, unknown>).handover_at;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

export function isHandedOver(conversation: unknown): boolean {
  return getHandoverAt(conversation) !== null;
}

export type EndHandoverResult =
  /** 200 — o robô volta a responder. */
  | { kind: "ok" }
  /** 409 — `handover_at` ainda não existe no banco (migration §8-b pendente). */
  | { kind: "migration_pending" }
  /** Qualquer outra falha (rede, 403, 400, 5xx...). */
  | { kind: "error"; message: string };

// Forma mínima do `supabase.functions.invoke` — injetada pra manter isto puro.
export type InvokeFn = (
  functionName: string,
  options: { body: Record<string, unknown> },
) => Promise<{ data: unknown; error: unknown }>;

// supabase-js devolve um FunctionsHttpError em respostas não-2xx; o Response
// original fica em `error.context` (status incluso). Não importamos a classe
// pra não acoplar este módulo ao supabase-js — leitura estrutural.
function readHttpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object") return null;
  const status = (context as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

function readMessage(error: unknown): string {
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "Falha ao devolver a conversa ao robô.";
}

// Chama a ação `end_human_handover` de whatsapp-instance (server da R4).
// Nunca lança: o chamador decide o toast a partir do `kind` — em especial o
// 409, que NÃO é um erro genérico (é "migration pendente") e merece mensagem
// honesta (ver `END_HANDOVER_MIGRATION_PENDING_MESSAGE`).
export async function endHumanHandover(
  invoke: InvokeFn,
  workspaceId: string,
  conversationId: string,
): Promise<EndHandoverResult> {
  try {
    const { error } = await invoke("whatsapp-instance", {
      body: { action: "end_human_handover", workspaceId, conversationId },
    });
    if (!error) return { kind: "ok" };
    if (readHttpStatus(error) === 409) return { kind: "migration_pending" };
    return { kind: "error", message: readMessage(error) };
  } catch (e) {
    return { kind: "error", message: readMessage(e) };
  }
}

export const END_HANDOVER_MIGRATION_PENDING_MESSAGE =
  "O estado “entregue a humano” ainda não existe no banco — a migration do handover (Etapa 9 · R4) precisa ser aplicada pelo operador. Nada foi alterado nesta conversa.";
