import { useCallback, useEffect, useState } from "react";

export type ContentChannel = "instagram" | "tiktok" | "youtube" | "blog" | "email" | "other";
export type ContentFormat = "post" | "reel" | "carousel" | "story" | "video" | "article" | "email";
export type ContentStatus = "idea" | "writing" | "design" | "scheduled" | "published";

export interface ContentItem {
  id: string;
  title: string;
  channel: ContentChannel;
  format: ContentFormat;
  status: ContentStatus;
  publishDate?: string;
  clientName?: string;
  campaign?: string;
  caption?: string;
  tags: string[];
  createdAt: string;
  isDemo?: boolean;
}

const STORAGE_KEY = "orbyt.content.v1";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const today = new Date();
const addDays = (n: number) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return iso(d);
};

const rawDemo: Omit<ContentItem, "isDemo">[] = [
  { id: "ct-demo-1", title: "Carrossel educativo: 5 erros em branding", channel: "instagram", format: "carousel", status: "scheduled", publishDate: addDays(2), clientName: "Acme Corp", campaign: "Educacional Abril", caption: "Você comete algum desses?", tags: ["branding", "educativo"], createdAt: addDays(-5) },
  { id: "ct-demo-2", title: "Reel de bastidores do shooting", channel: "instagram", format: "reel", status: "design", publishDate: addDays(4), clientName: "FitTrack", campaign: "Bastidores", caption: "Veja como gravamos!", tags: ["bastidores"], createdAt: addDays(-3) },
  { id: "ct-demo-3", title: "Post de prova social — depoimento", channel: "instagram", format: "post", status: "writing", publishDate: addDays(6), clientName: "Studio Zen", caption: "O que nossos clientes dizem.", tags: ["prova-social"], createdAt: addDays(-2) },
  { id: "ct-demo-4", title: "Email promocional Black Week", channel: "email", format: "email", status: "idea", publishDate: addDays(20), campaign: "Black Week", tags: ["email", "promo"], createdAt: addDays(-1) },
  { id: "ct-demo-5", title: "Artigo: como precificar serviços de design", channel: "blog", format: "article", status: "published", publishDate: addDays(-10), caption: "Guia prático.", tags: ["blog", "precificação"], createdAt: addDays(-15) },
];

export const initialContent: ContentItem[] = rawDemo.map((c) => ({ ...c, isDemo: true }));
const SEED_IDS = new Set(rawDemo.map((c) => c.id));

function migrate(list: ContentItem[]): ContentItem[] {
  return list.map((c) => (c.isDemo === undefined && SEED_IDS.has(c.id) ? { ...c, isDemo: true } : c));
}

export function useContentItems() {
  const [items, setItems] = useState<ContentItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return migrate(JSON.parse(raw) as ContentItem[]);
    } catch {}
    return initialContent;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {}
  }, [items]);

  const addContentItem = useCallback((data: Omit<ContentItem, "id" | "isDemo" | "createdAt">) => {
    setItems((prev) => [
      { ...data, id: `ct-${Date.now()}`, createdAt: new Date().toISOString(), isDemo: false },
      ...prev,
    ]);
  }, []);

  const updateContentStatus = useCallback((id: string, status: ContentStatus) => {
    setItems((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  }, []);

  const deleteContentItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((c) => c.id !== id || c.isDemo));
  }, []);

  return { items, addContentItem, updateContentStatus, deleteContentItem };
}

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  idea: "Ideia",
  writing: "Escrevendo",
  design: "Design",
  scheduled: "Agendado",
  published: "Publicado",
};

export const CONTENT_CHANNEL_LABEL: Record<ContentChannel, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  blog: "Blog",
  email: "Email",
  other: "Outro",
};

export const CONTENT_FORMAT_LABEL: Record<ContentFormat, string> = {
  post: "Post",
  reel: "Reel",
  carousel: "Carrossel",
  story: "Story",
  video: "Vídeo",
  article: "Artigo",
  email: "Email",
};
