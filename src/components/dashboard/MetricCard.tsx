import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  accent?: "primary" | "destructive" | "amber" | "emerald";
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon, accent = "primary" }: MetricCardProps) {
  const changeColor =
    changeType === "positive" ? "text-emerald-400"
    : changeType === "negative" ? "text-destructive"
    : "text-muted-foreground";

  const TrendIcon = changeType === "positive" ? TrendingUp : changeType === "negative" ? TrendingDown : null;

  const colors = {
    primary: "text-[#EC4899] bg-[#EC4899]/5 border-[#EC4899]/15 group-hover:bg-[#EC4899]/10",
    destructive: "text-[#F87171] bg-[#EF4444]/5 border-[#EF4444]/15 group-hover:bg-[#EF4444]/10",
    amber: "text-[#FBBF24] bg-[#F59E0B]/5 border-[#F59E0B]/15 group-hover:bg-[#F59E0B]/10",
    emerald: "text-[#34D399] bg-[#10B981]/5 border-[#10B981]/15 group-hover:bg-[#10B981]/10",
  } as const;

  const textGradient = {
    primary: "bg-gradient-to-r from-[#EC4899] to-[#F43F5E] bg-clip-text text-transparent",
    destructive: "bg-gradient-to-r from-[#F87171] to-[#EF4444] bg-clip-text text-transparent",
    amber: "bg-gradient-to-r from-[#FBBF24] to-[#D97706] bg-clip-text text-transparent",
    emerald: "bg-gradient-to-r from-[#34D399] to-[#059669] bg-clip-text text-transparent",
  } as const;

  return (
    <div className="group relative rounded-xl border border-border/20 bg-card/30 backdrop-blur-xs hover:bg-card-elevated/40 hover:border-border/40 transition-all duration-300 p-5">
      <div className="flex items-start justify-between mb-5">
        <p className="text-[0.6875rem] text-muted-foreground/75 font-semibold uppercase tracking-[0.12em]">{title}</p>
        <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center transition-all duration-300", colors[accent])}>
          <Icon className="h-[15px] w-[15px]" />
        </div>
      </div>
      <p className={cn("text-[2.25rem] font-extrabold tracking-tight leading-none tabular-nums mt-1", textGradient[accent])}>{value}</p>
      {change && (
        <div className={cn("text-[0.75rem] mt-3 font-medium flex items-center gap-1", changeColor)}>
          {TrendIcon && <TrendIcon className="h-3 w-3" />}
          <span>{change}</span>
        </div>
      )}
    </div>
  );
}
