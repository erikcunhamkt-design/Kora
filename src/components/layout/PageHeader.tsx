import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface PageHeaderAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  disabled?: boolean;
}

export interface PageHeaderBadge {
  label: string;
  variant?: "default" | "secondary" | "outline" | "success" | "warning" | "destructive";
}

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  /** Short helper text below the title. Alias: `subtitle`. */
  description?: string;
  subtitle?: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  /** Optional contextual badge to the right of the title. */
  badge?: PageHeaderBadge;
  /** Primary call-to-action (right side on desktop). */
  primaryAction?: PageHeaderAction;
  /** Secondary action (outline button). */
  secondaryAction?: PageHeaderAction;
  /** Optional breadcrumbs above the eyebrow. */
  breadcrumbs?: PageHeaderBreadcrumb[];
  /** Free-form actions slot (back-compat with existing pages). */
  actions?: ReactNode;
  /** Filters or tabs row below the header. */
  children?: ReactNode;
  className?: string;
}

function renderAction(action: PageHeaderAction, variant: "default" | "outline") {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" />}
      {action.label}
    </>
  );
  if (action.href) {
    return (
      <Button asChild variant={variant} size="sm" disabled={action.disabled} className="gap-1.5">
        <a href={action.href}>{content}</a>
      </Button>
    );
  }
  return (
    <Button
      variant={variant}
      size="sm"
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(
        "gap-1.5",
        variant === "default" && "orbit-gradient text-white border-0",
      )}
    >
      {content}
    </Button>
  );
}

export function PageHeader({
  title,
  description,
  subtitle,
  eyebrow,
  badge,
  primaryAction,
  secondaryAction,
  breadcrumbs,
  actions,
  children,
  className,
}: PageHeaderProps) {
  const helper = description ?? subtitle;

  return (
    <header className={cn("mb-7 sm:mb-8", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="mb-3">
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <BreadcrumbItem key={`${crumb.label}-${i}`}>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                  ) : (
                    <>
                      <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      <BreadcrumbSeparator />
                    </>
                  )}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground/70 font-semibold mb-2">
              {eyebrow}
            </p>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[1.75rem] sm:text-[2rem] font-bold text-foreground tracking-tight leading-[1.1]">
              {title}
            </h1>
            {badge && (
              <Badge variant={badge.variant ?? "default"} className="uppercase">
                {badge.label}
              </Badge>
            )}
          </div>
          {helper && (
            <p className="text-[0.9375rem] text-muted-foreground mt-2 max-w-2xl leading-relaxed">
              {helper}
            </p>
          )}
        </div>

        {(primaryAction || secondaryAction || actions) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
            {secondaryAction && renderAction(secondaryAction, "outline")}
            {primaryAction && renderAction(primaryAction, "default")}
          </div>
        )}
      </div>

      {children && <div className="mt-5">{children}</div>}
    </header>
  );
}
