import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  description?: string;
}

interface SettingsNavProps {
  items: SettingsNavItem[];
  active: string;
  onSelect: (id: string) => void;
}

export function SettingsNav({ items, active, onSelect }: SettingsNavProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col gap-1 sticky top-4">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all text-left",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_16px_hsl(348_94%_52%/0.08)]"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground border border-transparent",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="font-medium truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile horizontal scroller */}
      <nav className="md:hidden -mx-4 px-4 overflow-x-auto scrollbar-none">
        <div className="flex gap-2 pb-2 w-max">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-xs whitespace-nowrap transition-all border",
                  isActive
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "text-muted-foreground hover:text-foreground border-border/60 bg-card",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
