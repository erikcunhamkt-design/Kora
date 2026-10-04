import { useEffect, useRef } from "react";
import { Bot, Eye, Headset, Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SimMessage, SimStateSummary } from "./flowSimulatorModel";

// Etapa 9 · Item 4 — painel "Simulador do Fluxo" (extraído de WhatsAppBotConfig;
// docs/qa/etapa-9-bot-simulador-fluxo-cobertura.md §4). Só apresentação: o estado
// e a chamada ao server ficam no pai (flowSimulatorModel.ts tem a lógica pura).
export function FlowSimulatorPanel({
  messages,
  simulating,
  input,
  onInputChange,
  onSubmit,
  onReset,
  stateSummary,
}: {
  messages: SimMessage[];
  simulating: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onReset: () => void;
  stateSummary: SimStateSummary;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="lg:col-span-4 h-full flex flex-col rounded-xl border border-border/40 bg-card shadow-md overflow-hidden min-h-[580px]">
      <div className="bg-gradient-to-r from-violet-950/30 to-indigo-950/30 px-4 py-3.5 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" /> Simulador do Fluxo
          </span>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          title="Reiniciar simulação — limpa o chat e devolve o robô ao início do fluxo"
          className="h-7 gap-1.5 px-2 text-[11px] text-muted-foreground hover:text-foreground rounded-lg"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reiniciar simulação
        </Button>
      </div>

      {/* Estado atual da simulação (nó / tentativas / entregue a humano) */}
      <div
        role="status"
        aria-label="Estado da simulação"
        className={`px-4 py-2 border-b border-border/40 text-[11px] flex items-center gap-2 shrink-0 ${
          stateSummary.tone === "handover"
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : stateSummary.tone === "menu"
              ? "bg-violet-500/10 text-violet-700 dark:text-violet-300"
              : "bg-background/30 text-muted-foreground"
        }`}
      >
        {stateSummary.tone === "handover" && <Headset className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
        <span className="font-semibold shrink-0">Estado:</span>
        <span className="min-w-0">{stateSummary.label}</span>
      </div>

      {/* Simulator Messages Screen */}
      <div
        role="log"
        aria-label="Conversa simulada"
        className="flex-1 p-4 space-y-4 overflow-y-auto bg-background/25 flex flex-col min-h-0"
      >
        {messages.map((msg, index) =>
          msg.role === "system" ? (
            <div
              key={index}
              className="self-center max-w-[92%] rounded-lg border border-dashed border-border/60 bg-background/40 px-3 py-1.5 text-center text-[11px] text-muted-foreground whitespace-pre-line"
            >
              {msg.text}
            </div>
          ) : (
            <div
              key={index}
              className={`flex gap-2.5 max-w-[85%] ${msg.role === "user" ? "self-end flex-row-reverse" : "self-start flex-row"}`}
            >
              <div
                className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                  msg.role === "user" ? "bg-violet-600/20 text-violet-400" : "bg-card-elevated text-violet-500 border border-border/40"
                }`}
              >
                {msg.role === "user" ? "U" : <Bot className="h-4 w-4" />}
              </div>

              <div className="min-w-0">
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-none"
                      : "bg-card border border-border/40 text-foreground/90 rounded-tl-none"
                  }`}
                >
                  <p className="whitespace-pre-line font-sans">{msg.text}</p>
                </div>
                {msg.tag && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                    <Headset className="h-3 w-3" aria-hidden="true" />
                    {msg.tag}
                  </p>
                )}
              </div>
            </div>
          ),
        )}

        {simulating && (
          <div className="flex gap-2.5 max-w-[80%] self-start flex-row">
            <div className="h-7 w-7 rounded-lg bg-card-elevated text-violet-500 border border-border/40 flex items-center justify-center shrink-0 animate-pulse">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-card border border-border/40 rounded-2xl rounded-tl-none px-3.5 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
              <span>Processando fluxo de nós...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Simulator Input Bar */}
      <form onSubmit={onSubmit} className="p-3 border-t border-border/40 bg-card-elevated/50 flex gap-2 shrink-0">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Envie uma mensagem de teste..."
          disabled={simulating}
          className="h-9 text-xs bg-background/40 border-border/60 focus:border-violet-500 focus:ring-violet-500"
        />
        <Button
          type="submit"
          disabled={!input.trim() || simulating}
          size="icon"
          aria-label="Enviar mensagem de teste"
          className="h-9 w-9 shrink-0 bg-violet-600 hover:bg-violet-500 text-white shadow-sm"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}
