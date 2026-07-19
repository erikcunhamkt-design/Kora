// Etapa 5 — Install ID: identificador estável por PERFIL DE NAVEGADOR (escopo do
// localStorage), gerado uma única vez e persistido. Usado para NAMESPACAR o
// `source_local_id` do import (idempotência de entidades SEM UNIQUE natural, ex.:
// opportunities). O escopo dos ids locais é o localStorage do navegador — não o usuário —
// então este é o namespace correto para evitar colisão entre navegadores no mesmo
// workspace. Ver docs/architecture/espelho-reversivel.md (variante "fan-in sem UNIQUE").

const INSTALL_ID_KEY = "kora.install.id.v1";

function randomId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* crypto indisponível — cai no fallback */
  }
  // Fallback (contexto sem crypto.randomUUID): baixa colisão o suficiente para o uso.
  return `xinst-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

/** Retorna o install id do navegador, criando-o e persistindo na primeira vez. */
export function getInstallId(): string {
  try {
    if (typeof window === "undefined" || !window.localStorage) return randomId();
    const existing = window.localStorage.getItem(INSTALL_ID_KEY);
    if (existing) return existing;
    const created = randomId();
    window.localStorage.setItem(INSTALL_ID_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

/**
 * Monta a chave de origem do import: `${installId}:${localId}`.
 * É o valor gravado em `source_local_id`; a UNIQUE (workspace_id, source_local_id)
 * usa isto como arbiter do upsert (re-import do mesmo registro → UPDATE, não duplicata).
 */
export function buildSourceLocalId(installId: string, localId: string | number): string {
  return `${installId}:${localId}`;
}
