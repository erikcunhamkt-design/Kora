// G82 — resolução cliente→uuid da ficha. Fixtures com uuid REAL (não id
// numérico): a classe G67 (Number(uuid)=NaN / chave de mapa local que não
// casa com uuid) só é pega se o id de teste for um uuid de verdade.
import { describe, it, expect, beforeEach } from "vitest";
import {
  resolveSheetSupabaseClientId,
  findLocalClientForSheet,
  readClientsImportMap,
} from "@/services/technicalSheets/resolveSheetClientId";
import type { Client } from "@/types/domain";

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const OTHER_UUID = "11111111-2222-4333-8444-555555555555";

function client(id: number): Client {
  return { id, name: `c${id}` } as Client;
}

beforeEach(() => localStorage.clear());

describe("resolveSheetSupabaseClientId", () => {
  it("uuid direto passa direto, mesmo com mapa vazio (cliente só-nuvem)", () => {
    expect(resolveSheetSupabaseClientId(UUID, {})).toBe(UUID);
  });

  it("id numérico local mapeado → uuid do mapa; não mapeado → null (nunca o id local cru)", () => {
    expect(resolveSheetSupabaseClientId(7, { "7": UUID })).toBe(UUID);
    expect(resolveSheetSupabaseClientId("7", { "7": UUID })).toBe(UUID);
    expect(resolveSheetSupabaseClientId(8, { "7": UUID })).toBeNull();
  });

  it("vazio/undefined/null → null", () => {
    expect(resolveSheetSupabaseClientId(undefined, {})).toBeNull();
    expect(resolveSheetSupabaseClientId(null, {})).toBeNull();
    expect(resolveSheetSupabaseClientId("", {})).toBeNull();
  });

  it("lê o mapa de kora.clients.supabaseImport.v1 por padrão e tolera JSON corrompido", () => {
    localStorage.setItem("kora.clients.supabaseImport.v1", JSON.stringify({ importedMap: { "3": UUID } }));
    expect(resolveSheetSupabaseClientId(3)).toBe(UUID);
    localStorage.setItem("kora.clients.supabaseImport.v1", "{não é json");
    expect(readClientsImportMap()).toEqual({});
    expect(resolveSheetSupabaseClientId(3)).toBeNull();
    expect(resolveSheetSupabaseClientId(UUID)).toBe(UUID);
  });
});

describe("findLocalClientForSheet", () => {
  it("id igual (modo local) acha o cliente local", () => {
    expect(findLocalClientForSheet([client(1), client(2)], 2, {})?.id).toBe(2);
  });

  it("uuid de cliente legado importado acha o cliente local pelo mapa local→uuid", () => {
    expect(findLocalClientForSheet([client(1), client(7)], UUID, { "7": UUID })?.id).toBe(7);
  });

  it("uuid de cliente só-nuvem (sem entrada no mapa, sem id igual) ⇒ undefined", () => {
    expect(findLocalClientForSheet([client(1), client(7)], OTHER_UUID, { "7": UUID })).toBeUndefined();
    expect(findLocalClientForSheet([], UUID, {})).toBeUndefined();
  });
});
