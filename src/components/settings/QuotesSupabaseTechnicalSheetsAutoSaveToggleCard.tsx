import { useState } from "react";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getTechnicalSheetAutoSaveEnabled, setTechnicalSheetAutoSaveEnabled } from "@/config/flags";

export function QuotesSupabaseTechnicalSheetsAutoSaveToggleCard() {
  const [enabled, setEnabled] = useState(() => getTechnicalSheetAutoSaveEnabled());

  const handleToggle = () => {
    const nextVal = !enabled;
    setTechnicalSheetAutoSaveEnabled(nextVal);
    setEnabled(nextVal);
    toast.success(`Autosave de Fichas Técnicas no Supabase ${nextVal ? "ativado" : "desativado"}.`);
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <SettingsCard title="Fichas Técnicas Supabase - Autosave Experimental">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite salvar de forma automática e reativa as edições de fichas técnicas diretamente na nuvem (Supabase), substituindo o modelo de backup manual.
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
