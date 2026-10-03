/**
 * Etapa 5 · Flip Projetos (item 4) — flag mestre de escrita de `projects` na
 * nuvem.
 *
 * Nasceu opt-in (default OFF, Fatia N/item 4) — primeira rodada de escrita
 * do domínio, sem histórico de homologação ainda.
 *
 * Pacote do Flip (Fase C) — default flipado pra opt-out (ausência ou
 * qualquer valor ≠ "false" ⇒ true), mesmo padrão de
 * `kora.crm.supabaseWrite.enabled` (Fatia 8) e
 * `kora.quotes.supabaseWrite.enabled` (Pacote do Flip de quotes). Sessões
 * que já têm o valor gravado explicitamente ("true" ou "false") não são
 * afetadas — só quem nunca tocou na flag herda o novo default. Ver
 * docs/qa/etapa-5-flip-projetos-runbook.md §2.2.
 *
 * Gate do ESPELHO (padrão G22), não do dataSource de leitura — os dois eixos
 * são independentes: `getProjectsDataSource()` (config/flags.ts) decide QUAL
 * fonte a tela lê; esta flag decide SE a escrita local (sempre autoritativa)
 * também tenta espelhar na nuvem, best-effort, sem nunca bloquear nem
 * desfazer o local. Os 4 call sites do espelho (ProjectsSection,
 * ProjectDetailDrawer, QuoteToProjectDialog, CreateProjectFromQuoteDialog —
 * este último desde o G85) usam só o leitor imperativo abaixo.
 *
 * Hook reativo (`useSupabaseProjectsWriteFlag`) REMOVIDO (rodada G85,
 * órfão): nenhum consumidor fora de teste — o rollback nível 1 documentado
 * nos runbooks é um override de `localStorage` direto no console, que o
 * leitor imperativo já lê a cada chamada.
 *
 * Stored in localStorage under `kora.projects.supabaseWrite.enabled`.
 */

export const PROJECTS_SUPABASE_WRITE_FLAG_KEY = "kora.projects.supabaseWrite.enabled";

/** Imperative reader — só o literal "false" desliga (opt-out desde o Pacote do Flip). */
export function isSupabaseProjectsWriteEnabled(): boolean {
  try {
    return localStorage.getItem(PROJECTS_SUPABASE_WRITE_FLAG_KEY) !== "false";
  } catch {
    return true;
  }
}
