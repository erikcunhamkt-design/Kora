import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getBooleanFlag, setBooleanFlag } from "@/config/flags";

export function SupabaseOperationalDashboardToggleCard() {
  const [enabled, setEnabled] = useState(() => getBooleanFlag("supabaseOperationalDashboard"));

  const handleToggle = () => {
    const nextVal = !enabled;
    setBooleanFlag("supabaseOperationalDashboard", nextVal);
    setEnabled(nextVal);
    toast.success(`Visão Operacional Supabase ${nextVal ? "ativada" : "desativada"}.`);
    // Dispatch storage event to alert UI dynamically
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <SettingsCard title="Visão Operacional Supabase (Experimental)">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Acompanhe dados experimentais já persistidos no Supabase. Esta visualização é somente leitura e não substitui os módulos locais.
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
