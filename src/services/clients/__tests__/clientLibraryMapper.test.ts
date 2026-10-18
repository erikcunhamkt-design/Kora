// G94 · M1 — mapper da Biblioteca do cliente na nuvem (library_assets).
// Prova: roundtrip lossless (G83), descarte de item inválido (§7),
// distinção undefined (coluna ausente) vs [] (vazia, terminal), limite de
// 200 itens (R8/CHECK do draft 6.8).
import { describe, it, expect } from "vitest";
import {
  mapCloudLibraryAssets, mapLocalLibraryAssetsToCloud, exceedsLibraryLimit, CLIENT_LIBRARY_MAX_ITEMS,
} from "@/services/clients/clientLibraryMapper";
import type { ClientAsset } from "@/types/domain";

function makeAsset(overrides: Partial<ClientAsset> = {}): ClientAsset {
  return {
    id: "87ebd1d2-0000-0000-0000-000000000001", title: "Drive do cliente", type: "drive",
    url: "https://drive.example.com/pasta", accessStatus: "liberado",
    createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("mapCloudLibraryAssets", () => {
  it("coluna ausente da linha (undefined) ⇒ undefined (schema pendente, cai no fallback)", () => {
    expect(mapCloudLibraryAssets(undefined)).toBeUndefined();
  });

  it("coluna existe mas vazia ([]) ⇒ [] — terminal, NÃO é 'ausente'", () => {
    const result = mapCloudLibraryAssets([]);
    expect(result).toEqual([]);
    expect(result).not.toBeUndefined();
  });

  it("roundtrip lossless: array válido vai e volta intacto (G83)", () => {
    const asset = makeAsset({ description: "pasta com briefings", tags: ["branding"] });
    const result = mapCloudLibraryAssets([asset]);
    expect(result).toEqual([asset]);
  });

  it("descarta item sem id/title/url (§7), preserva os válidos", () => {
    const valid = makeAsset();
    const result = mapCloudLibraryAssets([
      valid,
      { title: "sem id", url: "https://x.com" },
      { id: "x2", url: "https://x.com" }, // sem title
      { id: "x3", title: "sem url" },
      null,
      "string solta",
    ]);
    expect(result).toEqual([valid]);
  });

  it("valor corrompido (não-array) ⇒ undefined, mesmo tratamento de ausente", () => {
    expect(mapCloudLibraryAssets("não é array")).toBeUndefined();
    expect(mapCloudLibraryAssets(null)).toBeUndefined();
    expect(mapCloudLibraryAssets(42)).toBeUndefined();
  });
});

describe("mapLocalLibraryAssetsToCloud", () => {
  it("passthrough — JSONB preserva o shape 1:1", () => {
    const assets = [makeAsset(), makeAsset({ id: "87ebd1d2-0000-0000-0000-000000000002" })];
    expect(mapLocalLibraryAssetsToCloud(assets)).toEqual(assets);
  });
});

describe("exceedsLibraryLimit (R8 — CHECK do draft 6.8, ≤ 200 itens)", () => {
  it(`${CLIENT_LIBRARY_MAX_ITEMS} itens (limite exato) NÃO excede`, () => {
    const assets = Array.from({ length: CLIENT_LIBRARY_MAX_ITEMS }, (_, i) => makeAsset({ id: `item-${i}` }));
    expect(exceedsLibraryLimit(assets)).toBe(false);
  });

  it(`${CLIENT_LIBRARY_MAX_ITEMS + 1} itens excede`, () => {
    const assets = Array.from({ length: CLIENT_LIBRARY_MAX_ITEMS + 1 }, (_, i) => makeAsset({ id: `item-${i}` }));
    expect(exceedsLibraryLimit(assets)).toBe(true);
  });
});
