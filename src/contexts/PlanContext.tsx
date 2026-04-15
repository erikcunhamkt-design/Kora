import { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface PlanLimits {
  maxClients: number;
  maxProjects: number;
  maxTasks: number;
  maxLeads: number;
}

const FREE_LIMITS: PlanLimits = { maxClients: 1, maxProjects: 1, maxTasks: 3, maxLeads: 1 };
const PRO_LIMITS: PlanLimits = { maxClients: Infinity, maxProjects: Infinity, maxTasks: Infinity, maxLeads: Infinity };

export const PLAN_PRICE = "R$ 49,99";

interface PlanContextType {
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

const PlanContext = createContext<PlanContextType | undefined>(undefined);

export function PlanProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const plan = (profile?.plan === "pro" ? "pro" : "free") as "free" | "pro";
  const isPro = plan === "pro";
  const limits = isPro ? PRO_LIMITS : FREE_LIMITS;

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallResource, setPaywallResource] = useState("");
  const [usage, setUsageState] = useState({ clients: 0, projects: 0, tasks: 0, leads: 0 });

  const wouldExceed = useCallback(
    (resource: keyof PlanLimits, currentCount: number) => {
      if (isPro) return false;
      return currentCount >= limits[resource];
    },
    [isPro, limits]
  );

  const showPaywall = useCallback((resource: string) => {
    setPaywallResource(resource);
    setPaywallOpen(true);
  }, []);

  const closePaywall = useCallback(() => setPaywallOpen(false), []);

  const setUsage = useCallback((key: "clients" | "projects" | "tasks" | "leads", count: number) => {
    setUsageState((prev) => ({ ...prev, [key]: count }));
  }, []);

  return (
    <PlanContext.Provider
      value={{ plan, limits, isPro, wouldExceed, showPaywall, paywallOpen, paywallResource, closePaywall, usage, setUsage }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
