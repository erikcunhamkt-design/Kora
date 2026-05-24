import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

export function SettingsCard({ title, description, children, className, footer }: SettingsCardProps) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card shadow-premium", className)}>
      {(title || description) && (
        <div className="px-5 pt-5 pb-3 border-b border-border/40">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
      )}
      <div className="p-5">{children}</div>
      {footer && <div className="px-5 py-3 border-t border-border/40 bg-muted/20 rounded-b-xl">{footer}</div>}
    </div>
  );
}
