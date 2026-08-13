import React from "react";
import { useAccessibility } from "@/contexts/accessibility-context-value";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { formatCurrency as intlCurrency, formatNumber as intlNumber } from "@/lib/format";

interface AdaptiveNumberProps {
  value: number;
  type?: "currency" | "number";
  className?: string;
}

export const AdaptiveNumber: React.FC<AdaptiveNumberProps> = ({
  value,
  type = "currency",
  className,
}) => {
  const { settings } = useAccessibility();

  const formatExact = (val: number): string => {
    if (type === "currency") {
      return intlCurrency(val);
    }
    return intlNumber(val);
  };

  const formatSimplified = (val: number): string => {
    const isNegative = val < 0;
    const absVal = Math.abs(val);

    let formatted = "";
    if (absVal >= 1000000) {
      formatted = `${(absVal / 1000000).toFixed(1).replace(".", ",")}M`;
    } else if (absVal >= 1000) {
      formatted = `${(absVal / 1000).toFixed(0)}k`;
    } else {
      formatted = Math.round(absVal).toString();
    }

    const sign = isNegative ? "-" : "";
    if (type === "currency") {
      return `${sign}R$ ${formatted}`;
    }
    return `${sign}${formatted}`;
  };

  const exactLabel = formatExact(value);
  const simplifiedLabel = formatSimplified(value);

  if (settings.dyscalculia) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`cursor-help border-b border-dashed border-muted-foreground/40 pb-0.5 select-none ${className}`}>
              {simplifiedLabel}
            </span>
          </TooltipTrigger>
          <TooltipContent className="bg-popover border border-border text-foreground px-3 py-1.5 text-xs font-semibold rounded-md shadow-lg">
            <p>Valor exato: {exactLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return <span className={className}>{exactLabel}</span>;
};
