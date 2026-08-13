import {
  LucideIcon,
  Palette, Users, FileText, Type, Share2, KeyRound, Swords,
  ClipboardList, FolderOpen,
} from "lucide-react";
import type { ClientTechnicalSheet } from "@/hooks/useClients";
import type { SectionId } from "@/components/clients/ClientTechnicalSheetDialog";

export const FONT_SUGGESTIONS = [
  "Inter", "Poppins", "Montserrat", "Roboto", "Lato",
  "Open Sans", "Playfair Display", "Merriweather", "Oswald", "Raleway",
];

export const SECTIONS: { id: Exclude<SectionId, "overview">; label: string; subtitle: string; icon: LucideIcon }[] = [
  { id: "branding", label: "Branding", subtitle: "Logo, cores, slogan e tom de voz", icon: Palette },
  { id: "persona", label: "Persona", subtitle: "Público-alvo, dores e desejos", icon: Users },
  { id: "editorial", label: "Linha Editorial", subtitle: "Pilares, frequência e formatos", icon: FileText },
  { id: "typography", label: "Tipografia", subtitle: "Fontes primárias e secundárias", icon: Type },
  { id: "social", label: "Redes Sociais", subtitle: "Instagram, YouTube, TikTok e outros", icon: Share2 },
  { id: "accesses", label: "Acessos", subtitle: "Logins e dados de plataformas", icon: KeyRound },
  { id: "competitors", label: "Concorrentes", subtitle: "Referências e análise da concorrência", icon: Swords },
  { id: "briefing", label: "Briefing & Notas", subtitle: "Contexto geral do cliente", icon: ClipboardList },
  { id: "assets", label: "Materiais e Anexos", subtitle: "Links de Drive, fotos, identidade e documentos", icon: FolderOpen },
];

export type FillStatus = "vazio" | "parcial" | "completo";

export function statusOf(section: Exclude<SectionId, "overview">, t?: ClientTechnicalSheet): FillStatus {
  if (!t) return "vazio";
  const has = (v: unknown) => (Array.isArray(v) ? v.length > 0 : !!(v && String(v).trim()));
  switch (section) {
    case "branding": {
      const b = t.branding ?? {};
      const keys = [b.logoUrl, b.slogan, b.voiceTone, b.brandNotes, b.colors];
      const filled = keys.filter(has).length;
      return filled === 0 ? "vazio" : filled >= 4 ? "completo" : "parcial";
    }
    case "persona": {
      const p = t.persona ?? {};
      const keys = [p.name, p.ageRange, p.pains, p.desires, p.behavior, p.objections];
      const filled = keys.filter(has).length;
      return filled === 0 ? "vazio" : filled >= 4 ? "completo" : "parcial";
    }
    case "editorial": {
      const e = t.editorialLine ?? {};
      const keys = [e.pillars, e.postingFrequency, e.preferredFormats, e.contentNotes];
      const filled = keys.filter(has).length;
      return filled === 0 ? "vazio" : filled >= 3 ? "completo" : "parcial";
    }
    case "typography": {
      const y = t.typography ?? {};
      const keys = [y.primaryFont, y.secondaryFont, y.fontLinks, y.typographyNotes];
      const filled = keys.filter(has).length;
      return filled === 0 ? "vazio" : filled >= 2 ? "completo" : "parcial";
    }
    case "social": {
      const s = t.socialLinks ?? {};
      const keys = [s.instagram, s.youtube, s.tiktok, s.linkedin, s.facebook, s.website, s.otherLinks];
      const filled = keys.filter(has).length;
      return filled === 0 ? "vazio" : filled >= 3 ? "completo" : "parcial";
    }
    case "accesses":
      return !t.accesses?.length ? "vazio" : t.accesses.length >= 3 ? "completo" : "parcial";
    case "competitors":
      return !t.competitors?.length ? "vazio" : t.competitors.length >= 3 ? "completo" : "parcial";
    case "briefing": {
      const b = t.briefing ?? {};
      const keys = [b.generalBriefing, b.additionalNotes];
      const filled = keys.filter(has).length;
      return filled === 0 ? "vazio" : filled >= 2 ? "completo" : "parcial";
    }
    case "assets":
      return !t.assets?.length ? "vazio" : t.assets.length >= 3 ? "completo" : "parcial";
  }
}

export const statusStyles: Record<FillStatus, string> = {
  vazio: "bg-muted/40 text-muted-foreground border-border/60",
  parcial: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  completo: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
};

export const statusLabel: Record<FillStatus, string> = {
  vazio: "Vazio",
  parcial: "Parcial",
  completo: "Completo",
};

export function formatBytes(n: number) {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
