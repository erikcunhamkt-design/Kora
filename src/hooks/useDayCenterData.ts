import { useMemo } from "react";
import { useBifurcatedTasks } from "@/hooks/useBifurcatedTasks";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useBifurcatedProjects } from "@/hooks/useBifurcatedProjects";
import { useBifurcatedFinance } from "@/hooks/useBifurcatedFinance";
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
 * vem de useBifurcatedProjects() (local OU nuvem mapeada, conforme
 * kora.projects.dataSource.v1).
 *
 * Etapa 5 · Financeiro Fase B (Pacote do Flip, §3.1 do desenho) — mesmo
 * tratamento pro 2º domínio: `transactions` agora vem de
 * useBifurcatedFinance() (local OU nuvem, conforme kora.finance.dataSource.v1)
 * — leitura só; a escrita (updateTransactionStatus, via DayCenter.tsx/
 * useDayCenterActions.ts) segue local-only por decisão do desenho (mesma
 * classe (b) que Projetos já tratou pro onboarding — "concluir transação"
 * pela Central do Dia não é a rota crítica desta fase).
 *
 * Etapa 5 · Tarefas Fase B (Pacote do Flip, §7 B4 — correção de comentário
 * G29, 22/ago/2026): `tasks` agora vem de useBifurcatedTasks() (local OU
 * nuvem, conforme kora.tasks.dataSource.v1) — mesma leitura-só/escrita-local
 * do padrão acima (`completeTask`, em DayCenter.tsx/useDayCenterActions.ts,
 * segue gravando via o mutator local de useTasks(), com guarda contra
 * no-op silencioso quando a tarefa exibida vier da nuvem). leads/quotes
 * seguem 100% locais, fora de escopo desta fase.
 */
export function useDayCenterData(): DayCenterResult {
  const tasks = useBifurcatedTasks();
  const { leads } = useLeads();
  const transactions = useBifurcatedFinance();
  const { quotes } = useQuotes();
  const projects = useBifurcatedProjects();
  const { clients } = useClients();
  const manualActivities = useAllClientActivityLogs();

  return useMemo(
    () => computeDayCenter({ tasks, leads, quotes, transactions, projects, clients, manualActivities }),
    [tasks, leads, quotes, transactions, projects, clients, manualActivities],
  );
}
