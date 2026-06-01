/* eslint-disable @typescript-eslint/no-explicit-any */
// Mapper to safely convert Supabase Technical Sheet representation back to Local format
import type { ClientTechnicalSheet } from "@/hooks/useClients";

export function mapSupabaseToLocalSheet(supabaseSheet: any): ClientTechnicalSheet {
  if (!supabaseSheet) return {};

  const localSheet: ClientTechnicalSheet = {
    branding: supabaseSheet.branding || {},
    persona: supabaseSheet.persona || {},
    editorialLine: supabaseSheet.editorial || {},
    typography: supabaseSheet.typography || {},
    socialLinks: supabaseSheet.social_links || {},
    briefing: supabaseSheet.briefing || {},
  };

  // Reconstruct assets/materials from raw_payload or materials list
  const rawAssets = supabaseSheet.raw_payload?.assets;
  if (Array.isArray(rawAssets)) {
    localSheet.assets = rawAssets.map((asset: any) => {
      const mapped: any = {
        id: asset.id || String(Math.random()),
        title: asset.title || "Documento",
        type: asset.type || "outro",
        url: asset.url || "",
        accessStatus: asset.accessStatus || "privado",
        kind: asset.kind || "link",
      };

      if (asset.fileName) mapped.fileName = asset.fileName;
      if (asset.fileSize) mapped.fileSize = asset.fileSize;
      if (asset.mimeType) mapped.mimeType = asset.mimeType;
      if (asset.storagePath) {
        mapped.storagePath = asset.storagePath;
        mapped.source = "storage";
        mapped.kind = "file";
      } else if (asset.source) {
        mapped.source = asset.source;
      }
      if (asset.uploadedAt) mapped.uploadedAt = asset.uploadedAt;
      if (asset.createdAt) mapped.createdAt = asset.createdAt;
      if (asset.updatedAt) mapped.updatedAt = asset.updatedAt;

      return mapped;
    });
  } else if (Array.isArray(supabaseSheet.materials)) {
    localSheet.assets = supabaseSheet.materials.map((mat: any, idx: number) => {
      const mapped: any = {
        id: `mat-${idx}-${Date.now()}`,
        title: mat.title || "Documento",
        type: mat.type || "outro",
        url: mat.url || "",
        accessStatus: "privado",
        kind: "link",
        description: mat.description || "",
      };
      if (mat.storagePath) {
        mapped.storagePath = mat.storagePath;
        mapped.source = "storage";
        mapped.kind = "file";
      }
      return mapped;
    });
  } else {
    localSheet.assets = [];
  }

  // Remove any base64/blob from branding logoUrl to prevent corrupting local state
  if (localSheet.branding && typeof localSheet.branding === "object") {
    const b = localSheet.branding as any;
    if (b.logoUrl && (b.logoUrl.startsWith("data:") || b.logoUrl.startsWith("blob:"))) {
      b.logoUrl = "";
      b.logoFileName = undefined;
      b.logoFileSize = undefined;
      b.logoMimeType = undefined;
    }
  }

  // Filter out any assets containing binary/dataURL/blob data
  if (Array.isArray(localSheet.assets)) {
    localSheet.assets = localSheet.assets.filter((asset: any) => {
      if (asset.url && (asset.url.startsWith("data:") || asset.url.startsWith("blob:"))) {
        return false;
      }
      return true;
    });
  }

  return localSheet;
}
