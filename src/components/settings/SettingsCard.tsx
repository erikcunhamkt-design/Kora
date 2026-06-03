import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
  headerActions?: ReactNode;
}

export function SettingsCard({ title, description, children, className, footer, headerActions }: SettingsCardProps) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card shadow-premium", className)}>
      {(title || description || headerActions) && (
        <div className="px-5 pt-5 pb-3 border-b border-border/40 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
          </div>
          {headerActions && <div className="shrink-0">{headerActions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-border/40 bg-muted/20 rounded-b-xl">{footer}</div>}
    </div>
  );
}
