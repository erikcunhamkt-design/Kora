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
} as const;

export type BooleanFlagName = keyof typeof BOOLEAN_FLAG_KEYS;

// Flags MORTAS do CRM (supabaseExperimental / StageMove / BasicEdit / Create /
// Archive / RestoreArchive) foram REMOVIDAS: grep exaustivo confirmou ZERO
// leitura de comportamento (eram superadas por kora.crm.supabaseWrite.enabled +
// kora.crm.dataSource.v1). Os 6 toggle cards saíram de Configuracoes.tsx.
// Valores antigos dessas chaves no localStorage de usuários ficam órfãos
// (ninguém lê) — sem impacto.

/**
 * Flags booleanas da FICHA TÉCNICA — NÃO seguem o padrão opt-in default-OFF,
 * por isso ficam FORA de BOOLEAN_FLAG_KEYS/getBooleanFlag:
 *
 *  - supabaseExperimental: opt-OUT (default LIGADO). Card (Configuracoes,
 *    `=== "false" ? false : true`) e consumidor (ClientTechnicalSheet,
 *    `!== "false"`) são CONSISTENTES. Centralizada abaixo com acessor opt-out.
 *
 *  - supabaseAutoSave: era INCONSISTENTE (card lia `=== "true"` / default OFF;
 *    consumidor lia `!== "false"` / default ON). Resolvido: unificado em opt-OUT
 *    (default LIGADO), alinhando o card ao consumidor — o autosave já ligava por
 *    padrão, agora o card reflete isso. Acessor opt-out abaixo.
 */
export const TECHNICAL_SHEETS_EXPERIMENTAL_KEY = "kora.technicalSheets.supabaseExperimental.enabled";
export const TECHNICAL_SHEETS_AUTOSAVE_KEY = "kora.technicalSheets.supabaseAutoSave.enabled";

/**
 * Seletores de fonte de dados. ATENÇÃO: o default de ambos é "supabase" —
 * só o valor literal "local" seleciona a fonte local; qualquer outro valor
 * (ausente, "supabase", malformado) resolve para "supabase".
 */
export const CRM_DATA_SOURCE_KEY = "kora.crm.dataSource.v1";
export const TECHNICAL_SHEETS_DATA_SOURCE_KEY = "kora.technicalSheets.dataSource.v1";

/**
 * Etapa 5 · Fatia 9 — seletor de fonte de dados de `quotes`. INVERSO dos dois
 * acima de propósito: default é "local", não "supabase" — só o valor literal
 * "supabase" seleciona nuvem; qualquer outro valor (ausente, "local",
 * malformado) resolve para "local". Justificativa (docs/qa/etapa-5-fatia-9-
 * quotes-cutover.md §8.3): quotes está começando do zero (sem seletor
 * nenhum antes desta fatia) — o default de CRM/ficha técnica já vinha de
 * decisões de rodadas anteriores a esta cadeia de fatias, não é algo a
 * herdar às cegas. O flip do default pra "supabase" fica pra decisão
 * pós-homologação, com "vai" próprio.
 */
export const QUOTES_DATA_SOURCE_KEY = "kora.quotes.dataSource.v1";

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

// ── ficha técnica · modo experimental (opt-OUT, default LIGADO) ─────────────

/** Ausência ou qualquer valor ≠ "false" ⇒ true (ligado por padrão). */
export function getTechnicalSheetExperimentalEnabled(): boolean {
  return safeGet(TECHNICAL_SHEETS_EXPERIMENTAL_KEY) !== "false";
}

export function setTechnicalSheetExperimentalEnabled(value: boolean): void {
  safeSet(TECHNICAL_SHEETS_EXPERIMENTAL_KEY, String(value));
}

// ── ficha técnica · autosave (opt-OUT, default LIGADO) ──────────────────────

/** Ausência ou qualquer valor ≠ "false" ⇒ true (ligado por padrão). */
export function getTechnicalSheetAutoSaveEnabled(): boolean {
  return safeGet(TECHNICAL_SHEETS_AUTOSAVE_KEY) !== "false";
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

// ── seletor de fonte de quotes (string plana; default "local", inverso do CRM) ──

/** Só "supabase" seleciona nuvem; qualquer outro valor ⇒ "local". */
export function getQuotesDataSource(): DataSource {
  return safeGet(QUOTES_DATA_SOURCE_KEY) === "supabase" ? "supabase" : "local";
}

export function setQuotesDataSource(source: DataSource): void {
  safeSet(QUOTES_DATA_SOURCE_KEY, source);
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

/** Só "local" (para este clientId) seleciona local; qualquer outro ⇒ "supabase". */
export function getTechnicalSheetDataSource(clientId: string | number): DataSource {
  const map = readTechnicalSheetMap();
  return map[String(clientId)] === "local" ? "local" : "supabase";
}

/** Grava a fonte deste cliente, PRESERVANDO as entradas dos demais clientes. */
export function setTechnicalSheetDataSource(clientId: string | number, source: DataSource): void {
  const map = readTechnicalSheetMap();
  map[String(clientId)] = source;
  safeSet(TECHNICAL_SHEETS_DATA_SOURCE_KEY, JSON.stringify(map));
}
