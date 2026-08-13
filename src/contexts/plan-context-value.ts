import { createContext, useContext } from "react";
import type { PlanLimits } from "@/contexts/PlanContext";

export const PLAN_PRICE = "R$ 49,99";

export interface PlanContextType {
  plan: "free" | "pro";
  limits: PlanLimits;
  isPro: boolean;
  /** Returns true if adding one more would exceed the limit */
  wouldExceed: (resource: keyof PlanLimits, currentCount: number) => boolean;
  /** Show the paywall for a specific resource */
  showPaywall: (resource: string) => void;
  paywallOpen: boolean;
  paywallResource: string;
  closePaywall: () => void;
  usage: { clients: number; projects: number; tasks: number; leads: number };
  setUsage: (key: "clients" | "projects" | "tasks" | "leads", count: number) => void;
}

export const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
