// Etapa 5 · Fatia 2 (A3) — install id + chave de origem do import.
// Prova: a chave `${installId}:${localId}` é estável para o mesmo par (→ upsert idempotente)
// e distinta entre installIds (→ sem colisão de id local entre navegadores no mesmo workspace).
import { describe, it, expect, beforeEach } from "vitest";

import { getInstallId, buildSourceLocalId } from "@/lib/installId";

const INSTALL_ID_KEY = "kora.install.id.v1";

beforeEach(() => {
  localStorage.clear();
});

describe("getInstallId", () => {
  it("gera e persiste um id estável por perfil de navegador", () => {
    const a = getInstallId();
    const b = getInstallId();
    expect(a).toBeTruthy();
    expect(a).toBe(b); // estável entre chamadas
    expect(localStorage.getItem(INSTALL_ID_KEY)).toBe(a); // persistido
  });

  it("reusa o id já persistido (não regenera)", () => {
    localStorage.setItem(INSTALL_ID_KEY, "fixed-install-123");
    expect(getInstallId()).toBe("fixed-install-123");
  });
});

describe("buildSourceLocalId", () => {
  it("mesmo installId + localId → mesma chave (arbiter idempotente do upsert)", () => {
    expect(buildSourceLocalId("inst-1", 905000001)).toBe("inst-1:905000001");
    // number e string do mesmo id produzem a mesma chave
    expect(buildSourceLocalId("inst-1", 905000001)).toBe(buildSourceLocalId("inst-1", "905000001"));
  });

  it("installIds diferentes → chaves diferentes (sem colisão entre navegadores)", () => {
    expect(buildSourceLocalId("inst-A", 3)).not.toBe(buildSourceLocalId("inst-B", 3));
  });
});
