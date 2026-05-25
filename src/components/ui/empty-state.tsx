import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "ghost";
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "orbit-card flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-10" : "px-8 py-16",
        className,
      )}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" aria-hidden />
        <div className="relative h-14 w-14 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 text-[0.875rem] text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {primaryAction && (
            <Button
              size="sm"
              variant={primaryAction.variant ?? "default"}
              onClick={primaryAction.onClick}
              {...(primaryAction.href ? { asChild: true } : {})}
            >
              {primaryAction.href ? <a href={primaryAction.href}>{primaryAction.label}</a> : primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              size="sm"
              variant={secondaryAction.variant ?? "ghost"}
              onClick={secondaryAction.onClick}
              {...(secondaryAction.href ? { asChild: true } : {})}
            >
              {secondaryAction.href ? <a href={secondaryAction.href}>{secondaryAction.label}</a> : secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
