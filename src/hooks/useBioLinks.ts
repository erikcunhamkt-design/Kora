import { useEffect, useState, useCallback } from "react";

export interface BioLink {
  id: string;
  title: string;
  url: string;
  icon: string;
  active: boolean;
  order: number;
  clicks: number;
  isDemo?: boolean;
}

const KEY = "orbyt.bioLinks.v1";

const SEEDS: BioLink[] = [
  { id: "b1", title: "Ver portfólio", url: "https://orbyt.studio/portfolio", icon: "briefcase", active: true, order: 1, clicks: 42, isDemo: true },
  { id: "b2", title: "Pedir orçamento", url: "https://orbyt.studio/orcamento", icon: "file", active: true, order: 2, clicks: 18, isDemo: true },
  { id: "b3", title: "WhatsApp", url: "https://wa.me/5511999990000", icon: "message", active: true, order: 3, clicks: 67, isDemo: true },
  { id: "b4", title: "Instagram", url: "https://instagram.com/orbyt.studio", icon: "instagram", active: true, order: 4, clicks: 124, isDemo: true },
  { id: "b5", title: "Serviços", url: "https://orbyt.studio/servicos", icon: "sparkles", active: false, order: 5, clicks: 9, isDemo: true },
];

export function useBioLinks() {
  const [links, setLinks] = useState<BioLink[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLinks(JSON.parse(raw));
      else { setLinks(SEEDS); localStorage.setItem(KEY, JSON.stringify(SEEDS)); }
    } catch { setLinks(SEEDS); }
  }, []);

  const persist = (l: BioLink[]) => { setLinks(l); try { localStorage.setItem(KEY, JSON.stringify(l)); } catch {} };

  const add = useCallback((l: Omit<BioLink, "id" | "clicks" | "order" | "isDemo">) => {
    setLinks((prev) => {
      const next = [...prev, { ...l, id: crypto.randomUUID(), clicks: 0, order: prev.length + 1, isDemo: false }];
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setLinks((prev) => {
      const next = prev.map((x) => x.id === id ? { ...x, active: !x.active } : x);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setLinks((prev) => {
      const next = prev.filter((x) => x.id !== id);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  return { links, add, toggle, remove };
}
