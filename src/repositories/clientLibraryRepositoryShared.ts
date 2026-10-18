// G94 · M1 — degradação da Biblioteca do cliente na nuvem: a coluna
// `clients.library_assets` ainda não existe (draft 6.8 da Fase A,
// docs/architecture/etapa-5-flip-catalogo-materiais-fase-a.md §6.8,
// aplicação é do operador — §8-b-catálogo).
//
// Mesmo padrão de catalogRepositoryShared.ts (CatalogUnavailableError), mas
// pra uma COLUNA ausente numa tabela (`clients`) que já existe, não uma
// tabela inteira: `SELECT *` nunca erra por coluna ausente (PostgREST só
// omite a chave em silêncio — ver clientLibraryMapper.ts), só o `UPDATE` que
// tenta GRAVAR nela falha de verdade. Por isso esta degradação só entra no
// caminho de ESCRITA (clientsRepository.updateClientLibrary), nunca no de
// leitura.
import { AppError } from "@/lib/supabase/errors";

export const LIBRARY_UNAVAILABLE_CODE = "library_unavailable";

export class LibraryUnavailableError extends AppError {
  constructor(technicalMessage?: string, original?: unknown) {
    super(
      "A Biblioteca de materiais ainda não está disponível na nuvem neste workspace (a coluna ainda não foi criada pelo operador).",
      { code: LIBRARY_UNAVAILABLE_CODE, technicalMessage, original },
    );
    this.name = "LibraryUnavailableError";
  }
}

/**
 * PGRST204 = PostgREST "não achei a coluna no schema cache" (a mensagem real
 * nomeia a coluna: "Could not find the 'library_assets' column of 'clients'
 * in the schema cache"); 42703 = undefined_column (Postgres), caso o erro
 * chegue direto do banco em vez do PostgREST.
 */
export function isMissingLibraryColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: unknown; message?: unknown };
  const code = typeof e.code === "string" ? e.code : "";
  if (code === "42703" || code === "PGRST204") return true;
  const message = typeof e.message === "string" ? e.message : "";
  return /could not find the 'library_assets' column|column "library_assets" does not exist|schema cache/i.test(message);
}

export function isLibraryUnavailable(error: unknown): boolean {
  return error instanceof AppError && error.code === LIBRARY_UNAVAILABLE_CODE;
}
