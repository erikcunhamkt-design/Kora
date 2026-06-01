import { SupabaseTechnicalSheetInput } from "@/repositories/clientTechnicalSheetsRepository";

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
  if (sanitizedRaw.assets && Array.isArray(sanitizedRaw.assets)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sanitizedRaw.assets = sanitizedRaw.assets.map((asset: any) => {
      if (asset.url && (asset.url.startsWith("data:") || asset.url.startsWith("blob:"))) {
        return {
          ...asset,
          url: "[Conteúdo binário não enviado nesta etapa]",
        };
      }
      return asset;
    });
  }

  // Sanitize branding fields that might contain binary dataURL
  if (sanitizedRaw.branding && typeof sanitizedRaw.branding === "object") {
    const branding = sanitizedRaw.branding;
    for (const key of Object.keys(branding)) {
      const val = branding[key];
      if (typeof val === "string" && (val.startsWith("data:") || val.startsWith("blob:"))) {
        branding[key] = "[Conteúdo binário não enviado nesta etapa]";
      }
    }
  }

  return {
    branding: localSheet.branding || {},
    persona: localSheet.persona || {},
    editorial: localSheet.editorialLine || {},
    typography: localSheet.typography || {},
    social_links: localSheet.socialLinks || {},
    briefing: localSheet.briefing || {},
    materials,
    raw_payload: sanitizedRaw,
  };
}
