import { supabase } from "@/integrations/supabase/client";

const BUCKET_NAME = "client-assets";
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

// G75 (docs/qa/etapa-5-flip-materiais-pacote.md, R3) — antes disto estes 2
// constantes divergiam da policy real do bucket `client-assets`
// (supabase/migrations/20260530030000_create_client_assets_storage.sql:5-17
// — allowed_mime_types = png/jpeg/webp, file_size_limit = 2097152): a
// validação daqui aceitava PDF/DOCX/XLSX/TXT até 8MB, passava na tela e
// falhava no upload real pro Storage com o erro genérico do Supabase, não
// a mensagem amigável que já existe pra isso. Alinhado ao que o bucket de
// fato aceita hoje — subir a policy (novos MIME types/tamanho) é decisão
// do operador (migration nova), não algo pra client-side validation
// prometer sem o bucket acompanhar.
const MAX_MATERIAL_SIZE = 2 * 1024 * 1024; // 2MB — mesmo limite do bucket
const ALLOWED_MATERIAL_TYPES = ["image/png", "image/jpeg", "image/webp"]; // mesmos tipos do bucket

export interface StorageUploadResult {
  path: string;
  url: string;
}

export interface MaterialUploadResult {
  path: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export const clientAssetsStorage = {
  validateFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Formato inválido. Apenas PNG, JPEG e WebP são permitidos.",
      };
    }
    if (file.size > MAX_LOGO_SIZE) {
      return {
        valid: false,
        error: "O tamanho do arquivo excede o limite máximo de 2MB.",
      };
    }
    return { valid: true };
  },

  validateMaterialFile(file: File): { valid: boolean; error?: string } {
    if (!ALLOWED_MATERIAL_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Formato inválido. Apenas PNG, JPEG e WebP são permitidos.",
      };
    }
    if (file.size > MAX_MATERIAL_SIZE) {
      return {
        valid: false,
        error: "O tamanho do arquivo excede o limite máximo de 2MB.",
      };
    }
    return { valid: true };
  },

  async uploadClientLogo(
    workspaceId: string,
    clientId: string,
    file: File
  ): Promise<StorageUploadResult> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "Arquivo inválido.");
    }

    const fileExt = file.name.split(".").pop() || "png";
    const secureName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${workspaceId}/${clientId}/technical-sheet/logo/${secureName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const signedUrl = await this.getClientAssetSignedUrl(filePath);

    return {
      path: filePath,
      url: signedUrl,
    };
  },

  async uploadClientMaterial(
    workspaceId: string,
    clientId: string,
    file: File
  ): Promise<MaterialUploadResult> {
    const validation = this.validateMaterialFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "Arquivo de material inválido.");
    }

    const fileExt = file.name.split(".").pop() || "bin";
    const secureName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${workspaceId}/${clientId}/technical-sheet/materials/${secureName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const signedUrl = await this.getClientAssetSignedUrl(filePath);

    return {
      path: filePath,
      url: signedUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  },

  async getClientAssetSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600);

    if (error) {
      throw error;
    }
    if (!data?.signedUrl) {
      throw new Error("Não foi possível gerar a URL assinada.");
    }

    return data.signedUrl;
  },

  // Fallback alias for backward compatibility if needed
  async getClientLogoSignedUrl(path: string): Promise<string> {
    return this.getClientAssetSignedUrl(path);
  },

  async deleteClientAsset(path: string): Promise<boolean> {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      throw error;
    }
    return true;
  },

  async uploadClientAvatar(
    workspaceId: string,
    clientId: string,
    file: File
  ): Promise<StorageUploadResult> {
    const validation = this.validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || "Arquivo inválido.");
    }

    const fileExt = (file.name.split(".").pop() || "png").toLowerCase();
    const secureName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    const filePath = `${workspaceId}/${clientId}/avatar/${secureName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (uploadError) throw uploadError;

    // Long-lived signed URL (1 year) so we can store it directly on the client row.
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    if (error || !data?.signedUrl) {
      throw error || new Error("Não foi possível gerar URL da foto.");
    }

    return { path: filePath, url: data.signedUrl };
  },
};
