import { useState } from "react";
import { Loader2, Paperclip, Send, Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function WhatsAppChatInput({
  disabled,
  sending,
  onSend,
  placeholder,
}: {
  disabled?: boolean;
  sending?: boolean;
  onSend: (text: string) => Promise<void> | void;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");

  const submit = async () => {
    const t = value.trim();
    if (!t) return;
    setValue("");
    await onSend(t);
  };

  return (
    <div className="px-5 py-3 border-t border-border/40 bg-card/30 backdrop-blur-sm">
      <div className="flex items-end gap-2 rounded-2xl border border-border/50 bg-background/60 px-2 py-1.5 focus-within:border-primary/40 focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)] transition">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                disabled
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Anexar (em breve)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                disabled
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <Smile className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Emojis (em breve)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "Escreva uma mensagem..."}
          disabled={disabled || sending}
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          className="flex-1 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] max-h-32 py-2 text-sm leading-relaxed"
        />

        <Button
          onClick={submit}
          disabled={disabled || sending || !value.trim()}
          size="icon"
          className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 shadow-[0_0_18px_hsl(var(--primary)/0.35)]"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 px-2">
        Enter para enviar · Shift+Enter para nova linha
      </p>
    </div>
  );
}
