import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccessibility } from "@/contexts/accessibility-context-value";
import { AdaptiveNumber } from "@/components/accessibility/AdaptiveNumber";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  accent?: "primary" | "destructive" | "amber" | "emerald";
}

function renderValue(value: string) {
  if (value.startsWith("R$")) {
    const cleanStr = value.replace("R$", "").trim();
    const normalized = cleanStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      return <AdaptiveNumber value={num} type="currency" />;
    }
  }
  const normalizedStr = value.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalizedStr);
  if (!isNaN(num) && /^\d+$/.test(normalizedStr)) {
    return <AdaptiveNumber value={num} type="number" />;
  }
  return <span>{value}</span>;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  const TrendIcon = changeType === "positive" ? TrendingUp : changeType === "negative" ? TrendingDown : null;
  const trendColor = changeType === "positive" ? "text-emerald-400" : changeType === "negative" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="group relative rounded-xl border border-border/20 bg-card/30 backdrop-blur-xs hover:bg-card-elevated/40 hover:border-border/40 transition-all duration-300 p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[0.6875rem] text-muted-foreground/75 font-semibold uppercase tracking-[0.12em]">{title}</p>
        <div className="h-8 w-8 rounded-lg border border-border/20 bg-muted/10 text-muted-foreground flex items-center justify-center transition-all duration-300">
          <Icon className="h-[15px] w-[15px]" />
        </div>
      </div>
      <p className="text-[2.25rem] font-bold tracking-tight leading-none text-white tabular-nums mt-1">{renderValue(value)}</p>
      {change && (
        <div className="text-[0.75rem] mt-3 font-medium flex items-center gap-1 text-muted-foreground">
          {TrendIcon && <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
