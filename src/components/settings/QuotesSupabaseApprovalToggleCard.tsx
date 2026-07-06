import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getBooleanFlag, setBooleanFlag } from "@/config/flags";

export function QuotesSupabaseApprovalToggleCard() {
  const [enabled, setEnabled] = useState(() => getBooleanFlag("quotesSupabaseApproval"));

  const handleToggle = () => {
    const nextVal = !enabled;
    setBooleanFlag("quotesSupabaseApproval", nextVal);
    setEnabled(nextVal);
    toast.success(`Aprovação Experimental de Orçamentos ${nextVal ? "ativada" : "desativada"}.`);
    // Dispatch storage event to alert LinkedQuotesSection / SupabaseQuotesViewerCard dynamically
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <SettingsCard title="Orçamentos Supabase - Aprovação Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite aprovar ou rejeitar orçamentos salvos no Supabase. Financeiro, projeto, PDF e envio continuam bloqueados.
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
