import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getBooleanFlag, setBooleanFlag } from "@/config/flags";

export function QuotesSupabaseStatusTransitionToggleCard() {
  const [enabled, setEnabled] = useState(() => getBooleanFlag("tasksSupabaseStatusTransition"));

  const handleToggle = () => {
    const nextVal = !enabled;
    setBooleanFlag("tasksSupabaseStatusTransition", nextVal);
    setEnabled(nextVal);
    toast.success(`Transição de Status de Tarefas Supabase ${nextVal ? "ativada" : "desativada"}.`);
    // Dispatch storage event to alert UI dynamically
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <SettingsCard title="Tarefas Supabase - Transição de Status Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Libera a transição de status de tarefas dentro do painel Visão Operacional (Configurações). Desligado por padrão — a tela Tarefas já altera o status direto no Supabase por padrão (escrita de Tarefas ligada por padrão), sem depender desta chave.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <Button
            size="sm"
            variant={enabled ? "destructive" : "default"}
            className="text-xs h-8"
            onClick={handleToggle}
          >
            {enabled ? "Desativar" : "Ativar"}
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
