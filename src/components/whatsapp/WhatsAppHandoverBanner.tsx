import { Bot, Headset, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime as intlDateTime } from "@/lib/format";

// Etapa 9 · Item 4, R4 (UI de Atendimento) — indicador de conversa "entregue a
// humano" + ação "Devolver ao robô" (docs/qa/etapa-9-bot-fluxo-scriptado-r4-
// ui-atendimento-handover.md). `handedOverAt` vem de `getHandoverAt()`
// (src/lib/whatsapp/handover.ts): `null` quando a conversa não está entregue
// OU quando a coluna `handover_at` ainda não existe (migration §8-b pendente)
// — nos dois casos nada é renderizado, nunca quebra.
export function WhatsAppHandoverBanner({
  handedOverAt,
  returning,
  onReturn,
}: {
  handedOverAt: string | null;
  returning: boolean;
  onReturn: () => void;
}) {
  if (!handedOverAt) return null;

  return (
    <div
      role="status"
      className="px-4 md:px-5 py-2 border-b border-amber-500/30 bg-amber-500/10 flex items-center gap-3"
    >
      <Headset className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs text-foreground/90">
        <span className="font-semibold">Entregue a atendimento humano</span>
        <span className="text-muted-foreground">
          {" "}desde {intlDateTime(handedOverAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
          {" "}— o robô está em silêncio nesta conversa.
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1.5 flex-shrink-0"
        disabled={returning}
        onClick={onReturn}
      >
        {returning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
        Devolver ao robô
      </Button>
    </div>
  );
}
