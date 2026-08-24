// ───────────────────────────────────────────────────────────────────────────
// Etapa 4a · Fonte única (tipada) das feature flags locais do Kora.
//
// Centraliza a LEITURA/ESCRITA das flags que antes eram lidas soltas via
// `localStorage.getItem(...) === "true"` espalhadas por páginas, cards de
// configuração e componentes.
//
// CONTRATO DE PRESERVAÇÃO DE COMPORTAMENTO (Etapa 4a):
//   - MESMA chave de localStorage de antes.
//   - MESMO default de antes.
//   - MESMO formato gravado ("true"/"false" para boolean; "local"/"supabase"
//     para o seletor do CRM; JSON por-cliente para o seletor da ficha técnica).
// É adaptação de ACESSO, não de STORAGE. Sessões de usuários com valores já
// salvos continuam sendo lidas exatamente como antes.
//
// FORA deste módulo (flags vivas com helper dedicado próprio e semântica
// especial — NÃO centralizar aqui para não mudar comportamento):
//   - `kora.crm.supabaseWrite.enabled`  → src/hooks/useSupabaseCrmWriteFlag.ts
//       (default OFF; sincroniza entre abas via CustomEvent
//        "kora:crm-supabase-write-flag")
//   - `kora.whatsapp.campaignSender.enabled` → src/lib/whatsapp/featureFlags.ts
//       (opt-OUT: default LIGADO, lido como `!== "false"`)
// ───────────────────────────────────────────────────────────────────────────

export type DataSource = "local" | "supabase";

/**
 * Flags booleanas "opt-in" VIVAS e CONSISTENTES: ausência = desligada.
 * Leitura: `getItem(key) === "true"`. Escrita: `setItem(key, "true"|"false")`.
 * (mesma semântica das leituras soltas que este módulo substitui.)
 *
 * NOTA: as duas flags da FICHA TÉCNICA (supabaseAutoSave, supabaseExperimental)
 * NÃO entram aqui — não são opt-in default-OFF. Ver TECHNICAL_SHEETS_*_KEY
 * mais abaixo.
 */
export const BOOLEAN_FLAG_KEYS = {
  quotesSupabaseExperimental: "kora.quotes.supabaseExperimental.enabled",
  quotesSupabaseCreateProject: "kora.quotes.supabaseCreateProject.enabled",
  quotesSupabaseCreateReceivable: "kora.quotes.supabaseCreateReceivable.enabled",
  quotesSupabaseApproval: "kora.quotes.supabaseApproval.enabled",
  crmSupabaseCreateQuote: "kora.crm.supabaseCreateQuote.enabled",
  projectsSupabaseCreateBaseTasks: "kora.projects.supabaseCreateBaseTasks.enabled",
  tasksSupabaseStatusTransition: "kora.tasks.supabaseStatusTransition.enabled",
  supabaseOperationalDashboard: "kora.supabase.operationalDashboard.enabled",
  // Etapa 9 · item 2 — "Cérebro" do robô. Gateia SÓ a visibilidade da UI de
  // edição em Configurações — a composição no servidor (supabase/functions/
  // _shared/brainComposer.ts, chamada em whatsapp-bot-reply/index.ts) é
  // gateada pela EXISTÊNCIA de um perfil em ai_brain_profiles, não por esta
  // flag (a edge function não lê localStorage). Ver
  // docs/architecture/etapa-9-item2-cerebro-fase-a.md §5.1.
  aiBrainEnabled: "kora.ai.brain.enabled",
} as const;

export type BooleanFlagName = keyof typeof BOOLEAN_FLAG_KEYS;

// Flags MORTAS do CRM (supabaseExperimental / StageMove / BasicEdit / Create /
// Archive / RestoreArchive) foram REMOVIDAS: grep exaustivo confirmou ZERO
// leitura de comportamento (eram superadas por kora.crm.supabaseWrite.enabled +
// kora.crm.dataSource.v1). Os 6 toggle cards saíram de Configuracoes.tsx.
// Valores antigos dessas chaves no localStorage de usuários ficam órfãos
// (ninguém lê) — sem impacto.

/**
 * Flags booleanas da FICHA TÉCNICA — NÃO seguem o padrão opt-in default-OFF
 * do resto do módulo (chaves simples, `=== "true"`), por isso ficam FORA de
 * BOOLEAN_FLAG_KEYS/getBooleanFlag — mas SÃO opt-in (default DESLIGADO)
 * desde o fix do G63, mesmo formato de acesso (`safeGet(...) === "true"`).
 *
 *  - supabaseExperimental / supabaseAutoSave: eram opt-OUT (default LIGADO)
 *    até 16/ago/2026 — G63 (`kora-hub-auditoria-e-plano.md`): com os 2
 *    defaults ligados + `TECHNICAL_SHEETS_DATA_SOURCE_KEY` também
 *    defaultando pra "supabase", qualquer edição de ficha técnica de um
 *    cliente já vinculado ao Supabase autosalvava `accesses[].password`
 *    (senha de plataforma do cliente) num JSONB sem sanitização, sem
 *    confirmação do operador. Fix: as 3 flags deste domínio (as 2 booleanas
 *    aqui + o seletor de fonte abaixo) viram opt-in — domínio volta a
 *    "governado" (nada escreve na nuvem sem ação explícita) até passar por
 *    um protocolo de flip formal, mesmo padrão que todo outro domínio deste
 *    módulo já segue.
 */
export const TECHNICAL_SHEETS_EXPERIMENTAL_KEY = "kora.technicalSheets.supabaseExperimental.enabled";
export const TECHNICAL_SHEETS_AUTOSAVE_KEY = "kora.technicalSheets.supabaseAutoSave.enabled";

/**
 * Seletores de fonte de dados.
 *
 * `CRM_DATA_SOURCE_KEY`: default "supabase" — só "local" explícito
 * seleciona local (inalterado, fora do escopo do G63).
 *
 * `TECHNICAL_SHEETS_DATA_SOURCE_KEY`: default **"local"** desde o fix do
 * G63 (16/ago/2026) — inverso do padrão antigo (que defaultava
 * "supabase", mesmo comportamento perigoso descrito acima). Só "supabase"
 * explícito, por cliente, seleciona a fonte nuvem.
 */
export const CRM_DATA_SOURCE_KEY = "kora.crm.dataSource.v1";
export const TECHNICAL_SHEETS_DATA_SOURCE_KEY = "kora.technicalSheets.dataSource.v1";

/**
 * Etapa 5 · Fatia 9 — seletor de fonte de dados de `quotes`. Nasceu INVERSO
 * do CRM/ficha técnica (default "local", só "supabase" explícito selecionava
 * nuvem) — decisão deliberada da Fatia 9 (§8.3) de não herdar o default às
 * cegas antes de qualquer homologação de escrita existir.
 *
 * Pacote do Flip (Fase C) — default flipado pra "supabase", mesmo formato
 * de `getCrmDataSource()` (só "local" explícito escolhe local). Sessões que
 * já têm o valor gravado (qualquer um dos dois) não são afetadas — só quem
 * nunca tocou no seletor herda o novo default. Ver
 * docs/qa/etapa-5-flip-quotes.md §2.1.
 */
export const QUOTES_DATA_SOURCE_KEY = "kora.quotes.dataSource.v1";

/**
 * Etapa 5 · Fatia N (`projects`) — seletor de fonte de dados de `projects`.
 * Nasceu INVERSO do CRM/ficha técnica (default "local", só "supabase"
 * explícito selecionava nuvem) — mesmo padrão de NASCIMENTO de `quotes`
 * (Fatia 9, antes do Pacote do Flip).
 *
 * Pacote do Flip (Fase C) — default flipado pra "supabase", mesmo formato
 * de `getCrmDataSource()`/`getQuotesDataSource()` pós-flip (só "local"
 * explícito escolhe local). Sessões que já têm o valor gravado (qualquer
 * um dos dois) não são afetadas — só quem nunca tocou no seletor herda o
 * novo default. Ver docs/qa/etapa-5-flip-projetos-runbook.md §2.2.
 */
export const PROJECTS_DATA_SOURCE_KEY = "kora.projects.dataSource.v1";

/**
 * Etapa 5 · Financeiro Fatia N — seletor de fonte de dados de `financial_transactions`.
 * Financeiro era, até esta fatia, o único domínio sem flag de fonte (achado
 * central de `etapa-5-flip-financeiro-fase-a.md` §1.3). Nasceu no MESMO
 * molde de nascimento de `quotes`/`projects` (Fatia N deles, antes do
 * Pacote do Flip): default "local", só "supabase" explícito selecionava
 * nuvem.
 *
 * Pacote do Flip (Fase C) — default flipado pra "supabase", mesmo formato
 * de `getCrmDataSource()`/`getQuotesDataSource()`/`getProjectsDataSource()`
 * pós-flip (só "local" explícito escolhe local). Sessões que já têm o valor
 * gravado (qualquer um dos dois) não são afetadas — só quem nunca tocou no
 * seletor herda o novo default. Ver
 * docs/qa/etapa-5-flip-financeiro-runbook.md §2.2.
 */
export const FINANCE_DATA_SOURCE_KEY = "kora.finance.dataSource.v1";

/**
 * G53/B3 (fundações de Fase B de Tarefas, `etapa-5-flip-tarefas-pacote.md`
 * §7) — seletor de fonte de dados de `tasks`. Nasceu no MESMO molde de
 * nascimento de `quotes`/`projects`/`finance` (Fatia N deles, ANTES do
 * respectivo Pacote do Flip): default "local", só "supabase" explícito
 * selecionava nuvem — P5 do protocolo (nunca herdar o default às cegas
 * antes de qualquer homologação de escrita existir).
 *
 * Fase C do Pacote do Flip de Tarefas (B1-B5 fechados) — default flipado
 * pra "supabase", mesmo formato de `getCrmDataSource()`/`getQuotesDataSource()`/
 * `getProjectsDataSource()`/`getFinanceDataSource()` pós-flip (só "local"
 * explícito escolhe local). Sessões que já têm o valor gravado (qualquer um
 * dos dois) não são afetadas — só quem nunca tocou no seletor herda o novo
 * default.
 */
export const TASKS_DATA_SOURCE_KEY = "kora.tasks.dataSource.v1";

// ── acesso seguro a localStorage (SSR-safe / storage desabilitado) ──────────

function safeGet(key: string): string | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore quota / storage desabilitado */
  }
}

// ── flags booleanas (opt-in, default desligado) ─────────────────────────────

/** Lê uma flag booleana opt-in. Ausente/malformada ⇒ false. */
export function getBooleanFlag(name: BooleanFlagName): boolean {
  return safeGet(BOOLEAN_FLAG_KEYS[name]) === "true";
}

/** Grava uma flag booleana no MESMO formato de antes ("true"/"false"). */
export function setBooleanFlag(name: BooleanFlagName, value: boolean): void {
  safeSet(BOOLEAN_FLAG_KEYS[name], String(value));
}

// ── ficha técnica · modo experimental (opt-in, default DESLIGADO — G63) ─────

/** Só o literal "true" liga (opt-in, mesmo formato de BOOLEAN_FLAG_KEYS). */
export function getTechnicalSheetExperimentalEnabled(): boolean {
  return safeGet(TECHNICAL_SHEETS_EXPERIMENTAL_KEY) === "true";
}

export function setTechnicalSheetExperimentalEnabled(value: boolean): void {
  safeSet(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, String(value));
}

// ── ficha técnica · autosave (opt-in, default DESLIGADO — G63) ──────────────

/** Só o literal "true" liga (opt-in, mesmo formato de BOOLEAN_FLAG_KEYS). */
export function getTechnicalSheetAutoSaveEnabled(): boolean {
  return safeGet(TECHNICAL_SHEETS_AUTOSAVE_KEY) === "true";
}

export function setTechnicalSheetAutoSaveEnabled(value: boolean): void {
  safeSet(TECHNICAL_SHEETS_AUTOSAVE_KEY, String(value));
}

// ── seletor de fonte do CRM (string plana; default "supabase") ──────────────

/** Só "local" seleciona local; qualquer outro valor ⇒ "supabase". */
export function getCrmDataSource(): DataSource {
  return safeGet(CRM_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}

export function setCrmDataSource(source: DataSource): void {
  safeSet(CRM_DATA_SOURCE_KEY, source);
}

// ── seletor de fonte de quotes (string plana; default "supabase" desde o flip) ──

/** Só "local" explícito seleciona local; qualquer outro valor ⇒ "supabase". */
export function getQuotesDataSource(): DataSource {
  return safeGet(QUOTES_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}

export function setQuotesDataSource(source: DataSource): void {
  safeSet(QUOTES_DATA_SOURCE_KEY, source);
}

// ── seletor de fonte de projects (string plana; default "supabase" desde o Pacote do Flip) ──

/** Só "local" explícito seleciona local; qualquer outro valor ⇒ "supabase". */
export function getProjectsDataSource(): DataSource {
  return safeGet(PROJECTS_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}

export function setProjectsDataSource(source: DataSource): void {
  safeSet(PROJECTS_DATA_SOURCE_KEY, source);
}

// ── seletor de fonte de financeiro (string plana; default "supabase" desde o Pacote do Flip) ──

/** Só "local" explícito seleciona local; qualquer outro valor ⇒ "supabase". */
export function getFinanceDataSource(): DataSource {
  return safeGet(FINANCE_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}

export function setFinanceDataSource(source: DataSource): void {
  safeSet(FINANCE_DATA_SOURCE_KEY, source);
}

// ── seletor de fonte de tasks (string plana; default "supabase" desde a Fase C do flip) ──

/** Só "local" explícito seleciona local; qualquer outro valor ⇒ "supabase". */
export function getTasksDataSource(): DataSource {
  return safeGet(TASKS_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}

export function setTasksDataSource(source: DataSource): void {
  safeSet(TASKS_DATA_SOURCE_KEY, source);
}

// ── seletor de fonte da ficha técnica (mapa JSON por cliente; default "supabase") ──

function readTechnicalSheetMap(): Record<string, DataSource> {
  const raw = safeGet(TECHNICAL_SHEETS_DATA_SOURCE_KEY);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, DataSource>;
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * G63 (16/ago/2026): default invertido pra "local" — só "supabase" explícito
 * (para este clientId) seleciona a fonte nuvem; qualquer outro valor
 * (ausente, "local", malformado) ⇒ "local". Antes do fix, o default era
 * "supabase" (ver histórico do arquivo/G63 em kora-hub-auditoria-e-plano.md).
 */
export function getTechnicalSheetDataSource(clientId: string | number): DataSource {
  const map = readTechnicalSheetMap();
  return map[String(clientId)] === "supabase" ? "supabase" : "local";
}

/** Grava a fonte deste cliente, PRESERVANDO as entradas dos demais clientes. */
export function setTechnicalSheetDataSource(clientId: string | number, source: DataSource): void {
  const map = readTechnicalSheetMap();
  map[String(clientId)] = source;
  safeSet(TECHNICAL_SHEETS_DATA_SOURCE_KEY, JSON.stringify(map));
}
