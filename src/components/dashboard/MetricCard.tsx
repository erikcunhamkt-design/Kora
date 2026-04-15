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
    <div className="orbit-card-hover p-6 group">
      <div className="flex items-start justify-between mb-4">
        <p className="text-[0.8125rem] text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
        <div className="p-2 rounded-lg bg-muted/60 group-hover:bg-primary/10 transition-all duration-300">
          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
        </div>
      </div>
      <p className="text-[2rem] font-bold text-foreground tracking-tight leading-none">{value}</p>
      {change && (
        <p className={`text-[0.8125rem] mt-2.5 font-medium ${changeColor}`}>{change}</p>
      )}
    </div>
  );
}
