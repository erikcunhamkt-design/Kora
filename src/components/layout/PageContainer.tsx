import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  /** Visual width budget for the page. Defaults to "wide" (1600px). */
  size?: "narrow" | "default" | "wide" | "full";
  className?: string;
}

const sizeMap = {
  narrow: "max-w-[960px]",
  default: "max-w-[1280px]",
  wide: "max-w-[1600px]",
  full: "max-w-none",
} as const;

/**
 * Standard centered container for internal pages.
 * Keeps content from stretching infinitely on ultra-wide displays.
 */
export function PageContainer({ children, size = "wide", className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full", sizeMap[size], className)}>
      {children}
    </div>
  );
}
