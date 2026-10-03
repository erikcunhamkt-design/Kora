// whatsapp-webhook — decide se vale INVOCAR `whatsapp-bot-reply` pra uma
// mensagem recebida. Pure logic — sem Deno.*, sem npm: imports (mesmo padrão
// de botHandover.ts), testável via vitest sem Deno.serve nem banco.
//
// Dívida registrada pela lane D na R4 (doc da rodada, §3): o webhook chamava
// o bot a CADA mensagem inbound, inclusive em conversa já entregue a humano
// (`whatsapp_conversations.handover_at` preenchido) — a function responde
// `skipped` cedo (guarda da R4 em whatsapp-bot-reply), mas a invocação em si
// conta no rate-limit. Aqui a decisão sobe pro webhook: conversa entregue →
// nem invoca.
//
// Degradação (mesmo padrão da R4): `handover_at` ausente (coluna ainda não
// aplicada — migration §8-b — ou o select não a devolveu) chega como
// `undefined` → `isHandedOver()` = false → comportamento de antes (invoca).
// Conversa recém-criada nesta mesma mensagem também nunca está entregue.

import { isHandedOver } from "./botHandover.ts";

export interface BotTriggerInput {
  /** Mensagem enviada por nós (outbound) — nunca dispara o bot. */
  fromMe: boolean;
  /** Tipo interno normalizado (normalizeKind) — reação nunca dispara o bot. */
  kind: string;
  /** `whatsapp_conversations.handover_at` da conversa (undefined = coluna ausente/conversa nova). */
  handoverAt: unknown;
}

export function shouldInvokeBotReply(input: BotTriggerInput): boolean {
  if (input.fromMe) return false;
  if (input.kind === "reaction") return false;
  if (isHandedOver(input.handoverAt)) return false;
  return true;
}
