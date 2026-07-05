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
 * Flags booleanas "opt-in" VIVAS: ausência = desligada.
 * Leitura: `getItem(key) === "true"`. Escrita: `setItem(key, "true"|"false")`.
 * (mesma semântica das leituras soltas que este módulo substitui.)
 */
export const BOOLEAN_FLAG_KEYS = {
  technicalSheetsSupabaseAutoSave: "kora.technicalSheets.supabaseAutoSave.enabled",
  technicalSheetsSupabaseExperimental: "kora.technicalSheets.supabaseExperimental.enabled",
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

/**
 * Flags MORTAS: escritas por toggles inline em Configuracoes.tsx, mas SEM
 * leitura de comportamento (superadas por `kora.crm.supabaseWrite.enabled` +
 * `kora.crm.dataSource.v1`).
 *
 * NÃO são removidas nesta etapa — remover o card é mudança de UI visível.
 * Catalogadas aqui para remoção aprovada à parte (etapa futura), cujo PRIMEIRO
 * passo será reconfirmar por grep exaustivo cada chave (não remover por
 * "suspeita"). Este módulo NÃO expõe acesso a elas de propósito.
 */
export const DEAD_FLAG_KEYS = {
  crmSupabaseExperimental: "kora.crm.supabaseExperimental.enabled",
  crmSupabaseStageMove: "kora.crm.supabaseStageMove.enabled",
  crmSupabaseBasicEdit: "kora.crm.supabaseBasicEdit.enabled",
  crmSupabaseCreate: "kora.crm.supabaseCreate.enabled",
  crmSupabaseArchive: "kora.crm.supabaseArchive.enabled",
  crmSupabaseRestoreArchive: "kora.crm.supabaseRestoreArchive.enabled",
} as const;

/**
 * Seletores de fonte de dados. ATENÇÃO: o default de ambos é "supabase" —
 * só o valor literal "local" seleciona a fonte local; qualquer outro valor
 * (ausente, "supabase", malformado) resolve para "supabase".
 */
export const CRM_DATA_SOURCE_KEY = "kora.crm.dataSource.v1";
export const TECHNICAL_SHEETS_DATA_SOURCE_KEY = "kora.technicalSheets.dataSource.v1";

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

// ── seletor de fonte do CRM (string plana; default "supabase") ──────────────

/** Só "local" seleciona local; qualquer outro valor ⇒ "supabase". */
export function getCrmDataSource(): DataSource {
  return safeGet(CRM_DATA_SOURCE_KEY) === "local" ? "local" : "supabase";
}

export function setCrmDataSource(source: DataSource): void {
  safeSet(CRM_DATA_SOURCE_KEY, source);
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
