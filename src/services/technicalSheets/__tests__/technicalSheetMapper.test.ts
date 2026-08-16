// Etapa 5 · Ficha técnica — fidelidade do mapeamento local <-> Supabase.
// É AQUI que uma perda silenciosa de dado se esconderia na migração: se um campo não
// sobrevive à ida-e-volta, a ficha "some" ao migrar. Cobre os 6 blobs JSON, os assets e
// a sanitização de binário (data:/blob: não sobem — regra desta fase).
//
// Ver docs/architecture/espelho-reversivel.md e docs/qa/etapa-5-ficha-tecnica.md.
import { describe, it, expect } from "vitest";

import { mapLocalToSupabaseSheet } from "@/services/technicalSheets/technicalSheetMapper";
import { mapSupabaseToLocalSheet } from "@/services/technicalSheets/supabaseTechnicalSheetToLocalMapper";

const BINARY_PLACEHOLDER = "[Conteúdo binário não enviado nesta etapa]";

// Ficha local "cheia" com um asset de link (não-binário).
function fullLocalSheet() {
  return {
    branding: { logoUrl: "https://cdn.x/logo.png", colors: ["#0af", "#fff"], slogan: "Sempre adiante" },
    persona: { name: "Ana", ageRange: "25-34", pains: "tempo", desires: "escala" },
    editorialLine: { pillars: "educar, inspirar", tone: "próximo" },
    typography: { primaryFont: "Inter", secondaryFont: "Lora" },
    socialLinks: { instagram: "@marca", linkedin: "marca" },
    briefing: { objectives: "crescer", targetAudience: "PMEs" },
    assets: [
      {
        id: "a1",
        title: "Guia de marca",
        type: "outro",
        url: "https://x/guia.pdf",
        accessStatus: "privado",
        kind: "link",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
  };
}

describe("mapLocalToSupabaseSheet — mapeamento de nomes de campo", () => {
  it("renomeia editorialLine->editorial e socialLinks->social_links e preserva os demais blobs", () => {
    const local = fullLocalSheet();
    const out = mapLocalToSupabaseSheet(local);

    expect(out.branding).toEqual(local.branding);
    expect(out.persona).toEqual(local.persona);
    expect(out.editorial).toEqual(local.editorialLine);
    expect(out.typography).toEqual(local.typography);
    expect(out.social_links).toEqual(local.socialLinks);
    expect(out.briefing).toEqual(local.briefing);
  });

  it("resume o asset de link em materials e guarda a ficha inteira em raw_payload", () => {
    const out = mapLocalToSupabaseSheet(fullLocalSheet());

    expect(out.materials).toHaveLength(1);
    expect(out.materials?.[0]).toMatchObject({
      title: "Guia de marca",
      url: "https://x/guia.pdf",
      type: "outro",
    });

    const raw = out.raw_payload as { assets?: Array<{ url?: string }> };
    expect(raw.assets).toHaveLength(1);
    expect(raw.assets?.[0]?.url).toBe("https://x/guia.pdf");
  });

  it("estrutura vazia para entrada nula (sem quebrar)", () => {
    const out = mapLocalToSupabaseSheet(null);
    expect(out).toEqual({
      branding: {},
      persona: {},
      editorial: {},
      typography: {},
      social_links: {},
      briefing: {},
      materials: [],
      raw_payload: {},
    });
  });
});

describe("mapLocalToSupabaseSheet — sanitização de binário (data:/blob: não sobem)", () => {
  it("exclui asset binário de materials e substitui a URL binária no raw_payload", () => {
    const local = {
      branding: { logoUrl: "data:image/png;base64,AAAA" },
      assets: [{ id: "b1", title: "Logo", type: "outro", url: "data:image/png;base64,BBBB", kind: "file" }],
    };

    const out = mapLocalToSupabaseSheet(local);

    // materials só aceita links reais -> asset binário fica de fora.
    expect(out.materials).toHaveLength(0);

    const raw = out.raw_payload as {
      assets?: Array<{ url?: string }>;
      branding?: { logoUrl?: string };
    };
    expect(raw.assets?.[0]?.url).toBe(BINARY_PLACEHOLDER);
    expect(raw.branding?.logoUrl).toBe(BINARY_PLACEHOLDER);
  });
});

// G63 — raw_payload era um clone bruto do objeto local inteiro, sem excluir
// accesses[] (ClientAccess.password, senha de plataforma do cliente, texto
// puro). mapSupabaseToLocalSheet nunca lê accesses de volta (confirmado
// abaixo) — excluir o campo inteiro do payload de escrita é perda funcional
// zero, não uma redação parcial que ainda deixaria login/plataforma expostos.
describe("mapLocalToSupabaseSheet — G63 (accesses nunca chega em raw_payload)", () => {
  it("accesses[] com password NÃO aparece em raw_payload — nem o array, nem o campo password isolado", () => {
    const local = {
      ...fullLocalSheet(),
      accesses: [
        { id: "ac1", platform: "Instagram", login: "cliente@x.com", password: "SENHA-SUPER-SECRETA-123", notes: "" },
      ],
    };

    const out = mapLocalToSupabaseSheet(local);

    const raw = out.raw_payload as Record<string, unknown>;
    expect(raw).not.toHaveProperty("accesses");
    expect(JSON.stringify(raw)).not.toContain("SENHA-SUPER-SECRETA-123");
  });

  it("sem accesses no local: raw_payload continua correto (guarda de regressão, não quebra por ausência)", () => {
    const out = mapLocalToSupabaseSheet(fullLocalSheet());
    const raw = out.raw_payload as Record<string, unknown>;
    expect(raw).not.toHaveProperty("accesses");
  });

  it("competitors[] (sem dado sensível conhecido) continua passando por raw_payload — só accesses foi excluído", () => {
    const local = {
      ...fullLocalSheet(),
      competitors: [{ id: "c1", name: "Concorrente X", url: "https://x.com" }],
    };
    const out = mapLocalToSupabaseSheet(local);
    const raw = out.raw_payload as Record<string, unknown>;
    expect(raw).toHaveProperty("competitors");
  });
});

describe("mapSupabaseToLocalSheet — G63 (leitura nunca reconstrói accesses, confirma perda funcional zero)", () => {
  it("raw_payload.accesses presente (linha legada pré-fix) não é lido de volta — mapSupabaseToLocalSheet nunca produz .accesses", () => {
    const back = mapSupabaseToLocalSheet({
      branding: {},
      raw_payload: {
        assets: [],
        // Simula uma linha gravada ANTES do fix (accesses ainda em raw_payload).
        accesses: [{ id: "ac1", platform: "Instagram", password: "senha-legada" }],
      },
    });
    expect(back).not.toHaveProperty("accesses");
  });
});

describe("mapSupabaseToLocalSheet — volta ao formato local + defesa contra binário", () => {
  it("renomeia editorial->editorialLine e social_links->socialLinks", () => {
    const back = mapSupabaseToLocalSheet({
      branding: { slogan: "X" },
      persona: { name: "Ana" },
      editorial: { pillars: "educar" },
      typography: { primaryFont: "Inter" },
      social_links: { instagram: "@marca" },
      briefing: { objectives: "crescer" },
      raw_payload: { assets: [] },
    });

    expect(back.editorialLine).toEqual({ pillars: "educar" });
    expect(back.socialLinks).toEqual({ instagram: "@marca" });
    expect(back.branding).toEqual({ slogan: "X" });
    expect(back.persona).toEqual({ name: "Ana" });
    expect(back.typography).toEqual({ primaryFont: "Inter" });
    expect(back.briefing).toEqual({ objectives: "crescer" });
  });

  it("zera logoUrl binária e filtra assets binários vindos do remoto", () => {
    const back = mapSupabaseToLocalSheet({
      branding: { logoUrl: "data:image/png;base64,AAAA", slogan: "X" },
      raw_payload: {
        assets: [
          { id: "b1", title: "Blob", url: "blob:xyz" },
          { id: "ok", title: "Link ok", url: "https://ok/f.pdf" },
        ],
      },
    });

    expect(back.branding?.logoUrl).toBe("");
    expect(back.assets).toHaveLength(1);
    expect(back.assets?.[0]?.url).toBe("https://ok/f.pdf");
  });

  it("objeto vazio para entrada nula", () => {
    expect(mapSupabaseToLocalSheet(null)).toEqual({});
  });
});

describe("round-trip local -> supabase -> local (os campos que a migração precisa preservar)", () => {
  it("preserva os 6 blobs e o asset de link ida-e-volta", () => {
    const local = fullLocalSheet();

    const supa = mapLocalToSupabaseSheet(local);
    const back = mapSupabaseToLocalSheet(supa);

    expect(back.branding).toEqual(local.branding);
    expect(back.persona).toEqual(local.persona);
    expect(back.editorialLine).toEqual(local.editorialLine);
    expect(back.typography).toEqual(local.typography);
    expect(back.socialLinks).toEqual(local.socialLinks);
    expect(back.briefing).toEqual(local.briefing);

    expect(back.assets).toHaveLength(1);
    expect(back.assets?.[0]).toMatchObject({
      id: "a1",
      title: "Guia de marca",
      type: "outro",
      url: "https://x/guia.pdf",
      accessStatus: "privado",
      kind: "link",
    });
  });
});
