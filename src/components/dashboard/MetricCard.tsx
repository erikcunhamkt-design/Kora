import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

import { useAccessibility } from "@/contexts/AccessibilityContext";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  accent?: "primary" | "destructive" | "amber" | "emerald";
}

function simplifyValue(val: string, active: boolean) {
  if (!active) return val;
  if (val.startsWith("R$")) {
    const cleanStr = val.replace("R$", "").trim();
    const normalized = cleanStr.replace(/\./g, "").replace(",", ".");
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      if (num >= 1000000) return `R$ ${(num / 1000000).toFixed(0)}M`;
      if (num >= 1000) return `R$ ${(num / 1000).toFixed(0)}k`;
      return `R$ ${Math.round(num)}`;
    }
  }
  return val;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  const { settings } = useAccessibility();
  const TrendIcon = changeType === "positive" ? TrendingUp : changeType === "negative" ? TrendingDown : null;
  const trendColor = changeType === "positive" ? "text-emerald-400" : changeType === "negative" ? "text-destructive" : "text-muted-foreground";

  const displayValue = simplifyValue(value, settings.dyscalculia);

  return (
    <div className="group relative rounded-xl border border-border/20 bg-card/30 backdrop-blur-xs hover:bg-card-elevated/40 hover:border-border/40 transition-all duration-300 p-5">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[0.6875rem] text-muted-foreground/75 font-semibold uppercase tracking-[0.12em]">{title}</p>
        <div className="h-8 w-8 rounded-lg border border-border/20 bg-muted/10 text-muted-foreground flex items-center justify-center transition-all duration-300">
          <Icon className="h-[15px] w-[15px]" />
        </div>
      </div>
      <p className="text-[2.25rem] font-bold tracking-tight leading-none text-white tabular-nums mt-1">{displayValue}</p>
      {change && (
        <div className="text-[0.75rem] mt-3 font-medium flex items-center gap-1 text-muted-foreground">
          {TrendIcon && <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
