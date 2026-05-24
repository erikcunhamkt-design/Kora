import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "@/lib/password";
import { cn } from "@/lib/utils";

interface Props {
  password: string;
  className?: string;
}

export function PasswordChecklist({ password, className }: Props) {
  return (
    <ul className={cn("space-y-1.5 text-[0.8125rem]", className)}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(password);
        return (
          <li
            key={rule.id}
            className={cn(
              "flex items-center gap-2 transition-colors",
              ok ? "text-success" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full border",
                ok ? "border-success bg-success/10" : "border-border bg-muted/40"
              )}
            >
              {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-50" />}
            </span>
            <span>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
