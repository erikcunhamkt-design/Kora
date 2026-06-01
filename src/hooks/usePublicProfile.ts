import { useEffect, useState, useCallback } from "react";

export interface PublicProfile {
  studioName: string;
  slug: string;
  headline: string;
  description: string;
  location: string;
  contactEmail: string;
  whatsapp: string;
  website: string;
  primaryColor: string;
  layout: "classic" | "premium";
  showPortfolio: boolean;
  showServices: boolean;
  showTestimonials: boolean;
  published: boolean;
  updatedAt: string;
}

const KEY = "orbyt.publicProfile.v1";

const DEFAULT: PublicProfile = {
  studioName: "KORA HUB",
  slug: "kora-hub",
  headline: "Design e estratégia para marcas que querem crescer",
  description:
    "Estúdio criativo focado em branding, web design e conteúdo. Transformamos ideias em marcas memoráveis.",
  location: "São Paulo, BR",
  contactEmail: "contato@kora.hub",
  whatsapp: "(11) 99999-0000",
  website: "https://kora.hub",
  primaryColor: "#F81040",
  layout: "premium",
  showPortfolio: true,
  showServices: true,
  showTestimonials: true,
  published: true,
  updatedAt: new Date().toISOString(),
};

export function usePublicProfile() {
  const [profile, setProfile] = useState<PublicProfile>(DEFAULT);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProfile({ ...DEFAULT, ...JSON.parse(raw) });
      else localStorage.setItem(KEY, JSON.stringify(DEFAULT));
    } catch { /* intentionally empty */ }
  }, []);

  const update = useCallback((patch: Partial<PublicProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* intentionally empty */ }
      return next;
    });
  }, []);

  return { profile, update };
}

export function readPublicProfile(): PublicProfile | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return null;
  }
}
