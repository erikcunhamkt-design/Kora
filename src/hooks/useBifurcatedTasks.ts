// G53/B3 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md`
// §7) — hook compartilhado pra leitura bifurcada de tarefas, mesmo padrão de
// `useBifurcatedFinance.ts`. Read-only por desenho — consumidores só
// EXIBEM/REFERENCIAM tarefas, nunca criam/editam uma por aqui. Escrita
// nativa em modo Supabase pra Tarefas.tsx é a B5 do plano — não existe
// hoje, fora do escopo desta rodada (B2+B3).
//
// Mesma simplificação de useBifurcatedFinance.ts em relação ao molde
// `useBifurcatedProjects.ts` (que busca RAW e mapeia aqui dentro, porque
// projects tem 2 hooks separados pra leitura raw vs. mapeada): Tarefas só
// tem UM hook Supabase (`useSupabaseTasksAll`, B2) que já devolve `Task[]`
// pronto (mapeamento + resolução de `client` via `clientNameById` já
// embutidos) — não há nada a mapear aqui, só escolher qual das 2 fontes já
// prontas devolver.
import { useTasks } from "@/hooks/useTasks";
import { useSupabaseTasksAll } from "@/hooks/useSupabaseTasksAll";
import { getTasksDataSource } from "@/config/flags";
import type { Task } from "@/hooks/useTasks";

export function useBifurcatedTasks(): Task[] {
  const { tasks: localTasks } = useTasks();
  const { tasks: supabaseTasks } = useSupabaseTasksAll();
  return getTasksDataSource() === "supabase" ? supabaseTasks : localTasks;
}
