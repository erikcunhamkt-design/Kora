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
    <div className="orbit-card-hover p-5 group">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
        <div className="p-2 rounded-lg bg-muted/60 group-hover:bg-primary/10 transition-all duration-300">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
      {change && (
        <p className={`text-[11px] mt-2 font-medium ${changeColor}`}>{change}</p>
      )}
    </div>
  );
}
