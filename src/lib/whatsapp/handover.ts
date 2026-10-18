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

// Entregue a humano E sem ninguém atribuído = "Aguardando humano" (badge da lista,
// decisão D1 do revisor: sem atendente derivável a conversa fica sem dono, com
// destaque). `assigned_to` existe no schema real; mesmo assim a leitura é por
// `unknown`, igual à de `handover_at` — linha sem a chave = sem atribuição.
export function isAwaitingHuman(conversation: unknown): boolean {
  if (!isHandedOver(conversation)) return false;
  const assignedTo = (conversation as Record<string, unknown>).assigned_to;
  return !(typeof assignedTo === "string" && assignedTo.length > 0);
}

export type EndHandoverResult =
  /**
   * 200 — o robô volta a responder, SALVO `botStillMuted`.
   * - `unassigned`: a devolução desfez uma atribuição AUTOMÁTICA (a conversa ficou sem dono).
   * - `botStillMuted`: a conversa segue atribuída (atribuição humana) e o gatilho do
   *   fluxo está em "Apenas Conversas Novas (Triagem)" — o robô continua em silêncio.
   * Servidor antigo (sem os campos) => ambos `false`: o comportamento de antes.
   */
  | { kind: "ok"; unassigned: boolean; botStillMuted: boolean }
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

// Só `true` literal conta; ausente/qualquer outra coisa => false (servidor antigo, corpo vazio).
function readFlag(data: unknown, key: string): boolean {
  return !!data && typeof data === "object" && (data as Record<string, unknown>)[key] === true;
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
    const { data, error } = await invoke("whatsapp-instance", {
      body: { action: "end_human_handover", workspaceId, conversationId },
    });
    if (!error) {
      return { kind: "ok", unassigned: readFlag(data, "unassigned"), botStillMuted: readFlag(data, "botStillMuted") };
    }
    if (readHttpStatus(error) === 409) return { kind: "migration_pending" };
    return { kind: "error", message: readMessage(error) };
  } catch (e) {
    return { kind: "error", message: readMessage(e) };
  }
}

// Textos do resultado da devolução. Vocabulário = o da tela (G29): o gatilho do fluxo
// se chama "Apenas Conversas Novas (Triagem)" / "Qualquer Conversa (Irrestrito)" na aba
// "Robô IA". A orientação só cita o que a UI realmente oferece: com o controle de
// atribuição do painel de contato (G101) a saída "remover a atribuição" existe — mas, como
// mudar o gatilho, é ação de administrador (por isso o texto diz "um administrador").
export const END_HANDOVER_UNASSIGNED_DESCRIPTION =
  "Robô de volta e conversa sem atribuição — ele volta a responder a próxima mensagem do cliente.";

export const END_HANDOVER_BOT_STILL_MUTED_TITLE = "Devolvida, mas o robô continua em silêncio";

/**
 * `assignee`: o NOME de quem segue atribuído (G29 — antes era um "<nome>" genérico); quem
 * chama passa `assigneeName(atendentes, conversa.assigned_to)`, que cai em "um atendente"
 * quando o nome não é conhecido (ex.: saiu do workspace).
 */
export function endHandoverBotStillMutedDescription(assignee: string): string {
  return `A conversa continua atribuída a ${assignee} e o gatilho do fluxo está em “Apenas Conversas Novas (Triagem)” — nesse modo o robô só responde conversas sem atendente atribuído. Um administrador pode remover a atribuição (painel de contato) ou mudar o gatilho para “Qualquer Conversa (Irrestrito)” na aba “Robô IA”.`;
}

export const END_HANDOVER_MIGRATION_PENDING_MESSAGE =
  "O estado “entregue a humano” ainda não existe no banco — a migration do handover (Etapa 9 · R4) precisa ser aplicada pelo operador. Nada foi alterado nesta conversa.";
