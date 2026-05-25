import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface CriticalAlertProps {
  title: string;
  description: string;
  cta?: string;
  route?: string;
  dismissible?: boolean;
}

export function CriticalAlert({ title, description, cta, route, dismissible = true }: CriticalAlertProps) {
  const [hidden, setHidden] = useState(false);
  const navigate = useNavigate();
  if (hidden) return null;

  return (
    <div
      role="alert"
      className="relative flex items-start gap-3 rounded-xl border border-destructive/30 bg-[hsl(0_70%_8%)] px-4 py-3.5 animate-fade-up"
    >
      <div className="h-8 w-8 shrink-0 rounded-lg bg-destructive/15 flex items-center justify-center">
        <AlertTriangle className="h-4 w-4 text-destructive" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[0.875rem] font-semibold text-foreground leading-tight">{title}</p>
        <p className="text-[0.8125rem] text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
      {cta && route && (
        <button
          onClick={() => navigate(route)}
          className="shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-lg text-[0.8125rem] font-medium text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
        >
          {cta}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
      {dismissible && (
        <button
          onClick={() => setHidden(true)}
          aria-label="Dispensar alerta"
          className="shrink-0 h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
