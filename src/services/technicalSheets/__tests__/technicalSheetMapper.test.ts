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
  it("[G83] binário local NÃO é gravado: asset fora de materials E de raw_payload, campo binário fora de branding (coluna e raw) — sem texto de placeholder", () => {
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
    // antes: o asset ia pro raw_payload com url = placeholder e voltava como material fantasma
    expect(raw.assets).toEqual([]);
    expect(JSON.stringify(out)).not.toContain(BINARY_PLACEHOLDER);
    expect(JSON.stringify(out)).not.toContain("data:image");
    expect(out.branding).not.toHaveProperty("logoUrl");
    expect(raw.branding).not.toHaveProperty("logoUrl");
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

// ─────────────────────────────────────────────────────────────────────────────
// G83 — round-trip: TUDO que a escrita grava tem que voltar na leitura (classe
// G37 nos dois sentidos). Ida-e-volta por campo, simulando a linha que o banco
// devolve (payload gravado + id/timestamps), com id de cliente uuid real.
// `accesses` é a ÚNICA exceção, por decisão permanente (G63 / FP2 pendente).
// ─────────────────────────────────────────────────────────────────────────────
import {
  describeUnsyncedBinary,
  unsyncedBinaryMessage,
  SheetTooLargeError,
  SHEET_RAW_PAYLOAD_MAX_BYTES,
} from "@/services/technicalSheets/technicalSheetMapper";

const UUID = "87ebd1d2-b17a-46f4-b0eb-70beac445221";

// O que o banco devolveria depois do upsert do payload.
function asDbRow(payload: ReturnType<typeof mapLocalToSupabaseSheet>, extra: Record<string, unknown> = {}) {
  return { id: "sheet-1", workspace_id: "ws1", client_id: UUID, created_at: "", updated_at: "", ...payload, ...extra };
}

function roundtrip(local: unknown) {
  return mapSupabaseToLocalSheet(asDbRow(mapLocalToSupabaseSheet(local)));
}

describe("G83 — round-trip por campo (escrita → leitura devolve o mesmo)", () => {
  it("os 6 blobs voltam idênticos", () => {
    const local = fullLocalSheet();
    const back = roundtrip(local);
    expect(back.branding).toEqual(local.branding);
    expect(back.persona).toEqual(local.persona);
    expect(back.editorialLine).toEqual(local.editorialLine);
    expect(back.typography).toEqual(local.typography);
    expect(back.socialLinks).toEqual(local.socialLinks);
    expect(back.briefing).toEqual(local.briefing);
  });

  it("competitors volta (antes: escrito em raw_payload e nunca lido) — id, name, url e notes", () => {
    const competitors = [
      { id: "c1", name: "Rival A", url: "https://a.com", notes: "forte em preço" },
      { id: "c2", name: "Rival B" },
    ];
    const back = roundtrip({ ...fullLocalSheet(), competitors });
    expect(back.competitors).toEqual(competitors);
  });

  it("competitors: lista esvaziada pelo usuário volta como [] (não 'ausente')", () => {
    expect(roundtrip({ ...fullLocalSheet(), competitors: [] }).competitors).toEqual([]);
  });

  it("competitors: ficha sem o campo continua sem o campo (não inventa [])", () => {
    expect(roundtrip(fullLocalSheet())).not.toHaveProperty("competitors");
  });

  it("competitors: entrada sem nome é descartada na leitura; sem id ganha id estável (não aleatório)", () => {
    const row = asDbRow(mapLocalToSupabaseSheet(fullLocalSheet()), {
      raw_payload: { competitors: [{ name: "Sem id" }, { id: "x", name: "  " }, null] },
    });
    const a = mapSupabaseToLocalSheet(row).competitors;
    const b = mapSupabaseToLocalSheet(row).competitors;
    expect(a).toEqual([{ id: "comp-0", name: "Sem id" }]);
    expect(b).toEqual(a);
  });

  it("competitors: prefere a coluna dedicada quando existir e tiver dados (fallback até o draft 6.1 ser aplicado); coluna vazia não encobre o raw_payload", () => {
    const base = mapLocalToSupabaseSheet({ ...fullLocalSheet(), competitors: [{ id: "r1", name: "Do raw" }] });
    const withColumn = mapSupabaseToLocalSheet(asDbRow(base, { competitors: [{ id: "k1", name: "Da coluna" }] }));
    expect(withColumn.competitors).toEqual([{ id: "k1", name: "Da coluna" }]);
    const emptyColumn = mapSupabaseToLocalSheet(asDbRow(base, { competitors: [] }));
    expect(emptyColumn.competitors).toEqual([{ id: "r1", name: "Do raw" }]);
    const noColumn = mapSupabaseToLocalSheet(asDbRow(base));
    expect(noColumn.competitors).toEqual([{ id: "r1", name: "Do raw" }]);
  });

  it("assets: description e tags (gravados em raw_payload) voltam — antes a leitura os descartava", () => {
    const local = fullLocalSheet();
    local.assets[0] = { ...local.assets[0], description: "versão 2026", tags: ["marca", "pdf"] } as never;
    const back = roundtrip(local);
    expect(back.assets?.[0]).toMatchObject({ id: "a1", title: "Guia de marca", description: "versão 2026", tags: ["marca", "pdf"] });
  });

  it("[G63 — exceção deliberada] accesses nunca volta, nem com senha em qualquer lugar da linha", () => {
    const back = roundtrip({ ...fullLocalSheet(), accesses: [{ id: "x", platform: "IG", login: "a", password: "s3nh4" }] });
    expect(back).not.toHaveProperty("accesses");
    expect(JSON.stringify(back)).not.toContain("s3nh4");
  });
});

describe("G83 — material fantasma / binário local", () => {
  it("linha LEGADA com o texto do placeholder em raw_payload.assets: a leitura não materializa o item", () => {
    const row = asDbRow(mapLocalToSupabaseSheet(fullLocalSheet()), {
      raw_payload: {
        assets: [
          { id: "ok", title: "Real", type: "outro", url: "https://x/real", accessStatus: "privado" },
          { id: "ghost", title: "Logo", type: "outro", url: BINARY_PLACEHOLDER, accessStatus: "privado" },
        ],
      },
    });
    expect(mapSupabaseToLocalSheet(row).assets?.map((a) => a.id)).toEqual(["ok"]);
  });

  it("item com storagePath é arquivo real no bucket: continua aparecendo mesmo se a url vier como placeholder", () => {
    const row = asDbRow(mapLocalToSupabaseSheet(fullLocalSheet()), {
      raw_payload: { assets: [{ id: "s1", title: "Arquivo", type: "outro", url: BINARY_PLACEHOLDER, storagePath: "ws/c/f.png" }] },
    });
    expect(mapSupabaseToLocalSheet(row).assets?.[0]).toMatchObject({ id: "s1", storagePath: "ws/c/f.png", source: "storage" });
  });

  it("a escrita NUNCA mais produz o placeholder — nem em raw_payload, nem em materials, nem em branding", () => {
    const out = mapLocalToSupabaseSheet({
      branding: { logoUrl: "blob:http://x/1", logoFileName: "l.png", logoFileSize: 10, logoMimeType: "image/png", slogan: "ok" },
      assets: [{ id: "b", title: "B", url: "data:application/pdf;base64,AAA" }, { id: "l", title: "L", type: "outro", url: "https://x/l" }],
    });
    expect(JSON.stringify(out)).not.toContain(BINARY_PLACEHOLDER);
    expect(out.branding).toEqual({ slogan: "ok" });
    expect((out.raw_payload as { assets: Array<{ id: string }> }).assets.map((a) => a.id)).toEqual(["l"]);
  });

  it("describeUnsyncedBinary / unsyncedBinaryMessage: acusam logo e materiais binários; vazio ⇒ null", () => {
    const u = describeUnsyncedBinary({ branding: { logoUrl: "data:image/png;base64,A", slogan: "x" }, assets: [{ url: "blob:x" }, { url: "https://ok" }] });
    expect(u).toEqual({ brandingFields: ["logoUrl"], assets: 1 });
    expect(unsyncedBinaryMessage(u)).toMatch(/logo.*1 material/);
    expect(unsyncedBinaryMessage(describeUnsyncedBinary(fullLocalSheet()))).toBeNull();
  });
});

describe("G83 — teto de tamanho do raw_payload (validado antes de gravar, sem depender de CHECK no banco)", () => {
  it("ficha dentro do teto grava normalmente", () => {
    expect(() => mapLocalToSupabaseSheet({ briefing: { generalBriefing: "x".repeat(10_000) } })).not.toThrow();
  });

  it("ficha acima de 1 MB lança SheetTooLargeError (mensagem honesta, 'Nada foi gravado')", () => {
    const big = { briefing: { generalBriefing: "x".repeat(SHEET_RAW_PAYLOAD_MAX_BYTES + 10) } };
    expect(() => mapLocalToSupabaseSheet(big)).toThrow(SheetTooLargeError);
    expect(() => mapLocalToSupabaseSheet(big)).toThrow(/Nada foi gravado/);
  });

  it("o teto conta o raw_payload JÁ sanitizado: dataURL grande no logo (que não sobe) não estoura o teto", () => {
    const local = { branding: { logoUrl: "data:image/png;base64," + "A".repeat(SHEET_RAW_PAYLOAD_MAX_BYTES + 10) }, briefing: { generalBriefing: "ok" } };
    expect(() => mapLocalToSupabaseSheet(local)).not.toThrow();
  });
});
