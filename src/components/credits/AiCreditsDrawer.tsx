import { useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, ShoppingBag, TrendingUp, Clock, Activity, ShieldCheck, Coins, ArrowUpRight, ArrowDownRight, Gift, Wrench } from "lucide-react";
import { useAiCredits, type CreditTxType, type CreditTransaction } from "@/hooks/useAiCredits";
import { usePlan } from "@/contexts/PlanContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDateTime as intlDateTime, formatNumber as intlNumber } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PACKS = [
  { id: "starter", name: "Starter", credits: 500, hint: "Para começar a explorar IA", price: "Preço será definido" },
  { id: "growth", name: "Growth", credits: 1500, hint: "Uso recorrente de assistentes", price: "Preço será definido", popular: true },
  { id: "studio", name: "Studio", credits: 3000, hint: "Estúdios e times pequenos", price: "Preço será definido" },
  { id: "scale", name: "Scale", credits: 7500, hint: "Operações em escala", price: "Preço será definido" },
];

const TYPE_META: Record<CreditTxType, { label: string; Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  purchase: { label: "Compra", Icon: ShoppingBag, tone: "text-emerald-500/80" },
  purchase_simulated: { label: "Compra simulada", Icon: ShoppingBag, tone: "text-primary/80" },
  usage: { label: "Uso", Icon: Activity, tone: "text-muted-foreground" },
  bonus: { label: "Bônus", Icon: Gift, tone: "text-amber-400/80" },
  adjustment: { label: "Ajuste", Icon: Wrench, tone: "text-sky-400/80" },
};

function formatDate(iso: string) {
  return intlDateTime(iso, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

export function AiCreditsDrawer({ open, onOpenChange }: Props) {
  const { balance, transactions, stats, simulatePurchase } = useAiCredits();
  const { plan } = usePlan();

  const txs = useMemo(() => transactions.slice(0, 20), [transactions]);
  const low = balance <= 5;

  const handleBuy = (pack: typeof PACKS[number]) => {
    simulatePurchase({ name: pack.name, credits: pack.credits });
    toast.success("Compra simulada. O checkout real será ativado futuramente.");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] p-0 flex flex-col bg-card border-l border-border/60">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-border/60 bg-gradient-to-b from-primary/[0.04] to-transparent">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-[0.95rem] font-semibold leading-tight">Créditos de IA</h2>
              <p className="text-[0.75rem] text-muted-foreground">Use créditos para assistentes, geração e automações inteligentes.</p>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <div>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-4xl font-bold tracking-tight", low ? "text-primary" : "text-foreground")}>{balance}</span>
                <span className="text-[0.8125rem] text-muted-foreground">créditos</span>
              </div>
              {low && (
                <p className="text-[0.7rem] text-primary/80 mt-1">Saldo baixo — recarregue para continuar usando IA.</p>
              )}
            </div>
            <Badge variant="outline" className="text-[0.7rem] capitalize border-border/60 text-muted-foreground">
              Plano {plan}
            </Badge>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {/* Uso atual */}
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2.5">Uso atual</h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={<Coins className="h-3.5 w-3.5" />} label="Saldo" value={String(balance)} />
              <StatCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Usados no mês" value={String(stats.monthUsage)} />
              <StatCard icon={<Clock className="h-3.5 w-3.5" />} label="Último uso" value={formatRelative(stats.lastUsed)} />
              <StatCard icon={<Activity className="h-3.5 w-3.5" />} label="Média por ação" value={stats.avgPerAction ? stats.avgPerAction.toFixed(1) : "—"} />
            </div>
          </section>

          {/* Extrato */}
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2.5">Extrato</h3>
            {txs.length === 0 ? (
              <p className="text-[0.8125rem] text-muted-foreground py-6 text-center">Nenhuma movimentação ainda.</p>
            ) : (
              <ul className="divide-y divide-border/40 rounded-lg border border-border/50 bg-background/30 overflow-hidden">
                {txs.map((tx) => (
                  <TxRow key={tx.id} tx={tx} />
                ))}
              </ul>
            )}
          </section>

          {/* Pacotes */}
          <section>
            <h3 className="text-[0.7rem] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2.5">Pacotes</h3>
            <div className="grid grid-cols-2 gap-2.5">
              {PACKS.map((p) => (
                <div
                  key={p.id}
                  className={cn(
                    "relative p-3.5 rounded-lg border bg-background/30 flex flex-col gap-2 transition-all hover:border-primary/40",
                    p.popular ? "border-primary/30 bg-primary/[0.04]" : "border-border/50",
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-2 right-3 text-[0.6rem] font-semibold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                      POPULAR
                    </span>
                  )}
                  <div className="flex items-baseline justify-between">
                    <span className="text-[0.8125rem] font-semibold">{p.name}</span>
                    <span className="text-[0.7rem] text-muted-foreground">{intlNumber(p.credits)} cr</span>
                  </div>
                  <p className="text-[0.7rem] text-muted-foreground leading-snug min-h-[2em]">{p.hint}</p>
                  <p className="text-[0.7rem] text-muted-foreground/70 italic">{p.price}</p>
                  <Button size="sm" variant="outline" className="h-7 text-[0.7rem] mt-auto" onClick={() => handleBuy(p)}>
                    Simular compra
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Segurança */}
          <section className="rounded-lg border border-border/40 bg-muted/15 p-3 flex gap-2.5">
            <ShieldCheck className="h-4 w-4 text-muted-foreground/70 shrink-0 mt-0.5" />
            <p className="text-[0.7rem] text-muted-foreground leading-relaxed">
              Em produção, créditos serão debitados no servidor antes de executar ações de IA, com transações assinadas e auditáveis.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3">
      <div className="flex items-center gap-1.5 text-muted-foreground/80 mb-1">
        {icon}
        <span className="text-[0.7rem]">{label}</span>
      </div>
      <div className="text-[0.95rem] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TxRow({ tx }: { tx: CreditTransaction }) {
  const meta = TYPE_META[tx.type];
  const positive = tx.amount >= 0;
  const Icon = meta.Icon;
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors">
      <div className={cn("h-7 w-7 rounded-md border border-border/40 flex items-center justify-center bg-card", meta.tone)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[0.8125rem] font-medium truncate">{meta.label}</span>
          {tx.isDemo && (
            <span className="text-[0.6rem] px-1 py-px rounded bg-muted/40 text-muted-foreground/80 border border-border/40">demo</span>
          )}
          {tx.type === "purchase_simulated" && (
            <span className="text-[0.6rem] px-1 py-px rounded bg-primary/10 text-primary/80 border border-primary/20">simulado</span>
          )}
        </div>
        <p className="text-[0.7rem] text-muted-foreground truncate">{tx.description} · {formatDate(tx.createdAt)}</p>
      </div>
      <div className={cn("flex items-center gap-0.5 text-[0.8125rem] font-semibold tabular-nums", positive ? "text-emerald-500/90" : "text-foreground/80")}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {positive ? "+" : ""}{tx.amount}
      </div>
    </li>
  );
}
