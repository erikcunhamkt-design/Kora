import { useMemo } from "react";
import { AlertTriangle, ListChecks, ShieldCheck, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCampaigns } from "@/hooks/useCampaigns";
import { cn } from "@/lib/utils";

interface AudienceStats {
  total: number;
  valid: number;
  invalid: number;
  duplicated: number;
  alreadyClients: number;
  alreadyTalked: number;
  noOptIn: number;
  optedOut: number;
}

function deriveStats(seed: number, optedIn: number, optedOut: number, unknown: number): AudienceStats {
  // Deterministic mocks layered on top of real consent counts from useCampaigns
  const total = optedIn + optedOut + unknown + Math.max(0, seed % 30);
  const invalid = Math.floor(total * 0.04);
  const duplicated = Math.floor(total * 0.02);
  const valid = Math.max(0, total - invalid - duplicated);
  const alreadyClients = Math.floor(valid * 0.18);
  const alreadyTalked = Math.floor(valid * 0.32);
  return {
    total,
    valid,
    invalid,
    duplicated,
    alreadyClients,
    alreadyTalked,
    noOptIn: unknown,
    optedOut,
  };
}

export function AudiencesPanel() {
  const { segments, consents } = useCampaigns();

  const items = useMemo(() => {
    return segments.map((s, idx) => {
      const channelConsents = consents.filter((c) => c.channel === s.channel);
      const optedIn = channelConsents.filter((c) => c.consentStatus === "opted_in").length;
      const optedOut = channelConsents.filter((c) => c.consentStatus === "opted_out").length;
      const unknown = channelConsents.filter((c) => c.consentStatus === "unknown").length;
      return { segment: s, stats: deriveStats(idx * 7 + s.name.length, optedIn, optedOut, unknown) };
    });
  }, [segments, consents]);

  return (
    <div className="p-4 md:p-6 space-y-5 h-full overflow-y-auto">
      <div>
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Audiências / Listas
        </h2>
        <p className="text-[12px] text-muted-foreground mt-0.5 max-w-xl">
          Listas importadas ou segmentadas. Sempre exigem modelo de mensagem ativo para disparo.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-300 mt-0.5 flex-shrink-0" />
        <p className="text-[12px] text-amber-200/90 leading-relaxed">
          Contatos de campanha <strong>não viram clientes automaticamente</strong>. A conversão acontece apenas
          quando o lead avança no CRM.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map(({ segment, stats }) => (
          <article key={segment.id} className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold truncate">{segment.name}</h3>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{segment.description}</p>
              </div>
              <Badge variant="outline" className="text-[10px] uppercase">{segment.channel}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[12px]">
              <Row label="Total" value={stats.total} />
              <Row label="Válidos" value={stats.valid} accent="text-emerald-300" />
              <Row label="Inválidos" value={stats.invalid} accent="text-destructive" />
              <Row label="Duplicados" value={stats.duplicated} accent="text-amber-300" />
              <Row label="Já clientes" value={stats.alreadyClients} />
              <Row label="Já conversaram" value={stats.alreadyTalked} />
              <Row label="Sem opt-in" value={stats.noOptIn} accent="text-amber-300" />
              <Row label="Opt-out" value={stats.optedOut} accent="text-destructive" />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span>Disparo requer modelo de mensagem ativo.</span>
            </div>
          </article>
        ))}

        {items.length === 0 && (
          <div className="md:col-span-2 xl:col-span-3 rounded-xl border border-dashed border-border/60 p-10 text-center">
            <ListChecks className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma audiência cadastrada ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium tabular-nums", accent ?? "text-foreground")}>{value}</span>
    </div>
  );
}
