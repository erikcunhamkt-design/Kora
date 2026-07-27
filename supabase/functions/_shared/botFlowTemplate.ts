// Pure logic for the WhatsApp bot's visual flow (trigger/ai/send/handover nodes).
// No Deno.*, no npm: imports — safe to run under Deno (Edge Functions) and
// under Node/Vitest (unit tests). Keep it that way.

export interface BotFlowNode {
  type: string;
  enabled: boolean;
  properties?: {
    template?: string;
  };
}

export function findEnabledNode<T extends BotFlowNode>(nodes: T[], type: string): T | undefined {
  return nodes.find((n) => n.type === type && n.enabled);
}

// Applies the Send Node's template (if any) to the raw AI reply.
// - No enabled "send" node, or no (non-empty) template configured: returns the
//   reply unchanged (this is also what a default "{{reply}}" template produces,
//   which is why a missing/misapplied template was invisible for years).
// - Template without "{{reply}}": returned verbatim (static message).
export function applySendTemplate(nodes: BotFlowNode[], reply: string): string {
  const sendNode = findEnabledNode(nodes, "send");
  const template = sendNode?.properties?.template;
  if (typeof template !== "string" || template.length === 0) return reply;
  return template.includes("{{reply}}") ? template.replace("{{reply}}", reply) : template;
}
