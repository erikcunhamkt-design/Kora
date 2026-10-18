// G94 / CT1 — peças comuns dos repositórios do catálogo (categorias, serviços, …).
//
// As tabelas `service_categories`/`services` ainda NÃO existem no schema gerado
// (`types.ts`) e podem nem existir no banco (DDL é do operador — drafts 6.1/6.2 do doc da
// Fase A, não aplicados). Por isso:
//  - o client é acessado SEM tipagem de tabela (cast pro `SupabaseClient` genérico); as linhas
//    são tipadas à mão em cada repositório (mesmo padrão de `SupabaseProject.deliverables`);
//  - **degradação (código defensivo):** "tabela inexistente" vira `CatalogUnavailableError`
//    (mensagem legível, `code: "catalog_unavailable"`) em vez de um erro genérico — os hooks
//    devolvem lista vazia + esse erro, e NENHUMA tela quebra (nada consome ainda).
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AppError, getRealErrorMessage, normalizeSupabaseError } from "@/lib/supabase/errors";

export const catalogDb = supabase as unknown as SupabaseClient;

export const CATALOG_UNAVAILABLE_CODE = "catalog_unavailable";

export class CatalogUnavailableError extends AppError {
  constructor(technicalMessage?: string, original?: unknown) {
    super(
      "O catálogo na nuvem ainda não está disponível neste workspace (a estrutura do banco ainda não foi criada).",
      { code: CATALOG_UNAVAILABLE_CODE, technicalMessage, original },
    );
    this.name = "CatalogUnavailableError";
  }
}

/** 42P01 = undefined_table (Postgres); PGRST205/PGRST200 = tabela/relacionamento ausente no schema cache do PostgREST. */
export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  if (code === "42P01" || code === "PGRST205") return true;
  const message = typeof e.message === "string" ? e.message : "";
  return /could not find the table|relation "[^"]+" does not exist|schema cache/i.test(message);
}

/** Normaliza qualquer erro de repositório do catálogo (tabela ausente ⇒ `CatalogUnavailableError`). */
export function toCatalogError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (isMissingTableError(error)) {
    const raw = (error as { message?: unknown })?.message;
    return new CatalogUnavailableError(typeof raw === "string" ? raw : undefined, error);
  }
  return normalizeSupabaseError(error);
}

export function isCatalogUnavailable(error: unknown): boolean {
  return error instanceof AppError && error.code === CATALOG_UNAVAILABLE_CODE;
}

/**
 * G95 (classe "mensagem genérica sem a causa") no domínio do catálogo. `getRealErrorMessage` devolve a mensagem
 * real de `Error`/`{message}`, mas os repositórios já convertem tudo em `AppError` (`toCatalogError` →
 * `normalizeSupabaseError`): para código desconhecido a `.message` vira "Ocorreu um erro inesperado" e para os
 * conhecidos perde o nome da constraint/policy — justamente o que a homologação precisa ler (ex.: o CHECK
 * `services_billing_type_known_chk`, a RLS, o 42P10 de índice único ausente). A causa técnica fica em
 * `technicalMessage`; aqui ela é anexada. `CatalogUnavailableError` já é específico e legível — não leva apêndice.
 */
export function catalogErrorMessage(error: unknown): string {
  const message = getRealErrorMessage(error);
  if (isCatalogUnavailable(error)) return message;
  if (error instanceof AppError) {
    const technical = error.technicalMessage;
    if (technical && technical !== message && !message.includes(technical)) return `${message} (${technical})`;
  }
  return message;
}
