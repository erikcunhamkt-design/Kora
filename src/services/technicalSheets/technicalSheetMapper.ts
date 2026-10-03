import { SupabaseTechnicalSheetInput } from "@/repositories/clientTechnicalSheetsRepository";

/**
 * Texto que escritas ANTIGAS gravavam no lugar de um `data:`/`blob:` em `raw_payload`
 * (linhas legadas ainda o carregam). A escrita nova NÃO o grava mais; a leitura
 * (supabaseTechnicalSheetToLocalMapper) o descarta — nunca finge material.
 */
export const BINARY_PLACEHOLDER = "[Conteúdo binário não enviado nesta etapa]";

/**
 * G83 — teto do catch-all `raw_payload` (mesmo valor do draft opcional 6.2 do doc
 * da Fase A: `octet_length(raw_payload::text) <= 1048576`). A validação é client-side
 * e NÃO depende de o operador aplicar o CHECK.
 */
export const SHEET_RAW_PAYLOAD_MAX_BYTES = 1_048_576;

export class SheetTooLargeError extends Error {
  readonly bytes: number;
  constructor(bytes: number) {
    super(
      `A ficha técnica tem ${(bytes / 1_048_576).toFixed(2)} MB e o limite para salvar na nuvem é 1 MB. Nada foi gravado — remova conteúdo extenso (ex.: textos muito longos) e tente de novo.`,
    );
    this.name = "SheetTooLargeError";
    this.bytes = bytes;
  }
}

export function isBinaryUrl(value: unknown): boolean {
  return typeof value === "string" && (value.startsWith("data:") || value.startsWith("blob:"));
}

/** O que, na ficha local, é binário local (`data:`/`blob:`) e portanto NÃO pode ir pra nuvem. */
export interface UnsyncedBinary {
  /** chaves de `branding` com binário local (ex.: "logoUrl") */
  brandingFields: string[];
  /** quantidade de materiais cujo arquivo é binário local */
  assets: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function describeUnsyncedBinary(localSheet: any): UnsyncedBinary {
  const brandingFields: string[] = [];
  const branding = localSheet?.branding;
  if (branding && typeof branding === "object") {
    for (const key of Object.keys(branding)) {
      if (isBinaryUrl(branding[key])) brandingFields.push(key);
    }
  }
  const assets = Array.isArray(localSheet?.assets)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      localSheet.assets.filter((a: any) => isBinaryUrl(a?.url)).length
    : 0;
  return { brandingFields, assets };
}

/** Texto honesto pro toast quando há binário local que não foi enviado; `null` se não há. */
export function unsyncedBinaryMessage(u: UnsyncedBinary): string | null {
  const parts: string[] = [];
  if (u.brandingFields.length > 0) parts.push("o logo (arquivo local)");
  if (u.assets > 0) parts.push(`${u.assets} material(is) com arquivo local`);
  if (parts.length === 0) return null;
  return `Não foi enviado à nuvem: ${parts.join(" e ")}. Use "Selecionar e Enviar" (PNG/JPEG/WEBP até 2 MB) para subir o arquivo.`;
}

/** Remove de `branding` os campos binários locais (e os metadados do arquivo do logo). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripBinaryBranding(branding: any): Record<string, unknown> {
  if (!branding || typeof branding !== "object") return {};
  const out: Record<string, unknown> = { ...branding };
  let logoRemoved = false;
  for (const key of Object.keys(out)) {
    if (isBinaryUrl(out[key])) {
      delete out[key];
      if (key === "logoUrl") logoRemoved = true;
    }
  }
  if (logoRemoved) {
    delete out.logoFileName;
    delete out.logoFileSize;
    delete out.logoMimeType;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapLocalToSupabaseSheet(localSheet: any): SupabaseTechnicalSheetInput {
  if (!localSheet) {
    return {
      branding: {},
      persona: {},
      editorial: {},
      typography: {},
      social_links: {},
      briefing: {},
      materials: [],
      raw_payload: {},
    };
  }

  // Normalize assets/materials
  const materials: Record<string, unknown>[] = [];
  if (localSheet.assets && Array.isArray(localSheet.assets)) {
    for (const asset of localSheet.assets) {
      if (asset.url && !asset.url.startsWith("data:") && !asset.url.startsWith("blob:")) {
        materials.push({
          title: asset.title || "Documento",
          url: asset.url,
          type: asset.type || "outro",
          description: asset.description || "",
        });
      }
    }
  }

  // Sanitize raw_payload to remove any heavy dataUrl / base64 / blob
  const sanitizedRaw = JSON.parse(JSON.stringify(localSheet));

  // G63 — accesses[] carrega ClientAccess.password (senha de plataforma do
  // cliente, texto puro). raw_payload era um clone bruto do objeto local
  // inteiro, sem excluir accesses — a senha ia junto sem sanitização
  // nenhuma. supabaseTechnicalSheetToLocalMapper.ts (leitura) NUNCA
  // reconstrói accesses de raw_payload (nem de nenhum outro campo) — não
  // existe coluna dedicada, não existe consumidor. Excluir o campo inteiro
  // (não só .password) é perda funcional zero, confirmada por essa
  // ausência de leitura, e evita deixar login/plataforma/notas de acesso
  // (ainda sensíveis, mesmo sem a senha) no catch-all.
  delete sanitizedRaw.accesses;

  // G83 — item de material cujo arquivo é binário local NÃO é gravado (antes ia
  // com o texto do placeholder e voltava na leitura como "material" fantasma).
  // O binário real sobe pelo Storage ("Selecionar e Enviar"), não por aqui.
  if (sanitizedRaw.assets && Array.isArray(sanitizedRaw.assets)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sanitizedRaw.assets = sanitizedRaw.assets.filter((asset: any) => !isBinaryUrl(asset?.url));
  }

  // G83 — `branding` (coluna E cópia em raw_payload) nunca leva dataURL/blob: o
  // campo binário é descartado, não substituído por texto (a coluna era gravada
  // com o objeto ORIGINAL, base64 inteiro, e a leitura só o zerava).
  const cleanBranding = stripBinaryBranding(localSheet.branding);
  if (sanitizedRaw.branding && typeof sanitizedRaw.branding === "object") {
    sanitizedRaw.branding = cleanBranding;
  }

  // G83 — teto de tamanho do catch-all, validado ANTES de gravar.
  const rawBytes = new TextEncoder().encode(JSON.stringify(sanitizedRaw)).length;
  if (rawBytes > SHEET_RAW_PAYLOAD_MAX_BYTES) {
    throw new SheetTooLargeError(rawBytes);
  }

  return {
    branding: cleanBranding,
    persona: localSheet.persona || {},
    editorial: localSheet.editorialLine || {},
    typography: localSheet.typography || {},
    social_links: localSheet.socialLinks || {},
    briefing: localSheet.briefing || {},
    materials,
    raw_payload: sanitizedRaw,
  };
}
