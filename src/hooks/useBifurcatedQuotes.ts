// G92/B4 (kora-hub-auditoria-e-plano.md, varredura de consumidores fora dos
// módulos principais que ainda liam a fonte LOCAL de um domínio já flipado)
// — hook compartilhado pra leitura bifurcada de orçamentos nos consumidores
// FORA da tela principal (Central do Dia, checklist de onboarding) — mesmo
// padrão de useBifurcatedFinance.ts/useBifurcatedTasks.ts: useSupabaseQuotes()
// já devolve `Quote[]` pronto (mapeado via fetchQuotesWithItems/
// mapSupabaseQuoteToLocalQuote, items inclusos) — nada a mapear aqui, só
// escolher qual das 2 fontes já prontas devolver.
//
// Read-only por design — estes consumidores só EXIBEM/REFERENCIAM orçamentos,
// nunca criam/editam um. Escrita continua exclusiva da tela principal
// (QuotesSection.tsx, useSupabaseQuotes.ts).
import { useQuotes } from "@/hooks/useQuotes";
import { useSupabaseQuotes } from "@/hooks/useSupabaseQuotes";
import { getQuotesDataSource } from "@/config/flags";
import type { Quote } from "@/hooks/useQuotes";

export function useBifurcatedQuotes(): Quote[] {
  const { quotes: localQuotes } = useQuotes();
  const { quotes: supabaseQuotes } = useSupabaseQuotes();
  return getQuotesDataSource() === "supabase" ? supabaseQuotes : localQuotes;
}
