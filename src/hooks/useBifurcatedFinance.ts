// Etapa 5 · Financeiro Fase B (Pacote do Flip, §3 do desenho) — hook
// compartilhado pra leitura bifurcada nos consumidores FORA da tela
// principal (Central do Dia, ficha do cliente, timeline de atividades) —
// mesmo padrão já usado em `Financeiro.tsx`/`ProjectsSection.tsx`, extraído
// pra não repetir o combo (useFinance + useSupabaseFinanceTransactions +
// getFinanceDataSource) em cada consumidor.
//
// Read-only por design — estes consumidores só EXIBEM/REFERENCIAM
// transações, nunca criam/editam uma. Escrita continua exclusiva da tela
// principal (Financeiro.tsx, useSupabaseFinanceTransactions.ts).
//
// Nota de simplificação em relação ao molde `useBifurcatedProjects.ts`
// (citado no desenho, `etapa-5-flip-financeiro-pacote.md` §3): o molde de
// projects busca RAW (`useSupabaseProjectsSummary`) e mapeia aqui dentro,
// porque a leitura de `projects` tem 2 hooks separados (raw vs. mapeado).
// Financeiro só tem UM (`useSupabaseFinanceTransactions`, Fatia N) — já
// devolve `Transaction[]` pronto (mapeamento + resolução de `clientName`
// via `clientNameById` já embutidos), então não há nada a mapear aqui —
// só escolher qual das 2 fontes já prontas devolver.
import { useFinance } from "@/hooks/useFinance";
import { useSupabaseFinanceTransactions } from "@/hooks/useSupabaseFinanceTransactions";
import { getFinanceDataSource } from "@/config/flags";
import type { Transaction } from "@/hooks/useFinance";

export function useBifurcatedFinance(): Transaction[] {
  const { transactions: localTransactions } = useFinance();
  const { transactions: supabaseTransactions } = useSupabaseFinanceTransactions();
  return getFinanceDataSource() === "supabase" ? supabaseTransactions : localTransactions;
}
