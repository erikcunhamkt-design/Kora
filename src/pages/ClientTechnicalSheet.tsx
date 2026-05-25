import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useClients, type ClientTechnicalSheet } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import {
  OverviewGrid, BrandingSection, PersonaSection, EditorialSection,
  TypographySection, SocialSection, AccessesSection, CompetitorsSection,
  BriefingSection, AssetsSection, SECTIONS, statusOf, statusStyles, statusLabel,
  type SectionId,
} from "@/components/clients/ClientTechnicalSheetDialog";

type ViewId = "overview" | Exclude<SectionId, "overview">;

const NAV: { id: ViewId; label: string }[] = [
  { id: "overview", label: "Visão geral" },
  ...SECTIONS.map((s) => ({ id: s.id as ViewId, label: s.label })),
];

export default function ClientTechnicalSheetPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients, updateClient } = useClients();

  const client = useMemo(
    () => clients.find((c) => String(c.id) === String(clientId)) ?? null,
    [clients, clientId]
  );

  const [view, setView] = useState<ViewId>("overview");
  const [sheet, setSheet] = useState<ClientTechnicalSheet>({});

  useEffect(() => {
    if (client) setSheet(client.technicalSheet ?? {});
  }, [client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!client) {
    return (
      <PageContainer>
        <div className="max-w-3xl mx-auto py-20 text-center">
          <p className="text-foreground">Cliente não encontrado.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate("/clientes")}>
            Voltar para Clientes
          </Button>
        </div>
      </PageContainer>
    );
  }

  const persist = (next: ClientTechnicalSheet) => {
    setSheet(next);
    updateClient(client.id, { technicalSheet: next });
  };

  // overall completion: any section with content
  const filledCount = SECTIONS.filter((s) => statusOf(s.id, sheet) !== "vazio").length;
  const overallStatus: "vazio" | "parcial" | "completo" =
    filledCount === 0 ? "vazio" : filledCount >= SECTIONS.length - 1 ? "completo" : "parcial";

  return (
    <PageContainer>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => navigate("/clientes")}>
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-foreground leading-tight">
                Ficha técnica
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {client.name}
                {client.company && <span className="text-muted-foreground/70"> · {client.company}</span>}
              </p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[11px] uppercase tracking-wider", statusStyles[overallStatus])}>
            Ficha {statusLabel[overallStatus].toLowerCase()}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Centralize a inteligência da marca: branding, persona, conteúdo, acessos e materiais.
          Tudo é salvo automaticamente neste dispositivo. Upload de arquivos, cofre de senhas e
          integrações com Drive/Figma/Canva chegam em etapas futuras.
        </p>

        {/* Mobile nav */}
        <div className="lg:hidden">
          <Select value={view} onValueChange={(v) => setView(v as ViewId)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NAV.map((n) => (
                <SelectItem key={n.id} value={n.id}>{n.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Sidebar nav (desktop) */}
        <aside className="hidden lg:block">
          <nav className="sticky top-6 rounded-xl border border-border/60 bg-card/40 p-2">
            <SidebarItem
              active={view === "overview"}
              onClick={() => setView("overview")}
              label="Visão geral"
              icon={LayoutGrid}
            />
            <div className="my-2 h-px bg-border/40" />
            {SECTIONS.map((s) => {
              const st = statusOf(s.id, sheet);
              const active = view === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setView(s.id as ViewId)}
                  className={cn(
                    "w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{s.label}</span>
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      st === "completo" && "bg-emerald-500",
                      st === "parcial" && "bg-amber-500",
                      st === "vazio" && "bg-muted-foreground/30",
                    )}
                  />
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="min-w-0 rounded-xl border border-border/60 bg-card/40 p-6 sm:p-8">
          {view === "overview" && (
            <OverviewGrid sheet={sheet} onOpen={(id) => setView(id)} />
          )}
          {view === "branding" && (
            <BrandingSection value={sheet.branding ?? {}} onSave={(v) => persist({ ...sheet, branding: v })} />
          )}
          {view === "persona" && (
            <PersonaSection value={sheet.persona ?? {}} onSave={(v) => persist({ ...sheet, persona: v })} />
          )}
          {view === "editorial" && (
            <EditorialSection value={sheet.editorialLine ?? {}} onSave={(v) => persist({ ...sheet, editorialLine: v })} />
          )}
          {view === "typography" && (
            <TypographySection value={sheet.typography ?? {}} onSave={(v) => persist({ ...sheet, typography: v })} />
          )}
          {view === "social" && (
            <SocialSection value={sheet.socialLinks ?? {}} onSave={(v) => persist({ ...sheet, socialLinks: v })} />
          )}
          {view === "accesses" && (
            <AccessesSection value={sheet.accesses ?? []} onChange={(v) => persist({ ...sheet, accesses: v })} />
          )}
          {view === "competitors" && (
            <CompetitorsSection value={sheet.competitors ?? []} onChange={(v) => persist({ ...sheet, competitors: v })} />
          )}
          {view === "briefing" && (
            <BriefingSection value={sheet.briefing ?? {}} onSave={(v) => persist({ ...sheet, briefing: v })} />
          )}
          {view === "assets" && (
            <AssetsSection value={sheet.assets ?? []} onChange={(v) => persist({ ...sheet, assets: v })} />
          )}
        </main>
      </div>
    </PageContainer>
  );
}

function SidebarItem({
  active, onClick, label, icon: Icon,
}: { active: boolean; onClick: () => void; label: string; icon: any }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 opacity-50" />
    </button>
  );
}
