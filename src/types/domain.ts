export type ClientStatus = "Ativo" | "Em negociação" | "Inativo" | "Potencial" | "Arquivado";
export type ClientTemperature = "Frio" | "Morno" | "Quente";

export type ClientAssetType =
  | "drive" | "figma" | "canva" | "identidade_visual" | "tipografia"
  | "fotos_ensaios" | "videos" | "briefing" | "contrato" | "referencias"
  | "redes_sociais" | "outro";

export type ClientAssetAccessStatus =
  | "liberado" | "solicitar_acesso" | "publico" | "privado" | "expirado" | "revisar";

export interface ClientAsset {
  id: string;
  title: string;
  type: ClientAssetType;
  url: string;
  description?: string;
  tags?: string[];
  accessStatus: ClientAssetAccessStatus;
  kind?: "link" | "file";
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  uploadedAt?: string;
  source?: "link" | "storage" | "manual";
  createdAt: string;
  updatedAt: string;
}

export interface ClientBranding {
  logoUrl?: string;
  logoFileName?: string;
  logoFileSize?: number;
  logoMimeType?: string;
  logoStoragePath?: string;
  colors?: string[];
  slogan?: string;
  voiceTone?: string;
  brandNotes?: string;
}

export interface ClientPersona {
  name?: string;
  ageRange?: string;
  pains?: string;
  desires?: string;
  behavior?: string;
  objections?: string;
}

export interface ClientEditorialLine {
  pillars?: string[];
  postingFrequency?: string;
  preferredFormats?: string[];
  contentNotes?: string;
}

export interface ClientTypography {
  primaryFont?: string;
  secondaryFont?: string;
  fontLinks?: string[];
  typographyNotes?: string;
}

export interface ClientSocialLinks {
  instagram?: string;
  youtube?: string;
  tiktok?: string;
  linkedin?: string;
  facebook?: string;
  website?: string;
  otherLinks?: { label: string; url: string }[];
}

export interface ClientAccess {
  id: string;
  platform: string;
  login?: string;
  password?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientCompetitor {
  id: string;
  name: string;
  url?: string;
  notes?: string;
}

export interface ClientBriefing {
  generalBriefing?: string;
  additionalNotes?: string;
}

export interface ClientTechnicalSheet {
  branding?: ClientBranding;
  persona?: ClientPersona;
  editorialLine?: ClientEditorialLine;
  typography?: ClientTypography;
  socialLinks?: ClientSocialLinks;
  accesses?: ClientAccess[];
  competitors?: ClientCompetitor[];
  briefing?: ClientBriefing;
  assets?: ClientAsset[];
}

export type ClientContactRole =
  | "Decisor" | "Financeiro" | "Marketing" | "Atendimento"
  | "Operacional" | "Aprovação" | "Dono" | "Outro";

export interface ClientContact {
  id: string;
  name: string;
  role?: ClientContactRole | string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  isPrimary?: boolean;
  isFinancial?: boolean;
  isDecisionMaker?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  site: string;
  serviceType: string;
  origin?: string;
  status: ClientStatus;
  potentialValue: number;
  totalRevenue?: number;
  lastProject: string;
  lastInteraction: string;
  observations: string;
  projects: { name: string; status: string }[];
  tasks: { name: string; done: boolean }[];
  isDemo?: boolean;
  document?: string;
  city?: string;
  state?: string;
  address?: string;
  tags?: string[];
  temperature?: ClientTemperature;
  nextAction?: string;
  nextActionDate?: string;
  createdAt?: string;
  updatedAt?: string;
  contacts?: ClientContact[];
  technicalSheet?: ClientTechnicalSheet;
  assets?: ClientAsset[];
  archived?: boolean;
  avatarUrl?: string;
}

// Client Activities / Logs
export type ManualActivityType =
  | "meeting"
  | "call"
  | "message"
  | "feedback"
  | "scope_change"
  | "material_request"
  | "decision"
  | "issue"
  | "internal_note"
  | "follow_up"
  | "other";

export interface ClientManualActivity {
  id: string;
  clientId: number;
  type: ManualActivityType;
  title: string;
  description?: string;
  date: string;
  outcome?: string;
  nextStep?: string;
  nextStepDate?: string;
  relatedContactId?: string;
  relatedProjectId?: string;
  relatedOpportunityId?: number;
  relatedQuoteId?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}
