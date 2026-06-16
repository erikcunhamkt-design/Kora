import { SettingsCard } from "@/components/settings/SettingsCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useSupabaseCrmWriteFlag } from "@/hooks/useSupabaseCrmWriteFlag";

/**
 * Master switch for the operational CRM Supabase mode.
 * When enabled, the CRM in Supabase mode allows create / edit / move /
 * won / lost / archive / restore. The local mode is never affected.
 */
export function CrmSupabaseOperationalToggleCard() {
  const { enabled, setEnabled } = useSupabaseCrmWriteFlag();

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    toast.success(
      next
        ? "CRM Supabase Operacional ativado. Edição liberada no modo Supabase."
        : "CRM Supabase Operacional desativado. Modo Supabase volta a ser somente leitura.",
    );
  };

  return (
    <SettingsCard
      title="CRM Supabase Operacional"
      headerActions={
        <Badge
          variant="outline"
          className={
            enabled
              ? "text-[9px] uppercase tracking-wide text-emerald-400 border-emerald-500/30 bg-emerald-500/5"
              : "text-[9px] uppercase tracking-wide text-muted-foreground border-border bg-muted/20"
          }
        >
          {enabled ? "Operacional" : "Modo leitura"}
        </Badge>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Permite criar, editar e mover oportunidades diretamente no Supabase.
          O modo local permanece intacto. Quando desligado, o CRM Supabase
          funciona apenas para consulta.
        </p>
        <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
          <div className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full ${
                enabled ? "bg-emerald-500" : "bg-muted-foreground/45"
              }`}
            />
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
        <p className="text-[10px] text-muted-foreground leading-normal">
          Auditoria local em <code className="font-mono">kora.crm.supabaseActions.v1</code>.
        </p>
      </div>
    </SettingsCard>
  );
}
