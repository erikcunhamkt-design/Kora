import { ReactNode } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PageToolbarProps {
  /** Search input value (controlled). */
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Filter controls (selects, popovers, chips). */
  filters?: ReactNode;
  /** Secondary actions on the right (icon buttons, "Show archived", export…). */
  actions?: ReactNode;
  /** View toggle group (kanban/list/grid). Rendered after actions. */
  viewToggle?: ReactNode;
  /** Tabs row (rendered above the main row). */
  tabs?: ReactNode;
  /** Custom slot at the far left, before search. */
  leftContent?: ReactNode;
  /** Custom slot at the far right, after viewToggle. */
  rightContent?: ReactNode;
  /** Free-form extra row below the main bar. */
  children?: ReactNode;
  sticky?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Standard filter/action bar that sits between PageHeader and content.
 * Premium, discreet, responsive.
 */
export function PageToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filters,
  actions,
  viewToggle,
  tabs,
  leftContent,
  rightContent,
  children,
  sticky = false,
  compact = false,
  className,
}: PageToolbarProps) {
  const showSearch = typeof searchValue === "string" || !!onSearchChange;

  return (
    <div
      className={cn(
        "orbit-card border-border/60 bg-card/60 backdrop-blur",
        compact ? "p-2.5" : "p-3 sm:p-3.5",
        sticky && "sticky top-0 z-20",
        "mb-5",
        className,
      )}
    >
      {tabs && (
        <div className="mb-2.5 -mx-1 px-1 overflow-x-auto scrollbar-thin">
          {tabs}
        </div>
      )}

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-3">
        {/* LEFT: leftContent + search */}
        {(leftContent || showSearch) && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {leftContent}
            {showSearch && (
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70 pointer-events-none" />
                <Input
                  value={searchValue ?? ""}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 h-9 bg-muted/40 border-border/60 focus-visible:border-primary/40"
                />
              </div>
            )}
          </div>
        )}

        {/* CENTER/RIGHT: filters */}
        {filters && (
          <div className="flex flex-wrap items-center gap-2 [&_button]:h-9 [&_[role=combobox]]:h-9">
            {filters}
          </div>
        )}

        {/* RIGHT: actions + view toggle + rightContent */}
        {(actions || viewToggle || rightContent) && (
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {actions}
            {viewToggle && (
              <div className="flex items-center border border-border/60 rounded-lg overflow-hidden">
                {viewToggle}
              </div>
            )}
            {rightContent}
          </div>
        )}
      </div>

      {children && <div className="mt-2.5 pt-2.5 border-t border-border/40">{children}</div>}
    </div>
  );
}
