import { MessageCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export function WhatsAppEmptyState({
  icon: Icon = MessageCircle,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center px-6">
      <div className="text-center max-w-sm space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary/80" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          )}
        </div>
        {action}
      </div>
    </div>
  );
}
