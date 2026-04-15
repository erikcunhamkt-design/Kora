import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
}

export function MetricCard({ title, value, change, changeType = "neutral", icon: Icon }: MetricCardProps) {
  const changeColor = changeType === "positive" ? "text-emerald-400" : changeType === "negative" ? "text-red-400" : "text-muted-foreground";

  return (
    <div className="orbit-card-hover p-6 group relative overflow-hidden">
      {/* Subtle inner glow on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-primary/[0.02] to-transparent" />
      
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[0.8125rem] text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
          <div className="p-2.5 rounded-lg bg-muted/40 group-hover:bg-primary/8 transition-all duration-300 inner-highlight">
            <Icon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors duration-300" />
          </div>
        </div>
        <p className="text-[2.25rem] font-bold text-foreground tracking-tight leading-none">{value}</p>
        {change && (
          <p className={`text-[0.8125rem] mt-3 font-medium ${changeColor}`}>{change}</p>
        )}
      </div>
    </div>
  );
}
