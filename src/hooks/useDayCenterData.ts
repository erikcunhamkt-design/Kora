import { useMemo } from "react";
import { useTasks } from "@/hooks/useTasks";
import { useLeads } from "@/hooks/useLeads";
import { useFinance } from "@/hooks/useFinance";
import { useQuotes } from "@/hooks/useQuotes";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useAllClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { computeDayCenter, type DayCenterResult } from "@/lib/dayCenter";

/**
 * Hook reutilizável que agrega os dados locais e calcula a Central do Dia.
 * Centraliza chamada para evitar duplicação entre GreetingHero, DayCenterSummary etc.
 */
export function useDayCenterData(): DayCenterResult {
  const { tasks } = useTasks();
  const { leads } = useLeads();
  const { transactions } = useFinance();
  const { quotes } = useQuotes();
  const { projects } = useProjects();
  const { clients } = useClients();
  const manualActivities = useAllClientActivityLogs();

  return useMemo(
    () => computeDayCenter({ tasks, leads, quotes, transactions, projects, clients, manualActivities }),
    [tasks, leads, quotes, transactions, projects, clients, manualActivities],
  );
}
