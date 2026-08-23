// G75 (docs/qa/etapa-5-flip-materiais-pacote.md, R3) — validateMaterialFile
// aceitava PDF/DOCX/XLSX/TXT até 8MB no client-side, mas o bucket
// `client-assets` (supabase/migrations/20260530030000_create_client_assets_storage.sql)
// só permite png/jpeg/webp até 2MB — qualquer material fora disso passava
// na validação da tela e falhava no upload real pro Storage, com o erro
// genérico do Supabase em vez da mensagem amigável que já existe pra isso.
import { describe, it, expect } from "vitest";

import { clientAssetsStorage } from "@/services/storage/clientAssetsStorage";

function makeFile(type: string, sizeBytes: number, name = "arquivo"): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe("clientAssetsStorage.validateMaterialFile — G75, alinhado à policy real do bucket", () => {
  it("rejeita PDF/DOCX/XLSX/TXT — o bucket só aceita png/jpeg/webp", () => {
    const pdf = makeFile("application/pdf", 1024, "contrato.pdf");
    const docx = makeFile(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      1024,
      "briefing.docx",
    );
    const xlsx = makeFile(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      1024,
      "planilha.xlsx",
    );
    const txt = makeFile("text/plain", 1024, "notas.txt");

    for (const file of [pdf, docx, xlsx, txt]) {
      const result = clientAssetsStorage.validateMaterialFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("PNG, JPEG e WebP");
    }
  });

  it("rejeita imagem entre 2MB e 8MB — o bucket só aceita até 2MB", () => {
    const bigImage = makeFile("image/png", 5 * 1024 * 1024, "foto-grande.png");

    const result = clientAssetsStorage.validateMaterialFile(bigImage);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("2MB");
  });

  it("aceita PNG/JPEG/WebP até 2MB — o que o bucket de fato permite hoje", () => {
    const png = makeFile("image/png", 1024 * 1024, "logo.png");
    const jpeg = makeFile("image/jpeg", 1024 * 1024, "foto.jpeg");
    const webp = makeFile("image/webp", 2 * 1024 * 1024, "banner.webp");

    for (const file of [png, jpeg, webp]) {
      expect(clientAssetsStorage.validateMaterialFile(file).valid).toBe(true);
    }
  });
});
