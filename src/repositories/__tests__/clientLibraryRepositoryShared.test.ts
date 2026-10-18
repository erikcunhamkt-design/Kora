// G94 · M1 — degradação de escrita da Biblioteca do cliente: a coluna
// `clients.library_assets` ainda não existe. Mesmo molde de
// aiKnowledgeConsentsRepository.test.ts (isMissingTableError), adaptado pra
// coluna ausente (não tabela ausente).
import { describe, it, expect } from "vitest";
import {
  isMissingLibraryColumnError, isLibraryUnavailable, LibraryUnavailableError, LIBRARY_UNAVAILABLE_CODE,
} from "@/repositories/clientLibraryRepositoryShared";
import { AppError } from "@/lib/supabase/errors";

describe("isMissingLibraryColumnError", () => {
  it("reconhece PGRST204, 42703 e a mensagem típica do PostgREST", () => {
    expect(isMissingLibraryColumnError({ code: "PGRST204" })).toBe(true);
    expect(isMissingLibraryColumnError({ code: "42703" })).toBe(true);
    expect(isMissingLibraryColumnError({
      message: "Could not find the 'library_assets' column of 'clients' in the schema cache",
    })).toBe(true);
    expect(isMissingLibraryColumnError({ message: 'column "library_assets" does not exist' })).toBe(true);
  });

  it("outros erros e ausência de erro não são 'coluna ausente'", () => {
    expect(isMissingLibraryColumnError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isMissingLibraryColumnError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isMissingLibraryColumnError(null)).toBe(false);
    expect(isMissingLibraryColumnError(undefined)).toBe(false);
  });
});

describe("LibraryUnavailableError / isLibraryUnavailable", () => {
  it("carrega o code library_unavailable e uma mensagem legível", () => {
    const err = new LibraryUnavailableError("raw message", { code: "PGRST204" });
    expect(err.code).toBe(LIBRARY_UNAVAILABLE_CODE);
    expect(err.message).toMatch(/ainda não está disponível na nuvem/);
    expect(err.technicalMessage).toBe("raw message");
  });

  it("isLibraryUnavailable identifica a instância, rejeita outros AppError e erros genéricos", () => {
    expect(isLibraryUnavailable(new LibraryUnavailableError())).toBe(true);
    expect(isLibraryUnavailable(new AppError("outro erro", { code: "other" }))).toBe(false);
    expect(isLibraryUnavailable(new Error("erro genérico"))).toBe(false);
    expect(isLibraryUnavailable(null)).toBe(false);
  });
});
