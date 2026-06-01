import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function QuotesSupabaseExperimentalToggleCard() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem("kora.quotes.supabaseExperimental.enabled") === "true";
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    const nextVal = !enabled;
    try {
      localStorage.setItem("kora.quotes.supabaseExperimental.enabled", String(nextVal));
    } catch (e) {
      console.error(e);
    }
    setEnabled(nextVal);
    toast.success(`Visualização Experimental de Orçamentos ${nextVal ? "ativada" : "desativada"}.`);
    // Force a custom event or page refresh to update viewer visibility in same tab
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <SettingsCard title="Visualização Experimental de Orçamentos Supabase">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite visualizar os orçamentos importados ou salvos no Supabase a partir das configurações. A tela principal de Vendas/Orçamentos continua local.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${enabled ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
            <span className="text-xs font-semibold text-foreground">
              Status: {enabled ? "Ativa" : "Inativa"}
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
