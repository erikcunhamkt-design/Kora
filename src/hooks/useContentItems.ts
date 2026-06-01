import { useCallback, useEffect, useMemo, useState } from "react";

export type ContentChannel =
  | "instagram" | "tiktok" | "youtube" | "blog" | "email" | "landing" | "branding" | "photo" | "deck" | "other";

export type ContentFormat =
  | "feed" | "reel" | "stories" | "carousel"
  | "tiktok" | "youtube"
  | "article" | "email" | "landing"
  | "branding" | "photo" | "deck"
  /** legacy */ | "post" | "video";

/** Etapa de produção (kanban) */
export type ContentStage =
  | "planning" | "copy" | "design" | "approval" | "review" | "approved" | "publication";

/** Status de aprovação (separado da etapa de produção) */
export type ContentApproval =
  | "draft" | "in_production" | "in_review" | "awaiting_client" | "approved" | "published";

/** legacy enum mantido para compat */
export type ContentStatus = "idea" | "writing" | "design" | "scheduled" | "published";

export interface ContentChecklistItem { text: string; done: boolean }

export interface ContentItem {
  id: string;
  title: string;
  channel: ContentChannel;
  format: ContentFormat;
  status: ContentStatus;        // legacy
  stage: ContentStage;
  approval: ContentApproval;
  publishDate?: string;         // ISO yyyy-mm-dd
  clientName?: string;
  campaign?: string;
  caption?: string;
  briefing?: string;
  observations?: string;
  mediaUrl?: string;            // placeholder até existir Storage seguro
  owner?: string;
  tags: string[];
  checklist?: ContentChecklistItem[];
  createdAt: string;
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.content.v1";

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return isoOf(d); };

/* legacy → stage/approval */
const LEGACY_STAGE: Record<ContentStatus, ContentStage> = {
  idea: "planning", writing: "copy", design: "design", scheduled: "approved", published: "publication",
};
const LEGACY_APPROVAL: Record<ContentStatus, ContentApproval> = {
  idea: "draft", writing: "in_production", design: "in_production",
  scheduled: "approved", published: "published",
};

const rawDemo: Omit<ContentItem, "isDemo">[] = [
  { id: "ct-demo-1", title: "Carrossel: 5 erros em branding", channel: "instagram", format: "carousel",
    status: "scheduled", stage: "approved", approval: "approved", publishDate: addDays(2),
    clientName: "Acme Corp", campaign: "Educacional Abril", caption: "Você comete algum desses?",
    briefing: "Tom didático, swipe para próximo card. CTA: salve para depois.",
    tags: ["branding", "educativo"], checklist: [{ text: "Aprovado pela Marina", done: true }], createdAt: addDays(-5) },
  { id: "ct-demo-2", title: "Reel: bastidores do shooting", channel: "instagram", format: "reel",
    status: "design", stage: "design", approval: "in_production", publishDate: addDays(4),
    clientName: "FitTrack", campaign: "Bastidores", caption: "Veja como gravamos!",
    tags: ["bastidores"], createdAt: addDays(-3) },
  { id: "ct-demo-3", title: "Post: depoimento de cliente", channel: "instagram", format: "feed",
    status: "writing", stage: "copy", approval: "in_production", publishDate: addDays(6),
    clientName: "Studio Zen", caption: "O que nossos clientes dizem.", tags: ["prova-social"], createdAt: addDays(-2) },
  { id: "ct-demo-4", title: "TikTok: tour pelo estúdio", channel: "tiktok", format: "tiktok",
    status: "writing", stage: "planning", approval: "draft", publishDate: addDays(9),
    clientName: "Acme Corp", caption: "Spoiler do novo espaço.", tags: ["tour", "tiktok"], createdAt: addDays(-1) },
  { id: "ct-demo-5", title: "YouTube: review da campanha", channel: "youtube", format: "youtube",
    status: "scheduled", stage: "review", approval: "in_review", publishDate: addDays(12),
    clientName: "Nova Design", caption: "Analisando o que funcionou.", tags: ["review"], createdAt: addDays(-4) },
  { id: "ct-demo-6", title: "Email Black Week", channel: "email", format: "email",
    status: "idea", stage: "planning", approval: "draft", publishDate: addDays(20),
    clientName: "Brand Co", campaign: "Black Week", tags: ["email", "promo"], createdAt: addDays(-1) },
  { id: "ct-demo-7", title: "Artigo: como precificar serviços", channel: "blog", format: "article",
    status: "published", stage: "publication", approval: "published", publishDate: addDays(-10),
    clientName: "Studio Zen", caption: "Guia prático.", tags: ["blog"], createdAt: addDays(-15) },
];

export const initialContent: ContentItem[] = rawDemo.map((c) => ({ ...c, isDemo: true }));
const SEED_IDS = new Set(rawDemo.map((c) => c.id));

function migrate(list: ContentItem[]): ContentItem[] {
  return list.map((c) => ({
    ...c,
    isDemo: c.isDemo === undefined && SEED_IDS.has(c.id) ? true : c.isDemo,
    stage: c.stage ?? LEGACY_STAGE[c.status] ?? "planning",
    approval: c.approval ?? LEGACY_APPROVAL[c.status] ?? "draft",
    checklist: c.checklist ?? [],
    tags: c.tags ?? [],
  }));
}

export function useContentItems() {
  const [items, setItems] = useState<ContentItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as ContentItem[]);
    } catch { /* intentionally empty */ }
    return initialContent;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* intentionally empty */ }
  }, [items]);

  const addContentItem = useCallback((data: Omit<ContentItem, "id" | "isDemo" | "createdAt">) => {
    setItems((prev) => [
      { ...data, id: `ct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, createdAt: new Date().toISOString(), isDemo: false },
      ...prev,
    ]);
  }, []);

  const addManyContentItems = useCallback((list: Omit<ContentItem, "id" | "isDemo" | "createdAt">[]) => {
    const now = new Date().toISOString();
    setItems((prev) => [
      ...list.map((data, i) => ({
        ...data,
        id: `ct-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: now, isDemo: false,
      })),
      ...prev,
    ]);
  }, []);

  const updateContentItem = useCallback((id: string, patch: Partial<ContentItem>) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const updateContentStage = useCallback((id: string, stage: ContentStage) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, stage } : c)));
  }, []);

  /** legacy — mantido por compatibilidade */
  const updateContentStatus = useCallback((id: string, status: ContentStatus) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }, []);

  const deleteContentItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id || c.isDemo));
  }, []);

  const clients = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((c) => {
      const name = (c.clientName || "").trim();
      if (!name) return;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [items]);

  return {
    items, clients,
    addContentItem, addManyContentItems, updateContentItem,
    updateContentStage, updateContentStatus, deleteContentItem,
  };
}

export const CONTENT_STAGE_LABEL: Record<ContentStage, string> = {
  planning: "Planejamento",
  copy: "Copy",
  design: "Design",
  approval: "Aprovação",
  review: "Revisão",
  approved: "Aprovado",
  publication: "Publicação",
};

export const CONTENT_STAGE_TONE: Record<ContentStage, string> = {
  planning: "bg-muted-foreground",
  copy: "bg-amber-400",
  design: "bg-sky-500",
  approval: "bg-violet-500",
  review: "bg-orange-500",
  approved: "bg-emerald-500",
  publication: "bg-primary",
};

export const CONTENT_APPROVAL_LABEL: Record<ContentApproval, string> = {
  draft: "Rascunho",
  in_production: "Em produção",
  in_review: "Em revisão",
  awaiting_client: "Aguardando cliente",
  approved: "Aprovado",
  published: "Publicado",
};

export const CONTENT_APPROVAL_TONE: Record<ContentApproval, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  in_production: "bg-amber-500/10 text-amber-400 border-amber-500/25",
  in_review: "bg-orange-500/10 text-orange-400 border-orange-500/25",
  awaiting_client: "bg-violet-500/10 text-violet-400 border-violet-500/25",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
  published: "bg-primary/10 text-primary border-primary/25",
};

export const CONTENT_CHANNEL_LABEL: Record<ContentChannel, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  blog: "Blog",
  email: "E-mail",
  landing: "Landing Page",
  branding: "Branding",
  photo: "Foto",
  deck: "Apresentação",
  other: "Outro",
};

export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
  feed: "Feed",
  reel: "Reels",
  stories: "Stories",
  carousel: "Carrossel",
  tiktok: "TikTok",
  youtube: "YouTube",
  article: "Artigo/Blog",
  email: "E-mail marketing",
  landing: "Landing Page",
  branding: "Branding",
  photo: "Foto",
  deck: "Apresentação",
  post: "Post",   // legacy
  video: "Vídeo", // legacy
};

/** legacy label kept */
export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Ideia",
  writing: "Escrevendo",
  design: "Design",
  scheduled: "Agendado",
  published: "Publicado",
};
