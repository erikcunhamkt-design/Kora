import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, ExternalLink, Copy, FileText,
  Palette, Users, BookOpen, Type, Link2, Share2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  type Client, CLIENT_ASSET_TYPE_LABELS, CLIENT_ASSET_ACCESS_LABELS,
} from "@/hooks/useClients";
import { useBifurcatedTechnicalSheet } from "@/hooks/useBifurcatedTechnicalSheet";

interface Props {
  client: Client;
  defaultOpen?: boolean;
}

export function ClientTechnicalSheetSnapshot({ client, defaultOpen = false }: Props) {
  const navigate = useNavigate();
  // G74 (etapa-5-flip-fichas-pacote.md §11) — client.technicalSheet é um
  // campo local-only, nunca populado pra um Client vindo do mapper cloud;
  // leitura bifurcada por cliente respeita o seletor pós-G63.
  const sheet = useBifurcatedTechnicalSheet(client.id);
  const branding = sheet.branding;
  const persona = sheet.persona;
  const editorial = sheet.editorialLine;
  const typography = sheet.typography;
  const social = sheet.socialLinks;
  const briefing = sheet.briefing;
  const assets = sheet.assets ?? [];

  const colors = branding?.colors ?? [];
  const topAssets = assets.slice(0, 5);

  const socialEntries = useMemo(() => {
    if (!social) return [] as { label: string; url: string }[];
    const items: { label: string; url: string }[] = [];
    if (social.instagram) items.push({ label: "Instagram", url: social.instagram });
    if (social.youtube) items.push({ label: "YouTube", url: social.youtube });
    if (social.tiktok) items.push({ label: "TikTok", url: social.tiktok });
    if (social.linkedin) items.push({ label: "LinkedIn", url: social.linkedin });
    if (social.facebook) items.push({ label: "Facebook", url: social.facebook });
    if (social.website) items.push({ label: "Site", url: social.website });
    return items;
  }, [social]);

  const isEmpty =
    colors.length === 0 &&
    !branding?.slogan && !branding?.voiceTone && !branding?.logoUrl &&
    !persona?.name && !persona?.pains && !persona?.desires && !persona?.behavior &&
    !(editorial?.pillars?.length) && !editorial?.postingFrequency && !(editorial?.preferredFormats?.length) &&
    !typography?.primaryFont && !typography?.secondaryFont &&
    socialEntries.length === 0 &&
    assets.length === 0 &&
    !briefing?.generalBriefing && !briefing?.additionalNotes;

  const [open, setOpen] = useState(defaultOpen);

  const summaryChips: string[] = [];
  if (colors.length) summaryChips.push(`${colors.length} cor${colors.length > 1 ? "es" : ""}`);
  if (assets.length) summaryChips.push(`${assets.length} material${assets.length > 1 ? "is" : ""}`);
  if (socialEntries.length) summaryChips.push(`${socialEntries.length} rede${socialEntries.length > 1 ? "s" : ""}`);
  if (persona?.name) summaryChips.push("persona");

  const goToSheet = () => navigate(`/clientes/${client.id}/ficha-tecnica`);

  const copyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const openLink = (url: string) => {
    if (!url) return;
    const href = url.startsWith("http") ? url : `https://${url}`;
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="p-6 space-y-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 text-left group"
      >
        <div className="mt-0.5 text-muted-foreground group-hover:text-foreground transition">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Ficha do Cliente</h3>
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">somente leitura</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Consulte branding, persona, materiais e referências sem sair do projeto.
          </p>
          {!open && summaryChips.length > 0 && (
            <div className="text-[11px] text-muted-foreground mt-1">{summaryChips.join(" · ")}</div>
          )}
          {!open && isEmpty && (
            <div className="text-[11px] text-muted-foreground/80 mt-1">Ficha técnica ainda não preenchida.</div>
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-4 pl-7">
          {isEmpty ? (
            <div className="rounded-lg border border-dashed border-border/60 p-5 text-center space-y-2">
              <p className="text-xs text-muted-foreground">Ficha técnica ainda não preenchida.</p>
              <Button size="sm" onClick={goToSheet} className="gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Preencher ficha técnica
              </Button>
            </div>
          ) : (
            <>
              {/* Branding */}
              {(colors.length || branding?.slogan || branding?.voiceTone || branding?.logoUrl) && (
                <SnapshotCard icon={Palette} title="Branding">
                  {branding?.logoUrl && (
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-md border border-border/60 bg-background/60 overflow-hidden flex items-center justify-center">
                        <img src={branding.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="text-[11px] text-muted-foreground">Logo do cliente</div>
                    </div>
                  )}
                  {colors.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {colors.map((c, i) => (
                        <span
                          key={`${c}-${i}`}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground"
                        >
                          <span className="h-3 w-3 rounded-sm border border-border/60" style={{ backgroundColor: c }} />
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {branding?.slogan && <Field label="Slogan" value={branding.slogan} />}
                  {branding?.voiceTone && <Field label="Tom de voz" value={branding.voiceTone} />}
                </SnapshotCard>
              )}

              {/* Persona */}
              {(persona?.name || persona?.pains || persona?.desires || persona?.behavior) && (
                <SnapshotCard icon={Users} title="Persona">
                  {persona?.name && <Field label="Nome" value={persona.name} />}
                  {persona?.pains && <Field label="Dores" value={persona.pains} />}
                  {persona?.desires && <Field label="Desejos" value={persona.desires} />}
                  {persona?.behavior && <Field label="Comportamento" value={persona.behavior} />}
                </SnapshotCard>
              )}

              {/* Editorial */}
              {(editorial?.pillars?.length || editorial?.postingFrequency || editorial?.preferredFormats?.length) && (
                <SnapshotCard icon={BookOpen} title="Linha editorial">
                  {editorial?.pillars && editorial.pillars.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {editorial.pillars.map((p, i) => (
                        <Badge key={`${p}-${i}`} variant="outline" className="text-[10px] border-border text-muted-foreground">{p}</Badge>
                      ))}
                    </div>
                  )}
                  {editorial?.postingFrequency && <Field label="Frequência" value={editorial.postingFrequency} />}
                  {editorial?.preferredFormats && editorial.preferredFormats.length > 0 && (
                    <Field label="Formatos" value={editorial.preferredFormats.join(", ")} />
                  )}
                </SnapshotCard>
              )}

              {/* Typography */}
              {(typography?.primaryFont || typography?.secondaryFont || (typography?.fontLinks?.length ?? 0) > 0) && (
                <SnapshotCard icon={Type} title="Tipografia">
                  {typography?.primaryFont && <Field label="Primária" value={typography.primaryFont} />}
                  {typography?.secondaryFont && <Field label="Secundária" value={typography.secondaryFont} />}
                  {typography?.fontLinks && typography.fontLinks.length > 0 && (
                    <div className="space-y-1">
                      {typography.fontLinks.map((link, i) => (
                        <button
                          key={`${link}-${i}`}
                          type="button"
                          onClick={() => openLink(link)}
                          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1 break-all"
                        >
                          <Link2 className="h-3 w-3" /> {link}
                        </button>
                      ))}
                    </div>
                  )}
                </SnapshotCard>
              )}

              {/* Assets */}
              {assets.length > 0 && (
                <SnapshotCard icon={FileText} title={`Materiais principais (${Math.min(topAssets.length, assets.length)}${assets.length > 5 ? ` de ${assets.length}` : ""})`}>
                  <ul className="space-y-2">
                    {topAssets.map((a) => (
                      <li key={a.id} className="rounded-md border border-border/60 bg-background/40 p-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-foreground truncate">{a.title}</div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                {CLIENT_ASSET_TYPE_LABELS[a.type]}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                                {CLIENT_ASSET_ACCESS_LABELS[a.accessStatus]}
                              </Badge>
                              {a.kind === "file" && (
                                <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">arquivo</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {a.url && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => copyLink(a.url)}
                                  className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground transition"
                                  aria-label="Copiar link"
                                  title="Copiar link"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openLink(a.url)}
                                  className="rounded-md border border-border/60 p-1.5 text-muted-foreground hover:text-foreground transition"
                                  aria-label="Abrir"
                                  title="Abrir"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {assets.length > 5 && (
                    <p className="text-[11px] text-muted-foreground">+ {assets.length - 5} outros materiais na ficha completa.</p>
                  )}
                </SnapshotCard>
              )}

              {/* Social */}
              {socialEntries.length > 0 && (
                <SnapshotCard icon={Share2} title="Redes sociais">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {socialEntries.map((s) => (
                      <li key={s.label} className="flex items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground w-16 shrink-0">{s.label}</span>
                        <span className="text-xs text-foreground truncate flex-1">{s.url}</span>
                        <button
                          type="button"
                          onClick={() => copyLink(s.url)}
                          className="text-muted-foreground hover:text-foreground transition"
                          aria-label="Copiar"
                          title="Copiar"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openLink(s.url)}
                          className="text-muted-foreground hover:text-foreground transition"
                          aria-label="Abrir"
                          title="Abrir"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </SnapshotCard>
              )}

              {/* Briefing */}
              {(briefing?.generalBriefing || briefing?.additionalNotes) && (
                <SnapshotCard icon={BookOpen} title="Briefing resumido">
                  {briefing?.generalBriefing && (
                    <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-6">
                      {briefing.generalBriefing}
                    </p>
                  )}
                  {briefing?.additionalNotes && (
                    <>
                      <Separator className="bg-border/60" />
                      <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-4">
                        {briefing.additionalNotes}
                      </p>
                    </>
                  )}
                </SnapshotCard>
              )}

              <div className="pt-1">
                <Button size="sm" onClick={goToSheet} className="gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5" /> Abrir ficha completa
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SnapshotCard({
  icon: Icon, title, children,
}: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/80">{label}</div>
      <div className="text-xs text-foreground whitespace-pre-line">{value}</div>
    </div>
  );
}
