import React from "react";
import { useAccessibility } from "@/contexts/AccessibilityContext";

interface AdaptiveTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  expressive: string;
  literal: string;
  calm?: string;
  as?: React.ElementType;
}

export const AdaptiveText: React.FC<AdaptiveTextProps> = ({
  expressive,
  literal,
  calm,
  as: Component = "span",
  className,
  ...props
}) => {
  const { settings } = useAccessibility();

  const isAnxiousMode = settings.anxiety || (settings.bipolar && settings.bipolarEnergyLevel === "low");

  let displayText = expressive;
  if (settings.autism) {
    displayText = literal;
  } else if (isAnxiousMode && calm) {
    displayText = calm;
  }

  return (
    <Component className={className} {...props}>
      {displayText}
    </Component>
  );
};
