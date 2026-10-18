// G95 (classe "mensagem genérica sem a causa") no catálogo — `catalogErrorMessage` junta a mensagem real (G95,
// `getRealErrorMessage`) com a causa técnica que os repositórios guardam em `technicalMessage`. Erros de Postgres reais.
import { describe, it, expect } from "vitest";
import { catalogErrorMessage, toCatalogError, CatalogUnavailableError } from "@/repositories/catalogRepositoryShared";

const CHECK = { code: "23514", message: 'new row for relation "services" violates check constraint "services_billing_type_known_chk"' };
const RLS = { code: "42501", message: 'new row violates row-level security policy for table "services"' };
const NO_INDEX = { code: "42P10", message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" };

describe("catalogErrorMessage", () => {
  it("CHECK (23514): mantém o texto classificado E anexa o NOME da constraint (o que a homologação precisa ler)", () => {
    const msg = catalogErrorMessage(toCatalogError(CHECK));
    expect(msg).toMatch(/^Alguns dados não atendem às regras de validação\./);
    expect(msg).toContain("services_billing_type_known_chk");
  });

  it("RLS (42501): distingue permissão e cita a policy/tabela", () => {
    const msg = catalogErrorMessage(toCatalogError(RLS));
    expect(msg).toMatch(/permissão/i);
    expect(msg).toContain('row-level security policy for table "services"');
  });

  it("código desconhecido (42P10 — índice único do import ausente): NÃO fica no genérico 'Ocorreu um erro inesperado' sozinho", () => {
    const msg = catalogErrorMessage(toCatalogError(NO_INDEX));
    expect(msg).toContain("no unique or exclusion constraint matching the ON CONFLICT");
  });

  it("tabela ausente: a mensagem legível do CatalogUnavailableError, SEM apêndice técnico", () => {
    const err = toCatalogError({ code: "PGRST205", message: "Could not find the table 'public.services' in the schema cache" });
    expect(err).toBeInstanceOf(CatalogUnavailableError);
    const msg = catalogErrorMessage(err);
    expect(msg).toBe(err.message);
    expect(msg).not.toMatch(/PGRST|schema cache/);
  });

  it("Error comum e {message} cru (PostgrestError não é Error): a mensagem real", () => {
    expect(catalogErrorMessage(new Error("Serviço não encontrado."))).toBe("Serviço não encontrado.");
    expect(catalogErrorMessage({ message: "algo específico" })).toBe("algo específico");
  });

  it("sem mensagem nenhuma: nunca vazio", () => {
    expect(catalogErrorMessage(undefined).length).toBeGreaterThan(0);
    expect(catalogErrorMessage({ code: "XX000" }).length).toBeGreaterThan(0);
  });

  it("não duplica quando a causa técnica já está na mensagem", () => {
    const msg = catalogErrorMessage(toCatalogError({ code: "P0001", message: "mensagem do RAISE EXCEPTION" }));
    expect(msg.match(/mensagem do RAISE EXCEPTION/g)).toHaveLength(1);
  });
});
