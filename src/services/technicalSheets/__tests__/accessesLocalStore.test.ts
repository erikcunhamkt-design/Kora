// F4 / FP2 — acessos só-locais da ficha (login/senha de plataformas). Nunca vão
// pra nuvem (G63); em fonte nuvem vivem aqui, neste dispositivo, chaveados pelo
// id da ficha na rota (uuid real nas fixtures — classe G67/G82).
import { describe, it, expect, beforeEach } from "vitest";
import {
  ACCESSES_LOCAL_STORE_KEY,
  readLocalAccesses,
  writeLocalAccesses,
} from "@/services/technicalSheets/accessesLocalStore";
import type { ClientAccess } from "@/types/domain";

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const OTHER = "11111111-2222-4333-8444-555555555555";

function acc(id: string): ClientAccess {
  return { id, platform: "Instagram", login: "a@b.c", password: "s3nh4", notes: "", createdAt: "", updatedAt: "" } as ClientAccess;
}

beforeEach(() => localStorage.clear());

describe("accessesLocalStore", () => {
  it("sem entrada ⇒ undefined (≠ [] que é 'o usuário esvaziou a lista')", () => {
    expect(readLocalAccesses(UUID)).toBeUndefined();
    writeLocalAccesses(UUID, []);
    expect(readLocalAccesses(UUID)).toEqual([]);
  });

  it("grava e lê por cliente, preservando os demais", () => {
    writeLocalAccesses(UUID, [acc("a1")]);
    writeLocalAccesses(OTHER, [acc("b1"), acc("b2")]);

    expect(readLocalAccesses(UUID)?.map((a) => a.id)).toEqual(["a1"]);
    expect(readLocalAccesses(OTHER)?.map((a) => a.id)).toEqual(["b1", "b2"]);
  });

  it("normaliza a chave: id numérico local e string coincidem", () => {
    writeLocalAccesses(7, [acc("x")]);
    expect(readLocalAccesses("7")?.[0].id).toBe("x");
  });

  it("JSON corrompido ⇒ trata como vazio e não lança", () => {
    localStorage.setItem(ACCESSES_LOCAL_STORE_KEY, "{não é json");
    expect(readLocalAccesses(UUID)).toBeUndefined();
    expect(() => writeLocalAccesses(UUID, [acc("a1")])).not.toThrow();
    expect(readLocalAccesses(UUID)?.[0].id).toBe("a1");
  });

  it("chave vazia/nula ⇒ undefined", () => {
    expect(readLocalAccesses(undefined)).toBeUndefined();
    expect(readLocalAccesses("")).toBeUndefined();
  });
});
