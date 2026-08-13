import { useMemo } from "react";
import { useTasks } from "@/hooks/useTasks";
import { useLeads } from "@/hooks/useLeads";
import { useFinance } from "@/hooks/useFinance";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useClients } from "@/hooks/useClients";
import { useAllClientActivityLogs } from "@/hooks/useClientActivityLogs";
import { computeDayCenter, type DayCenterResult } from "@/lib/dayCenter";

/**
 * Hook reutilizável que agrega os dados locais e calcula a Central do Dia.
 * Centraliza chamada para evitar duplicação entre GreetingHero, DayCenterSummary etc.
 *
 * Etapa 5 · Pacote do Flip (projects) — Fase B, item 2 (achado (a) da
 * Fase A: Central do Dia precisa migrar junto, senão "projeto atrasado"
 * compara prazo contra dado local desatualizado depois do flip). `projects`
 * agora vem de useBifurcatedProjects() (local OU nuvem mapeada, conforme
 * kora.projects.dataSource.v1) — os outros domínios (tasks/leads/finance/
 * quotes) seguem 100% locais, fora de escopo desta fatia.
 */
export function useDayCenterData(): DayCenterResult {
  const { tasks } = useTasks();
  const { leads } = useLeads();
  const { transactions } = useFinance();
  const { quotes } = useQuotes();
  const projects = useBifurcatedProjects();
  const { clients } = useClients();
  const manualActivities = useAllClientActivityLogs();

  return useMemo(
    () => computeDayCenter({ tasks, leads, quotes, transactions, projects, clients, manualActivities }),
    [tasks, leads, quotes, transactions, projects, clients, manualActivities],
  );
}
