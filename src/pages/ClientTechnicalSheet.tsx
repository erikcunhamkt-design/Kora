/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  ChevronRight,
  LayoutGrid,
  Cloud,
  CloudOff,
  Database,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Info,
  Lock,
  CloudDownload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useClients, type ClientTechnicalSheet } from "@/hooks/useClients";
import { cn } from "@/lib/utils";
import { useSupabaseTechnicalSheet } from "@/hooks/useSupabaseTechnicalSheet";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { mapLocalToSupabaseSheet } from "@/services/technicalSheets/technicalSheetMapper";
import { mapSupabaseToLocalSheet } from "@/services/technicalSheets/supabaseTechnicalSheetToLocalMapper";
import { clientTechnicalSheetsRepository } from "@/repositories/clientTechnicalSheetsRepository";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

interface RestoreFromSupabaseDialogProps {
  supabaseSheet: any;
  localSheet: any;
  clientId: string | number;
  onRestoreConfirm: (restored: any) => void;
}

function RestoreFromSupabaseDialog({
  supabaseSheet,
  localSheet,
  clientId,
  onRestoreConfirm,
}: RestoreFromSupabaseDialogProps) {
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const hasLocal = (section: string) => {
    const data = localSheet?.[section];
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    return Object.keys(data).length > 0;
  };

  const hasSupabase = (section: string) => {
    const data = supabaseSheet?.[section];
    if (!data) return false;
    if (Array.isArray(data)) return data.length > 0;
    return Object.keys(data).length > 0;
  };

  const handleRestore = () => {
    if (!accepted) return;

    // 1. Back up current local data
    try {
      const rawBackups = localStorage.getItem("kora.technicalSheets.restoreBackups.v1");
      let backups = [];
      if (rawBackups) {
        backups = JSON.parse(rawBackups);
      }
      const newBackup = {
        clientId: String(clientId),
        backedUpAt: new Date().toISOString(),
        previousTechnicalSheet: localSheet,
        restoredFromSupabaseSheetId: supabaseSheet.id,
        supabaseUpdatedAt: supabaseSheet.updated_at,
      };
      backups = [newBackup, ...backups].slice(0, 5);
      localStorage.setItem("kora.technicalSheets.restoreBackups.v1", JSON.stringify(backups));
    } catch (e) {
      console.error("Erro ao salvar backup local:", e);
    }

    // 2. Map and Restore
    const mappedSheet = mapSupabaseToLocalSheet(supabaseSheet);
    onRestoreConfirm(mappedSheet);

    toast.success("Versão Supabase restaurada localmente. A edição principal continua local nesta etapa.");
    setOpen(false);
    setAccepted(false);
  };

  const localMaterialsCount = localSheet?.assets?.length ?? 0;
  const supabaseMaterialsCount = supabaseSheet?.materials?.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="text-xs gap-1.5 border-primary/40 hover:bg-primary/5 text-primary">
          <CloudDownload className="h-3.5 w-3.5" />
          Restaurar do Supabase
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Restaurar versão do Supabase?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            Você está prestes a substituir a Ficha Técnica local pela versão salva no Supabase. Essa ação não altera o Supabase e não apaga arquivos do Storage.
          </DialogDescription>
        </DialogHeader>

        {/* Comparação */}
        <div className="py-4 space-y-3">
          <h4 className="text-xs font-semibold text-foreground">Resumo Comparativo</h4>
          <div className="border border-border/50 rounded-lg overflow-hidden text-xs divide-y divide-border/40 bg-secondary/15">
            <div className="grid grid-cols-3 p-2 font-medium bg-muted/40 text-[10px] text-muted-foreground uppercase">
              <span>Seção</span>
              <span>Local</span>
              <span>Supabase</span>
            </div>
            
            <div className="grid grid-cols-3 p-2">
              <span className="font-medium">Branding</span>
              <span className={hasLocal("branding") ? "text-emerald-500" : "text-muted-foreground"}>{hasLocal("branding") ? "Preenchido" : "Vazio"}</span>
              <span className={hasSupabase("branding") ? "text-emerald-500" : "text-muted-foreground"}>{hasSupabase("branding") ? "Preenchido" : "Vazio"}</span>
            </div>

            <div className="grid grid-cols-3 p-2">
              <span className="font-medium">Persona</span>
              <span className={hasLocal("persona") ? "text-emerald-500" : "text-muted-foreground"}>{hasLocal("persona") ? "Preenchido" : "Vazio"}</span>
              <span className={hasSupabase("persona") ? "text-emerald-500" : "text-muted-foreground"}>{hasSupabase("persona") ? "Preenchido" : "Vazio"}</span>
            </div>

            <div className="grid grid-cols-3 p-2">
              <span className="font-medium">Linha Editorial</span>
              <span className={hasLocal("editorialLine") ? "text-emerald-500" : "text-muted-foreground"}>{hasLocal("editorialLine") ? "Preenchido" : "Vazio"}</span>
              <span className={hasSupabase("editorial") ? "text-emerald-500" : "text-muted-foreground"}>{hasSupabase("editorial") ? "Preenchido" : "Vazio"}</span>
            </div>

            <div className="grid grid-cols-3 p-2">
              <span className="font-medium">Tipografia</span>
              <span className={hasLocal("typography") ? "text-emerald-500" : "text-muted-foreground"}>{hasLocal("typography") ? "Preenchido" : "Vazio"}</span>
              <span className={hasSupabase("typography") ? "text-emerald-500" : "text-muted-foreground"}>{hasSupabase("typography") ? "Preenchido" : "Vazio"}</span>
            </div>

            <div className="grid grid-cols-3 p-2">
              <span className="font-medium">Redes Sociais</span>
              <span className={hasLocal("socialLinks") ? "text-emerald-500" : "text-muted-foreground"}>{hasLocal("socialLinks") ? "Preenchido" : "Vazio"}</span>
              <span className={hasSupabase("social_links") ? "text-emerald-500" : "text-muted-foreground"}>{hasSupabase("social_links") ? "Preenchido" : "Vazio"}</span>
            </div>

            <div className="grid grid-cols-3 p-2">
              <span className="font-medium">Materiais</span>
              <span>{localMaterialsCount} {localMaterialsCount === 1 ? "arquivo" : "arquivos"}</span>
              <span>{supabaseMaterialsCount} {supabaseMaterialsCount === 1 ? "arquivo" : "arquivos"}</span>
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground space-y-1">
            {supabaseSheet.updated_at && (
              <p>Última atualização Supabase: <span className="font-medium text-foreground">{new Date(supabaseSheet.updated_at).toLocaleString("pt-BR")}</span></p>
            )}
          </div>
        </div>

        {/* Checkbox de Confirmação */}
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border bg-card/65">
          <Checkbox id="confirm-restore" checked={accepted} onCheckedChange={(checked) => setAccepted(!!checked)} />
          <label htmlFor="confirm-restore" className="text-xs text-foreground font-medium leading-normal cursor-pointer select-none">
            Entendo que isso substituirá a versão local atual desta Ficha Técnica.
          </label>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setAccepted(false); }}>
            Cancelar
          </Button>
          <Button variant="default" size="sm" disabled={!accepted} onClick={handleRestore}>
            Restaurar versão Supabase
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ClientTechnicalSheetPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients, updateClient } = useClients();

  const client = useMemo(
    () => clients.find((c) => String(c.id) === String(clientId)) ?? null,
    [clients, clientId]
  );

  const {
    supabaseClientId,
    sheet: supabaseSheet,
    loading: supabaseLoading,
    error: supabaseError,
    refresh: refreshSupabase,
  } = useSupabaseTechnicalSheet(clientId);

  const { workspace } = useCurrentWorkspace();
  const [savingToSupabase, setSavingToSupabase] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "saving" | "synced" | "error">("idle");

  // Sync feature flag state on mount & Storage changes
  useEffect(() => {
    const checkFlag = () => {
      try {
        const saved = localStorage.getItem("kora.technicalSheets.supabaseAutoSave.enabled");
        setAutosaveEnabled(saved !== "false"); // Default to true
      } catch {
        setAutosaveEnabled(true);
      }
    };
    checkFlag();
    window.addEventListener("storage", checkFlag);
    return () => {
      window.removeEventListener("storage", checkFlag);
    };
  }, []);


  const handleSaveToSupabase = async () => {
    if (!workspace?.id || !supabaseClientId) {
      toast.error("Vínculo com o Supabase ou workspace ativo não encontrado.");
      return;
    }
    setSavingToSupabase(true);
    try {
      const payload = mapLocalToSupabaseSheet(sheet);
      await clientTechnicalSheetsRepository.upsertTechnicalSheet(
        workspace.id,
        supabaseClientId,
        payload
      );
      toast.success("Cópia da Ficha Técnica salva com sucesso no Supabase!");
      refreshSupabase();
    } catch (err) {
      console.error("Error saving technical sheet to Supabase:", err);
      toast.error("Ocorreu um erro ao salvar a cópia no Supabase.");
    } finally {
      setSavingToSupabase(false);
    }
  };

  const persist = async (next: ClientTechnicalSheet) => {
    setSheet(next);
    if (activeDataSource === "local") {
      updateClient(client.id, { technicalSheet: next });
    } else if (activeDataSource === "supabase" && autosaveEnabled) {
      if (!workspace?.id || !supabaseClientId) {
        toast.error("Vínculo com o Supabase ou workspace ativo ausente.");
        return;
      }
      setSyncStatus("saving");
      try {
        const payload = mapLocalToSupabaseSheet(next);
        await clientTechnicalSheetsRepository.upsertTechnicalSheet(
          workspace.id,
          supabaseClientId,
          payload
        );
        setSyncStatus("synced");
        refreshSupabase();
      } catch (err) {
        console.error("Autosave technical sheet to Supabase error:", err);
        setSyncStatus("error");
        toast.error("Erro no salvamento automático. Modificações estão apenas locais até re-tentativa.");
        // Rollback visual
        if (supabaseSheet) {
          const mapped = mapSupabaseToLocalSheet(supabaseSheet);
          setSheet(mapped);
        }
      }
    }
  };

  const [view, setView] = useState<ViewId>("overview");
  const [sheet, setSheet] = useState<ClientTechnicalSheet>({});

  const isExperimentalEnabled = useMemo(() => {
    try {
      const saved = localStorage.getItem("kora.technicalSheets.supabaseExperimental.enabled");
      return saved !== "false"; // Default to true if not set
    } catch {
      return true;
    }
  }, []);

  const [dataSource, setDataSource] = useState<"local" | "supabase">(() => {
    try {
      const saved = localStorage.getItem("kora.technicalSheets.dataSource.v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed[String(clientId)] === "local") {
          return "local";
        }
      }
    } catch {
      // Ignore
    }
    return "supabase";
  });

  const activeDataSource = isExperimentalEnabled ? dataSource : "local";

  // Auto-promote to supabase when client has a linked supabase ID
  useEffect(() => {
    if (supabaseClientId && dataSource === "local") {
      const saved = localStorage.getItem("kora.technicalSheets.dataSource.v1");
      const parsed = saved ? JSON.parse(saved) : {};
      if (parsed[String(clientId)] !== "local") {
        setDataSource("supabase");
      }
    }
  }, [supabaseClientId, dataSource, clientId]);


  const handleSourceChange = (newSource: "local" | "supabase") => {
    if (!isExperimentalEnabled) return;
    if (newSource === "supabase" && !supabaseClientId) {
      toast.error("Este cliente não possui vínculo com o Supabase.");
      return;
    }
    try {
      const saved = localStorage.getItem("kora.technicalSheets.dataSource.v1");
      const parsed = saved ? JSON.parse(saved) : {};
      parsed[String(clientId)] = newSource;
      localStorage.setItem("kora.technicalSheets.dataSource.v1", JSON.stringify(parsed));
    } catch (e) {
      console.error(e);
    }
    setDataSource(newSource);
    toast.success(`Fonte alterada para ${newSource === "supabase" ? "Supabase experimental" : "Local"}.`);
  };

  const hasLocalData = useMemo(() => {
    if (!sheet) return false;
    const keys = Object.keys(sheet);
    return keys.some((k) => {
      const val = (sheet as any)[k];
      if (!val) return false;
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === "object") return Object.keys(val).length > 0;
      return true;
    });
  }, [sheet]);

  const isDirty = useMemo(() => {
    if (activeDataSource !== "supabase") return false;
    if (!supabaseSheet) return hasLocalData;
    const mappedSupabase = mapSupabaseToLocalSheet(supabaseSheet);
    return JSON.stringify(sheet) !== JSON.stringify(mappedSupabase);
  }, [activeDataSource, sheet, supabaseSheet, hasLocalData]);

  useEffect(() => {
    if (activeDataSource === "supabase") {
      if (supabaseSheet) {
        const mapped = mapSupabaseToLocalSheet(supabaseSheet);
        setSheet(mapped);
      } else if (!supabaseLoading && !supabaseSheet) {
        setSheet({});
      }
    } else {
      if (client) {
        setSheet(client.technicalSheet ?? {});
      }
    }
  }, [activeDataSource, supabaseSheet, supabaseLoading, client?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          <div className="flex items-center gap-2">
            {activeDataSource === "supabase" && autosaveEnabled && (
              <>
                {syncStatus === "saving" && (
                  <Badge variant="outline" className="text-[10px] uppercase text-amber-500 border-amber-500/30 bg-amber-500/5 animate-pulse gap-1">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Sincronizando...
                  </Badge>
                )}
                {syncStatus === "synced" && (
                  <Badge variant="outline" className="text-[10px] uppercase text-emerald-500 border-emerald-500/30 bg-emerald-500/5 gap-1">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    Salvo no Supabase
                  </Badge>
                )}
                {syncStatus === "error" && (
                  <Badge variant="outline" className="text-[10px] uppercase text-destructive border-destructive/30 bg-destructive/5 gap-1">
                    <XCircle className="h-2.5 w-2.5" />
                    Erro de Sincronia
                  </Badge>
                )}
              </>
            )}
            <Badge variant="outline" className={cn("text-[11px] uppercase tracking-wider", statusStyles[overallStatus])}>
              Ficha {statusLabel[overallStatus].toLowerCase()}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground max-w-3xl">
          Centralize a inteligência da marca: branding, persona, conteúdo, acessos e materiais.
          Tudo é salvo automaticamente neste dispositivo. Upload de arquivos, cofre de senhas e
          integrações com Drive/Figma/Canva chegam em etapas futuras.
        </p>

        {/* Seletor de Fonte de Dados */}
        {isExperimentalEnabled && (
          <div className="flex flex-wrap items-center gap-4 py-3 px-4 rounded-xl border border-border bg-card/30 mt-2 justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Fonte da Ficha Técnica:</span>
              {activeDataSource === "supabase" && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 text-primary border-primary/30 bg-primary/5">
                  Supabase experimental
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={activeDataSource === "local" ? "default" : "outline"}
                className="text-xs px-3 h-8"
                type="button"
                onClick={() => handleSourceChange("local")}
              >
                Local
              </Button>
              
              <Button
                size="sm"
                variant={activeDataSource === "supabase" ? "default" : "outline"}
                className="text-xs px-3 h-8 gap-1.5"
                type="button"
                disabled={!supabaseClientId}
                onClick={() => handleSourceChange("supabase")}
              >
                Supabase experimental
                {!supabaseClientId && (
                  <Lock className="h-3 w-3 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Banner de Aviso do Modo Supabase Experimental */}
        {isExperimentalEnabled && activeDataSource === "supabase" && !supabaseError && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground mt-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Modo Supabase experimental ativo</span>
              <p className="text-muted-foreground mt-0.5 leading-normal">
                Você está visualizando a versão Supabase desta Ficha Técnica. Use com cuidado; o modo local continua disponível.
                As edições feitas aqui são temporárias e não serão salvas automaticamente. Para gravá-las permanentemente no Supabase, clique no botão <strong>"Salvar no Supabase"</strong> abaixo.
              </p>
            </div>
          </div>
        )}

        {/* Fallback de Erro de Conexão no Modo Supabase */}
        {isExperimentalEnabled && activeDataSource === "supabase" && supabaseError && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-xs text-destructive mt-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold block">Erro ao carregar dados do Supabase</span>
              <p className="opacity-90 mt-0.5 leading-normal">
                Não foi possível estabelecer contato com o Supabase ou os dados não puderam ser carregados. Deseja retornar ao modo de armazenamento local?
              </p>
              <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-destructive/30 hover:bg-destructive/10" type="button" onClick={() => handleSourceChange("local")}>
                Voltar para Local
              </Button>
            </div>
          </div>
        )}

        {/* Painel Versão Supabase */}
        <div className="rounded-xl border border-border bg-card/45 p-4 mt-2">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Versão Supabase</h3>
              {isExperimentalEnabled && (
                <Badge variant="outline" className="text-[10px] uppercase font-mono py-0 text-muted-foreground">
                  Experimental
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              <Lock className="h-3 w-3" />
              <span>Somente Leitura</span>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mb-4">
            {isExperimentalEnabled 
              ? "A edição principal desta página ainda usa dados locais. A versão Supabase é somente leitura nesta etapa."
              : "A Ficha Técnica está sendo mantida localmente neste navegador. Para habilitar o modo experimental de visualização e salvamento no Supabase, ative a opção correspondente na página de Configurações."}
          </p>

          {/* Conditional content states */}
          {!supabaseClientId ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border/40 text-xs text-muted-foreground">
              <CloudOff className="h-4 w-4 text-muted-foreground/60" />
              <span>Este cliente ainda não está vinculado ao Supabase.</span>
            </div>
          ) : supabaseLoading ? (
            <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Carregando versão do Supabase...</span>
            </div>
          ) : supabaseError ? (
            <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex-wrap">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>Erro ao carregar versão do Supabase.</span>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 hover:bg-destructive/20" onClick={() => refreshSupabase()}>
                <RefreshCw className="h-3 w-3" /> Tentar novamente
              </Button>
            </div>
          ) : !supabaseSheet ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-500/90">
              <Cloud className="h-4 w-4" />
              <span>Cliente vinculado no Supabase, mas a Ficha Técnica ainda não foi importada.</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 rounded-lg bg-secondary/35 border border-border/50">
              {/* Branding */}
              <div className="flex flex-col gap-1 p-2 rounded bg-card/40 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Branding</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {supabaseSheet.branding && Object.keys(supabaseSheet.branding).length > 0 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">Preenchido</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground">Vazio</span>
                    </>
                  )}
                </div>
              </div>

              {/* Persona */}
              <div className="flex flex-col gap-1 p-2 rounded bg-card/40 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Persona</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {supabaseSheet.persona && Object.keys(supabaseSheet.persona).length > 0 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">Preenchido</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground">Vazio</span>
                    </>
                  )}
                </div>
              </div>

              {/* Editorial */}
              <div className="flex flex-col gap-1 p-2 rounded bg-card/40 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Linha Editorial</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {supabaseSheet.editorial && Object.keys(supabaseSheet.editorial).length > 0 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">Preenchido</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground">Vazio</span>
                    </>
                  )}
                </div>
              </div>

              {/* Typography */}
              <div className="flex flex-col gap-1 p-2 rounded bg-card/40 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Tipografia</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {supabaseSheet.typography && Object.keys(supabaseSheet.typography).length > 0 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">Preenchido</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground">Vazio</span>
                    </>
                  )}
                </div>
              </div>

              {/* Social */}
              <div className="flex flex-col gap-1 p-2 rounded bg-card/40 border border-border/30">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Redes</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {supabaseSheet.social_links && Object.keys(supabaseSheet.social_links).length > 0 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">Preenchido</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground">Vazio</span>
                    </>
                  )}
                </div>
              </div>

              {/* Materials */}
              <div className="flex flex-col gap-1 p-2 rounded bg-card/40 border border-border/30 col-span-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium">Materiais</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {supabaseSheet.materials && Array.isArray(supabaseSheet.materials) && supabaseSheet.materials.length > 0 ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground">
                        {supabaseSheet.materials.length} {supabaseSheet.materials.length === 1 ? "item" : "itens"}
                      </span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-muted-foreground/45 shrink-0" />
                      <span className="text-xs text-muted-foreground">Nenhum</span>
                    </>
                  )}
                </div>
              </div>

              {/* Updated At */}
              {supabaseSheet.updated_at && (
                <div className="col-span-2 md:col-span-3 lg:col-span-6 flex items-center justify-end text-[10px] text-muted-foreground mt-1 gap-1">
                  <span>Última atualização no Supabase:</span>
                  <span className="font-medium text-foreground">
                    {new Date(supabaseSheet.updated_at).toLocaleString("pt-BR")}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação Supabase (Sincronização Manual / Backup) */}
          {isExperimentalEnabled && workspace && !supabaseLoading && !supabaseError && (
            <div className="mt-4 pt-4 border-t border-border/40 flex flex-col gap-2">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <p className="text-[11px] text-muted-foreground max-w-md">
                  A edição principal desta página ainda usa dados locais. O Supabase recebe apenas uma cópia manual ou serve para restaurar backups nesta etapa.
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Restaurar do Supabase (Apenas se houver ficha remota) */}
                  {supabaseClientId && supabaseSheet && (
                    <RestoreFromSupabaseDialog
                      supabaseSheet={supabaseSheet}
                      localSheet={sheet}
                      clientId={client.id}
                      onRestoreConfirm={(restoredSheet) => {
                        persist(restoredSheet);
                      }}
                    />
                  )}

                  {/* Salvar no Supabase */}
                  {!supabaseClientId ? (
                    <div className="flex flex-col items-end gap-1">
                      <Button size="sm" variant="outline" disabled className="text-xs">
                        Salvar versão atual no Supabase
                      </Button>
                      <span className="text-[10px] text-amber-500 font-medium">
                        Importe o cliente para o Supabase antes de salvar a Ficha Técnica.
                      </span>
                    </div>
                  ) : !hasLocalData ? (
                    <div className="flex flex-col items-end gap-1">
                      <Button size="sm" variant="outline" disabled className="text-xs">
                        Salvar versão atual no Supabase
                      </Button>
                      <span className="text-[10px] text-muted-foreground">
                        Preencha dados locais antes de salvar no Supabase.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {activeDataSource === "supabase" && isDirty && (
                        <span className="text-[10px] text-amber-500 font-medium animate-pulse shrink-0">
                          ⚠️ Alterações pendentes
                        </span>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" className="text-xs gap-1.5" disabled={savingToSupabase}>
                            <RefreshCw className={cn("h-3.5 w-3.5", savingToSupabase && "animate-spin")} />
                            Salvar versão atual no Supabase
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Salvar cópia no Supabase?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação enviará a versão local atual da Ficha Técnica para o Supabase. A edição principal continuará local nesta etapa.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleSaveToSupabase}>
                              Salvar no Supabase
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

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
            <BrandingSection value={sheet.branding ?? {}} onSave={(v) => persist({ ...sheet, branding: v })} clientId={Number(clientId)} />
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
            <AssetsSection value={sheet.assets ?? []} onChange={(v) => persist({ ...sheet, assets: v })} clientId={Number(clientId)} />
          )}
        </main>
      </div>
    </PageContainer>
  );
}

function SidebarItem({ active, onClick, label, icon: Icon }: { active: boolean; onClick: () => void; label: string; icon: LucideIcon }) {
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
