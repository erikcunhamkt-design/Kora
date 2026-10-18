import { SettingsCard } from "@/components/settings/SettingsCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCatalogSource } from "@/hooks/useCatalogSource";

// G94 / CT4 — cards de toggle do catálogo comercial (padrão dos outros domínios: SettingsCard + status + botão).
// Fonte e escrita são DUAS flags (como tasks/finance/projects): a fonte decide DE ONDE a tela lê; a escrita decide
// se as alterações são gravadas na nuvem. Padrão dos dois: desligado (LOCAL) nesta fase — o flip é o CT7.

function StatusRow({ on, label, actionLabel, onToggle, destructive }: {
  on: boolean; label: string; actionLabel: string; onToggle: () => void; destructive: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 px-3 border border-border/60 bg-muted/10 rounded-lg">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${on ? "bg-emerald-500" : "bg-muted-foreground/45"}`} />
        <span className="text-xs font-semibold text-foreground">{label}</span>
      </div>
      <Button size="sm" variant={destructive ? "destructive" : "default"} className="text-xs h-8" onClick={onToggle}>
        {actionLabel}
      </Button>
    </div>
  );
}

export function CatalogSupabaseSourceToggleCard() {
  const { dataSource, setDataSource } = useCatalogSource();
  const cloud = dataSource === "supabase";

  const handleToggle = () => {
    const next = cloud ? "local" : "supabase";
    setDataSource(next);
    toast.success(`Fonte do catálogo comercial: ${next === "supabase" ? "Supabase (nuvem)" : "Local"}.`);
  };

  return (
    <SettingsCard title="Catálogo comercial · fonte de dados">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Escolhe de onde a tela Vendas → Catálogo (categorias, serviços, produtos e planos) lê. Padrão: <strong>Local</strong>
          (o catálogo deste navegador, como sempre). Em <strong>Supabase</strong> a tela lê o catálogo da nuvem — que começa
          vazio até você importar o local (“Importar catálogo comercial”, na seção Dados) — e, se as tabelas ainda não
          existirem (pacote §8-b), avisa “schema pendente” e continua no local. Esta chave é por navegador e não migra nenhum dado.
        </p>
        <StatusRow
          on={cloud}
          label={`Fonte: ${cloud ? "Supabase (nuvem)" : "Local"}`}
          actionLabel={cloud ? "Voltar para Local" : "Usar Supabase"}
          onToggle={handleToggle}
          destructive={cloud}
        />
      </div>
    </SettingsCard>
  );
}

export function CatalogSupabaseWriteToggleCard() {
  const { dataSource, writeEnabled, setWriteEnabled } = useCatalogSource();
  const cloud = dataSource === "supabase";

  const handleToggle = () => {
    const next = !writeEnabled;
    setWriteEnabled(next);
    toast.success(`Gravação do catálogo na nuvem ${next ? "ativada" : "desativada"}.`);
  };

  return (
    <SettingsCard title="Catálogo comercial · escrita na nuvem">
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground leading-normal">
          Só vale com a fonte em Supabase. <strong>Ligada</strong>: criar, editar, arquivar, duplicar e excluir no Catálogo
          gravam no Supabase. <strong>Desligada</strong> (padrão): a tela mostra o catálogo da nuvem mas <strong>bloqueia</strong> as
          alterações com aviso — nada é salvo (nunca grava no catálogo local um item que você vê como “da nuvem”).
          {!cloud ? " Com a fonte em Local, esta chave não tem efeito." : ""}
        </p>
        <StatusRow
          on={writeEnabled}
          label={`Escrita: ${writeEnabled ? "Ativa" : "Inativa"}`}
          actionLabel={writeEnabled ? "Desativar" : "Ativar"}
          onToggle={handleToggle}
          destructive={writeEnabled}
        />
      </div>
    </SettingsCard>
  );
}
