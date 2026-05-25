import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  const changeColor =
    changeType === "positive" ? "text-emerald-400"
    : changeType === "negative" ? "text-destructive"
    : "text-muted-foreground";

  const TrendIcon = changeType === "positive" ? TrendingUp : changeType === "negative" ? TrendingDown : null;

  return (
    <div className="group relative rounded-xl border border-border/50 bg-card/60 hover:border-border hover:bg-card transition-all duration-200 p-5">
      <div className="flex items-start justify-between mb-5">
        <p className="text-[0.6875rem] text-muted-foreground/80 font-semibold uppercase tracking-[0.12em]">{title}</p>
        <div className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-200">
          <Icon className="h-[15px] w-[15px] text-muted-foreground group-hover:text-primary transition-colors duration-200" />
        </div>
      </div>
      <p className="text-[2.5rem] font-bold text-foreground tracking-tight leading-none tabular-nums">{value}</p>
      {change && (
        <div className={cn("text-[0.75rem] mt-3 font-medium flex items-center gap-1", changeColor)}>
          {TrendIcon && <TrendIcon className="h-3 w-3" />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
