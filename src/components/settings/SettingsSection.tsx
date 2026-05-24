import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({ title, description, actions, children, className }: SettingsSectionProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-foreground tracking-tight">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2 shrink-0">{actions}</div>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
