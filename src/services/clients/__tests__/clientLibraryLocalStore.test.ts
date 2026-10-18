// G97 / M0 — Biblioteca do cliente em fonte nuvem: store local chaveado pelo UUID.
// Fixtures com uuid REAL (classe G67/G82).
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CLIENT_LIBRARY_CHANGED_EVENT,
  CLIENT_LIBRARY_LOCAL_STORE_KEY,
  readClientLibrary,
  readClientLibraryStore,
  withLocalLibrary,
  writeClientLibrary,
} from "@/services/clients/clientLibraryLocalStore";
import type { Client, ClientAsset } from "@/types/domain";

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";
const OTHER = "11111111-2222-4333-8444-555555555555";

function asset(id: string, title = id): ClientAsset {
  return {
    id, title, type: "drive", url: `https://example.com/${id}`, accessStatus: "liberado",
    createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  } as ClientAsset;
}

function cloudClient(id: string): Client {
  return { id: id as unknown as number, name: "Cliente Nuvem" } as Client;
}

beforeEach(() => localStorage.clear());

describe("clientLibraryLocalStore", () => {
  it("sem entrada ⇒ undefined (≠ [] = o usuário esvaziou a Biblioteca)", () => {
    expect(readClientLibrary(UUID)).toBeUndefined();
    writeClientLibrary(UUID, []);
    expect(readClientLibrary(UUID)).toEqual([]);
  });

  it("grava e lê por uuid, preservando os demais clientes", () => {
    writeClientLibrary(UUID, [asset("a1")]);
    writeClientLibrary(OTHER, [asset("b1"), asset("b2")]);

    expect(readClientLibrary(UUID)?.map((a) => a.id)).toEqual(["a1"]);
    expect(readClientLibrary(OTHER)?.map((a) => a.id)).toEqual(["b1", "b2"]);
  });

  it("cada escrita dispara o evento que recompõe a lista de clientes", () => {
    const spy = vi.fn();
    window.addEventListener(CLIENT_LIBRARY_CHANGED_EVENT, spy);
    writeClientLibrary(UUID, [asset("a1")]);
    window.removeEventListener(CLIENT_LIBRARY_CHANGED_EVENT, spy);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("JSON corrompido ⇒ trata como vazio e não lança", () => {
    localStorage.setItem(CLIENT_LIBRARY_LOCAL_STORE_KEY, "{não é json");
    expect(readClientLibraryStore()).toEqual({});
    expect(() => writeClientLibrary(UUID, [asset("a1")])).not.toThrow();
    expect(readClientLibrary(UUID)?.[0].id).toBe("a1");
  });
});

describe("withLocalLibrary — composição da Biblioteca de um cliente da nuvem", () => {
  it("item gravado no store (uuid) aparece em client.assets", () => {
    writeClientLibrary(UUID, [asset("a1", "Pasta de referências")]);

    const out = withLocalLibrary(cloudClient(UUID), readClientLibraryStore(), []);

    expect(out.assets?.map((a) => a.title)).toEqual(["Pasta de referências"]);
  });

  it("nada a mesclar ⇒ devolve o MESMO objeto (referência intacta, sem re-render à toa)", () => {
    const c = cloudClient(UUID);
    expect(withLocalLibrary(c, {}, [])).toBe(c);
  });

  it("cliente legado (local id 7 ↔ uuid no mapa) sem entrada no store: usa a Biblioteca da cópia local", () => {
    const legacy = { id: 7, name: "Legado", assets: [asset("old1", "Material antigo")] } as unknown as Client;

    const out = withLocalLibrary(cloudClient(UUID), {}, [legacy], { "7": UUID });

    expect(out.assets?.map((a) => a.title)).toEqual(["Material antigo"]);
  });

  it("o store tem precedência sobre a cópia legada — inclusive quando o usuário esvaziou a lista ([] não 'ressuscita' o legado)", () => {
    const legacy = { id: 7, name: "Legado", assets: [asset("old1")] } as unknown as Client;
    const store = { [UUID]: [] as ClientAsset[] };

    const out = withLocalLibrary(cloudClient(UUID), store, [legacy], { "7": UUID });

    expect(out.assets).toBeUndefined();
  });

  it("legado só vale se o mapa aponta pra ESTE uuid (nunca por id solto)", () => {
    const legacy = { id: 7, name: "Legado", assets: [asset("old1")] } as unknown as Client;

    const out = withLocalLibrary(cloudClient(OTHER), {}, [legacy], { "7": UUID });

    expect(out.assets).toBeUndefined();
  });

  // G94 · M2 — precedência: nuvem (coluna library_assets, quando já lida por
  // mapCloudLibraryAssets) > store M0 > legado. `client.assets` já vem
  // definido (array) quando a coluna existe — withLocalLibrary nunca deve
  // sobrepor isso com store/legado.
  describe("G94/M2 — a nuvem (quando já respondeu) é autoritativa, nunca é sobreposta", () => {
    it("client.assets já preenchido pela nuvem: devolve o MESMO objeto, ignora store com outro conteúdo", () => {
      const c = { ...cloudClient(UUID), assets: [asset("cloud1", "Da nuvem")] };
      const store = { [UUID]: [asset("m0-1", "Do store M0")] };

      const out = withLocalLibrary(c, store, []);

      expect(out).toBe(c);
      expect(out.assets?.map((a) => a.title)).toEqual(["Da nuvem"]);
    });

    it("client.assets = [] (coluna existe, Biblioteca vazia na nuvem) — terminal, NÃO ressuscita o store M0", () => {
      const c = { ...cloudClient(UUID), assets: [] as ClientAsset[] };
      const store = { [UUID]: [asset("m0-1")] };

      const out = withLocalLibrary(c, store, []);

      expect(out.assets).toEqual([]);
    });

    it("client.assets ausente (undefined — coluna ainda não existe): cai pro store M0 normalmente", () => {
      const c = cloudClient(UUID); // sem .assets
      const store = { [UUID]: [asset("m0-1", "Do store M0")] };

      const out = withLocalLibrary(c, store, []);

      expect(out.assets?.map((a) => a.title)).toEqual(["Do store M0"]);
    });
  });
});
