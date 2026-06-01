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
}

// Quotes
export type QuoteStatus =
  | "rascunho"
  | "enviado"
  | "aprovado"
  | "recusado"
  | "vencido"
  | "arquivado";

export type QuoteSource = "manual" | "cliente" | "oportunidade";

export interface QuoteItem {
  id: string;
  serviceId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  clientName: string;
  clientEmail: string;
  clientWhatsapp: string;
  title: string;
  description: string;
  items: QuoteItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentCondition: string;
  deliveryDeadline: string;
  validityDays: number;
  status: QuoteStatus;
  createdAt: string;
  isDemo?: boolean;
  clientId?: number;
  company?: string;
  opportunityId?: number;
  opportunityTitle?: string;
  source?: QuoteSource;
  notes?: string;
  updatedAt?: string;
  sentAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  archivedAt?: string;
  expectedCloseDate?: string;
  financeEntryId?: string;
  projectId?: string;
  projectTitle?: string;
}

// Finance
export type TxType = "income" | "expense";
export type TxStatus = "pending" | "paid" | "overdue" | "canceled";
export type PaymentMethod = "pix" | "card" | "boleto" | "transfer" | "cash" | "other";
export type Recurrence = "none" | "weekly" | "monthly" | "yearly";
export type TxSource = "manual" | "quote" | "sale" | "service" | "recurring";

export interface Transaction {
  id: string;
  type: TxType;
  title: string;
  description?: string;
  amount: number;
  category: string;
  clientName?: string;
  supplierId?: string;
  cashAccountId?: string;
  dueDate: string;
  paidDate?: string;
  status: TxStatus;
  paymentMethod: PaymentMethod;
  recurrence: Recurrence;
  source: TxSource;
  notes?: string;
  createdAt: string;
  isDemo?: boolean;
  clientId?: number;
  quoteId?: string;
  quoteTitle?: string;
  opportunityId?: number;
}

// Tasks
export type TaskPriority = "alta" | "média" | "baixa";
export type TaskStatus = "a_fazer" | "em_andamento" | "revisao" | "concluido";
export type TaskRecurrence = "none" | "daily" | "weekly" | "monthly" | "weekdays";
export type TaskScope = "work" | "personal";

export interface SubTask { text: string; done: boolean }
export interface TaskComment { author: string; text: string; date: string }
export type TaskSource = "manual" | "projeto" | "orçamento";

export interface Task {
  id: number;
  title: string;
  description: string;
  client: string;
  project: string;
  projectId?: string;
  taskProjectId?: string;
  scope?: TaskScope;
  priority: TaskPriority;
  deadline: string;
  dueDate?: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  subtasks: SubTask[];
  comments: TaskComment[];
  recurrence?: TaskRecurrence;
  archived?: boolean;
  isDemo?: boolean;
  reminderAt?: string;
  reminderEnabled?: boolean;
  reminderSentAt?: string;
  clientId?: number;
  quoteId?: string;
  milestoneId?: string;
  source?: TaskSource;
}

// Projects
export type ProjectStatus =
  | "planning"
  | "in_progress"
  | "review"
  | "delivered"
  | "paused"
  | "cancelled"
  | "archived";
export type ProjectPriority = "low" | "medium" | "high";
export type ProjectSource = "manual" | "orçamento";

export interface ProjectDeliverable {
  id: string;
  title: string;
  description?: string;
  status: "pendente" | "em_andamento" | "concluido";
}

export interface Project {
  id: string;
  name: string;
  clientName: string;
  description?: string;
  serviceType?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate?: string;
  dueDate?: string;
  budget?: number;
  progress: number;
  tags: string[];
  createdAt: string;
  isDemo?: boolean;
  clientId?: number;
  company?: string;
  quoteId?: string;
  quoteTitle?: string;
  opportunityId?: number;
  opportunityTitle?: string;
  source?: ProjectSource;
  deliverables?: ProjectDeliverable[];
  notes?: string;
  updatedAt?: string;
  completedAt?: string;
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
