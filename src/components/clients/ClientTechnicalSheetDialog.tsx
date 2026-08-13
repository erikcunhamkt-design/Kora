import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Save, Plus, Trash2,
  Eye, EyeOff, ShieldAlert, Copy, ExternalLink, Pencil, X, Upload, Link2, FileUp,
  CloudLightning, RefreshCw, CheckCircle2, AlertCircle, FileImage,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { clientAssetsStorage } from "@/services/storage/clientAssetsStorage";
import type {
  Client, ClientTechnicalSheet, ClientBranding, ClientPersona,
  ClientEditorialLine, ClientTypography, ClientSocialLinks, ClientAccess,
  ClientCompetitor, ClientBriefing, ClientAsset, ClientAssetType, ClientAssetAccessStatus,
} from "@/hooks/useClients";
import { CLIENT_ASSET_TYPE_LABELS, CLIENT_ASSET_ACCESS_LABELS } from "@/hooks/useClients";
import {
  FONT_SUGGESTIONS, SECTIONS, statusOf, statusStyles, statusLabel, formatBytes, readFileAsDataUrl,
  type FillStatus,
} from "@/components/clients/client-technical-sheet-helpers";

export type SectionId =
  | "overview" | "branding" | "persona" | "editorial" | "typography"
  | "social" | "accesses" | "competitors" | "briefing" | "assets";

const uid = () => Math.random().toString(36).slice(2, 10);
const isValidUrl = (u: string) => !u || /^https?:\/\//i.test(u) || /^[\w-]+(\.[\w-]+)+/.test(u);
const normUrl = (u: string) => (!u ? u : /^https?:\/\//i.test(u) || /^data:/i.test(u) ? u : `https://${u}`);

// ---- Upload local (dataURL em localStorage) ----
// Limites conservadores: localStorage costuma ter ~5MB total por origem.
export const LOGO_MAX_BYTES = 500 * 1024;        // 500 KB por logo
export const ASSET_FILE_MAX_BYTES = 1024 * 1024; // 1 MB por arquivo
export const ASSETS_QUOTA_BYTES = 5 * 1024 * 1024; // 5 MB de cota total de uploads do cliente

export function ClientTechnicalSheetDialog({
  open, onOpenChange, client, onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: Client | null;
  onSave: (clientId: number, sheet: ClientTechnicalSheet) => void;
}) {
  const [draft, setDraft] = useState<ClientTechnicalSheet>({});
  const [view, setView] = useState<SectionId>("overview");

  useEffect(() => {
    if (open && client) {
      setDraft(client.technicalSheet ?? {});
      setView("overview");
    }
  }, [open, client]);

  if (!client) return null;

  const persist = (next: ClientTechnicalSheet, toastMsg?: string) => {
    setDraft(next);
    onSave(client.id, next);
    if (toastMsg) toast.success(toastMsg);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] h-[92vh] p-0 overflow-hidden bg-card border-border flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-3">
            {view !== "overview" && (
              <Button
                variant="ghost" size="sm"
                className="gap-1 -ml-2"
                onClick={() => setView("overview")}
              >
                <ChevronLeft className="h-4 w-4" /> Ficha técnica
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-foreground text-lg flex items-center gap-2">
                Ficha técnica
                <span className="text-muted-foreground font-normal">·</span>
                <span className="text-foreground/80 font-medium truncate">{client.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs mt-1">
                Branding, persona, redes, acessos e materiais da marca. Tudo salvo localmente neste dispositivo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {view === "overview" && <OverviewGrid sheet={draft} onOpen={(id) => setView(id)} />}
          {view === "branding" && (
            <BrandingSection
              value={draft.branding ?? {}}
              onSave={(branding) => persist({ ...draft, branding }, "Branding salvo")}
              clientId={client.id}
            />
          )}
          {view === "persona" && (
            <PersonaSection
              value={draft.persona ?? {}}
              onSave={(persona) => persist({ ...draft, persona }, "Persona salva")}
            />
          )}
          {view === "editorial" && (
            <EditorialSection
              value={draft.editorialLine ?? {}}
              onSave={(editorialLine) => persist({ ...draft, editorialLine }, "Linha editorial salva")}
            />
          )}
          {view === "typography" && (
            <TypographySection
              value={draft.typography ?? {}}
              onSave={(typography) => persist({ ...draft, typography }, "Tipografia salva")}
            />
          )}
          {view === "social" && (
            <SocialSection
              value={draft.socialLinks ?? {}}
              onSave={(socialLinks) => persist({ ...draft, socialLinks }, "Redes sociais salvas")}
            />
          )}
          {view === "accesses" && (
            <AccessesSection
              value={draft.accesses ?? []}
              onChange={(accesses) => persist({ ...draft, accesses })}
            />
          )}
          {view === "competitors" && (
            <CompetitorsSection
              value={draft.competitors ?? []}
              onChange={(competitors) => persist({ ...draft, competitors })}
            />
          )}
          {view === "briefing" && (
            <BriefingSection
              value={draft.briefing ?? {}}
              onSave={(briefing) => persist({ ...draft, briefing }, "Briefing salvo")}
            />
          )}
          {view === "assets" && (
            <AssetsSection
              value={draft.assets ?? []}
              onChange={(assets) => persist({ ...draft, assets })}
              clientId={client.id}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Overview
// ============================================================

export function OverviewGrid({
  sheet, onOpen,
}: { sheet: ClientTechnicalSheet; onOpen: (id: Exclude<SectionId, "overview">) => void }) {
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SECTIONS.map((s) => {
          const st = statusOf(s.id, sheet);
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => onOpen(s.id)}
              className="text-left rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 hover:border-border transition-all p-5 group"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="h-10 w-10 rounded-lg bg-secondary/60 text-muted-foreground flex items-center justify-center group-hover:text-foreground transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <Badge variant="outline" className={cn("text-[10px] uppercase tracking-wider", statusStyles[st])}>
                  {statusLabel[st]}
                </Badge>
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">{s.label}</p>
              <p className="text-xs text-muted-foreground leading-snug">{s.subtitle}</p>
              <div className="flex items-center gap-1 text-xs text-primary mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Abrir <ChevronRight className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-6 leading-relaxed max-w-3xl">
        Integrações com Drive/Figma/Canva chegam depois. Por enquanto, registre links externos importantes.
        Upload seguro e cofre de senhas com criptografia entram em etapa futura.
      </p>
    </div>
  );
}

// ============================================================
// Section helpers
// ============================================================

function SectionShell({
  title, description, children, onSave, saving = false, hideSave = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave?: () => void;
  saving?: boolean;
  hideSave?: boolean;
}) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="space-y-5">{children}</div>
      {!hideSave && onSave && (
        <div className="flex justify-end pt-6 mt-6 border-t border-border/60">
          <Button onClick={onSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> Salvar seção
          </Button>
        </div>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  );
}

// ============================================================
// Branding
// ============================================================

export function BrandingSection({
  value,
  onSave,
  clientId,
}: {
  value: ClientBranding;
  onSave: (v: ClientBranding) => void;
  clientId?: number;
}) {
  const [local, setLocal] = useState<ClientBranding>(value);
  const [colorHex, setColorHex] = useState("#F81040");
  const [colorLabel, setColorLabel] = useState("");

  const { workspace } = useCurrentWorkspace();

  useEffect(() => {
    if (local.logoStoragePath && (!local.logoUrl || local.logoUrl.startsWith("http"))) {
      let isMounted = true;
      clientAssetsStorage.getClientAssetSignedUrl(local.logoStoragePath)
        .then((url) => {
          if (isMounted) {
            setLocal((prev) => ({ ...prev, logoUrl: url }));
          }
        })
        .catch((err) => {
          console.error("Failed to load signed URL for logo", err);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [local.logoStoragePath]); // eslint-disable-line react-hooks/exhaustive-deps

  const supabaseClientId = useMemo(() => {
    if (!clientId) return null;
    try {
      const raw = localStorage.getItem("kora.clients.supabaseImport.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        const map = parsed.importedMap || {};
        return (map[String(clientId)] as string) || null;
      }
    } catch {
      // Ignore
    }
    return null;
  }, [clientId]);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error" | "invalid" | "size_exceeded">("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [uploadedPath, setUploadedPath] = useState("");
  const [uploadedUrl, setUploadedUrl] = useState("");

  const handleUploadLogo = async (file: File) => {
    if (!workspace?.id || !supabaseClientId) {
      toast.error("Vínculo Supabase ou workspace ativo ausente.");
      return;
    }

    setUploading(true);
    setUploadStatus("idle");
    setUploadErrorMsg("");

    const validation = clientAssetsStorage.validateFile(file);
    if (!validation.valid) {
      const errorType = validation.error?.includes("tamanho") ? "size_exceeded" : "invalid";
      setUploadStatus(errorType);
      setUploadErrorMsg(validation.error || "Arquivo inválido.");
      toast.error(validation.error);
      setUploading(false);
      return;
    }

    try {
      const result = await clientAssetsStorage.uploadClientLogo(
        workspace.id,
        supabaseClientId,
        file
      );
      setUploadedPath(result.path);
      setUploadedUrl(result.url);
      setUploadStatus("success");
      toast.success("Logo enviado ao Supabase Storage com sucesso!");
    } catch (err) {
      console.error("Storage upload error:", err);
      setUploadStatus("error");
      setUploadErrorMsg("Erro ao fazer upload para o Storage.");
      toast.error("Erro ao fazer upload do logo.");
    } finally {
      setUploading(false);
    }
  };

  const addColor = (raw?: string) => {
    const c = (raw ?? (colorLabel.trim() || colorHex)).trim();
    if (!c) return;
    setLocal({ ...local, colors: [...(local.colors ?? []), c] });
    setColorLabel("");
  };
  const removeColor = (i: number) => {
    const next = [...(local.colors ?? [])];
    next.splice(i, 1);
    setLocal({ ...local, colors: next });
  };

  return (
    <SectionShell
      title="Branding"
      description="Identidade visual e tom de voz da marca."
      onSave={() => onSave(local)}
    >
      <Field label="Logo" hint="Faça upload de uma imagem (PNG/SVG/JPG, até 500 KB) ou cole uma URL pública.">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 hover:bg-secondary/70 px-3 h-11 cursor-pointer transition-colors">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-foreground">{local.logoFileName ? "Trocar arquivo" : "Enviar arquivo"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (!f.type.startsWith("image/")) { toast.error("Selecione uma imagem"); return; }
                  if (f.size > LOGO_MAX_BYTES) {
                    toast.error(`Logo acima de ${formatBytes(LOGO_MAX_BYTES)}. Otimize antes (ex: TinyPNG) ou use URL externa.`);
                    return;
                  }
                  try {
                    const dataUrl = await readFileAsDataUrl(f);
                    setLocal({
                      ...local,
                      logoUrl: dataUrl,
                      logoFileName: f.name,
                      logoFileSize: f.size,
                      logoMimeType: f.type,
                    });
                    toast.success("Logo carregado");
                  } catch {
                    toast.error("Não foi possível ler o arquivo");
                  }
                }}
              />
            </label>
            <span className="text-[11px] text-muted-foreground">ou</span>
            <Input
              className="flex-1 min-w-[200px]"
              placeholder="https://..."
              value={local.logoUrl?.startsWith("data:") ? "" : (local.logoUrl ?? "")}
              onChange={(e) =>
                setLocal({
                  ...local,
                  logoUrl: e.target.value,
                  logoFileName: undefined,
                  logoFileSize: undefined,
                  logoMimeType: undefined,
                  logoStoragePath: undefined,
                })
              }
            />
          </div>

          {/* Supabase Storage Logo Upload (Experimental V1) */}
          {workspace && supabaseClientId && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5 space-y-3 mt-1">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <CloudLightning className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold text-foreground">Enviar logo para Supabase Storage</span>
                  <Badge variant="outline" className="text-[9px] uppercase font-mono py-0 text-muted-foreground">
                    Experimental V1
                  </Badge>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background hover:bg-secondary/40 px-3 h-9 cursor-pointer transition-colors text-xs text-foreground font-medium disabled:opacity-50">
                  <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{uploading ? "Enviando..." : "Selecionar e Enviar"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) {
                        handleUploadLogo(file);
                      }
                    }}
                  />
                </label>
                <span className="text-[10px] text-muted-foreground">
                  Formatos aceitos: PNG, JPEG, WebP (Máx: 2MB). Sem SVG.
                </span>
              </div>

              {/* Upload Status / Actions */}
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                  <span>Enviando arquivo para a nuvem privada...</span>
                </div>
              )}

              {uploadStatus === "success" && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/25">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>Logo enviado com sucesso! Caminho: <code className="font-mono text-[10px] break-all">{uploadedPath}</code></span>
                  </div>
                  
                  <div className="bg-secondary/40 border border-border/50 rounded p-3 text-xs space-y-2">
                    <p className="font-semibold text-foreground">
                      Logo enviado. Deseja registrar este logo na Ficha Técnica local?
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-normal">
                      A URL assinada para visualização expira em 1 hora. O Supabase recebe apenas uma cópia de backup quando você clicar em "Salvar versão atual no Supabase".
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[11px] h-7"
                        type="button"
                        onClick={() => {
                          setUploadStatus("idle");
                          setUploadedPath("");
                          setUploadedUrl("");
                        }}
                      >
                        Apenas manter no Supabase
                      </Button>
                      <Button
                        size="sm"
                        className="text-[11px] h-7"
                        type="button"
                        onClick={() => {
                          setLocal({
                            ...local,
                            logoUrl: uploadedUrl,
                            logoFileName: `[Supabase Storage] ${uploadedPath.split("/").pop()}`,
                            logoFileSize: undefined,
                            logoMimeType: undefined,
                            logoStoragePath: uploadedPath,
                          });
                          toast.success("Logo registrado na Ficha Técnica local.");
                          setUploadStatus("idle");
                          setUploadedPath("");
                          setUploadedUrl("");
                        }}
                      >
                        Usar na Ficha Técnica local
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {(uploadStatus === "error" || uploadStatus === "invalid" || uploadStatus === "size_exceeded") && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/25">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{uploadErrorMsg || "Erro ao fazer upload do logo."}</span>
                </div>
              )}
            </div>
          )}

          {local.logoUrl ? (
            <div className="rounded-lg border border-border/60 bg-secondary/40 p-4 flex items-center gap-4">
              <img
                src={local.logoUrl}
                alt="Preview do logo"
                className="h-20 w-20 object-contain rounded-md bg-background/40 border border-border/40"
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-1">Preview</p>
                {local.logoFileName ? (
                  <p className="text-xs text-muted-foreground truncate">
                    {local.logoFileName} · {formatBytes(local.logoFileSize ?? 0)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground truncate">{local.logoUrl}</p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setLocal({
                    ...local,
                    logoUrl: undefined,
                    logoFileName: undefined,
                    logoFileSize: undefined,
                    logoMimeType: undefined,
                    logoStoragePath: undefined,
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive/80" />
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/60 bg-secondary/20 p-4 text-xs text-muted-foreground">
              Nenhum logo definido. Arquivos enviados ficam <strong>somente neste dispositivo</strong> (localStorage).
              Para sincronizar entre dispositivos, use uma URL pública (Drive/Imgur/CDN).
            </div>
          )}
        </div>
      </Field>


      <Field label="Cores da marca" hint="Escolha pelo color picker ou cole um HEX. Rótulo é opcional.">
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 h-11 cursor-pointer">
            <span className="h-6 w-6 rounded border border-border/40" style={{ backgroundColor: colorHex }} />
            <input
              type="color"
              value={colorHex}
              onChange={(e) => setColorHex(e.target.value)}
              className="sr-only"
            />
            <span className="text-xs text-muted-foreground">Picker</span>
          </label>
          <Input
            className="w-32 font-mono uppercase"
            value={colorHex}
            onChange={(e) => {
              const v = e.target.value.trim();
              setColorHex(v.startsWith("#") ? v : `#${v}`);
            }}
            placeholder="#F81040"
          />
          <Input
            className="flex-1 min-w-[160px]"
            placeholder="Rótulo opcional (ex: Magenta primário)"
            value={colorLabel}
            onChange={(e) => setColorLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addColor(colorLabel.trim() ? `${colorHex} · ${colorLabel.trim()}` : colorHex))}
          />
          <Button
            type="button"
            variant="outline"
            className="gap-1"
            onClick={() => addColor(colorLabel.trim() ? `${colorHex} · ${colorLabel.trim()}` : colorHex)}
          >
            <Plus className="h-4 w-4" /> Adicionar cor
          </Button>
        </div>
        {!!local.colors?.length && (
          <div className="flex flex-wrap gap-3 mt-4">
            {local.colors.map((c, i) => {
              const hexMatch = c.match(/#[0-9a-f]{3,8}/i);
              const swatch = hexMatch?.[0];
              return (
                <div key={i} className="group inline-flex flex-col items-stretch rounded-lg border border-border/60 bg-card/60 overflow-hidden w-32">
                  <div
                    className="h-16 w-full border-b border-border/40"
                    style={{ backgroundColor: swatch || "transparent" }}
                  />
                  <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                    <span className="text-[11px] text-foreground truncate font-mono">{c}</span>
                    <button onClick={() => removeColor(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Field>


      <Field label="Slogan">
        <Input
          value={local.slogan ?? ""}
          onChange={(e) => setLocal({ ...local, slogan: e.target.value })}
          placeholder="Ex: Sua marca, em todo lugar."
        />
      </Field>

      <Field label="Tom de voz">
        <Input
          value={local.voiceTone ?? ""}
          onChange={(e) => setLocal({ ...local, voiceTone: e.target.value })}
          placeholder="Ex: Próximo, confiante, sem jargões."
        />
      </Field>

      <Field label="Notas da marca">
        <Textarea
          rows={4}
          value={local.brandNotes ?? ""}
          onChange={(e) => setLocal({ ...local, brandNotes: e.target.value })}
          placeholder="Posicionamento, do/don't, referências internas..."
        />
      </Field>

      <div className="rounded-lg border border-dashed border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground/80">
        Arquivos enviados ficam salvos localmente neste navegador. Sincronização entre dispositivos e cofre na nuvem virão em etapa futura.
      </div>
    </SectionShell>
  );
}

// ============================================================
// Persona
// ============================================================

export function PersonaSection({ value, onSave }: { value: ClientPersona; onSave: (v: ClientPersona) => void }) {
  const [local, setLocal] = useState<ClientPersona>(value);
  return (
    <SectionShell title="Persona" description="Para quem essa marca fala?" onSave={() => onSave(local)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nome da persona">
          <Input value={local.name ?? ""} onChange={(e) => setLocal({ ...local, name: e.target.value })} placeholder="Ex: Camila, 32" />
        </Field>
        <Field label="Faixa etária">
          <Input value={local.ageRange ?? ""} onChange={(e) => setLocal({ ...local, ageRange: e.target.value })} placeholder="Ex: 25-40" />
        </Field>
      </div>
      <Field label="Dores">
        <Textarea rows={3} value={local.pains ?? ""} onChange={(e) => setLocal({ ...local, pains: e.target.value })} />
      </Field>
      <Field label="Desejos">
        <Textarea rows={3} value={local.desires ?? ""} onChange={(e) => setLocal({ ...local, desires: e.target.value })} />
      </Field>
      <Field label="Comportamento">
        <Textarea rows={3} value={local.behavior ?? ""} onChange={(e) => setLocal({ ...local, behavior: e.target.value })} />
      </Field>
      <Field label="Objeções">
        <Textarea rows={3} value={local.objections ?? ""} onChange={(e) => setLocal({ ...local, objections: e.target.value })} />
      </Field>
    </SectionShell>
  );
}

// ============================================================
// Editorial Line
// ============================================================

function ChipList({
  items, onAdd, onRemove, placeholder,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder: string;
}) {
  const [v, setV] = useState("");
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (v.trim()) { onAdd(v.trim()); setV(""); }
            }
          }}
        />
        <Button
          type="button" variant="outline" className="gap-1"
          onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(""); } }}
        >
          <Plus className="h-4 w-4" /> Adicionar
        </Button>
      </div>
      {!!items.length && (
        <div className="flex flex-wrap gap-2 mt-2">
          {items.map((it, i) => (
            <div key={i} className="inline-flex items-center gap-2 rounded-md border border-border/60 bg-secondary/40 px-2 py-1">
              <span className="text-xs text-foreground">{it}</span>
              <button onClick={() => onRemove(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditorialSection({ value, onSave }: { value: ClientEditorialLine; onSave: (v: ClientEditorialLine) => void }) {
  const [local, setLocal] = useState<ClientEditorialLine>(value);
  return (
    <SectionShell title="Linha Editorial" description="O que essa marca publica e em qual ritmo." onSave={() => onSave(local)}>
      <Field label="Pilares de conteúdo">
        <ChipList
          items={local.pillars ?? []}
          placeholder="Ex: Bastidores, Educacional, Cases..."
          onAdd={(v) => setLocal({ ...local, pillars: [...(local.pillars ?? []), v] })}
          onRemove={(i) => {
            const next = [...(local.pillars ?? [])]; next.splice(i, 1);
            setLocal({ ...local, pillars: next });
          }}
        />
      </Field>
      <Field label="Frequência de postagem">
        <Input
          value={local.postingFrequency ?? ""}
          onChange={(e) => setLocal({ ...local, postingFrequency: e.target.value })}
          placeholder="Ex: 4 posts e 12 stories por semana"
        />
      </Field>
      <Field label="Formatos preferidos">
        <ChipList
          items={local.preferredFormats ?? []}
          placeholder="Ex: Reels, Carrossel, Story..."
          onAdd={(v) => setLocal({ ...local, preferredFormats: [...(local.preferredFormats ?? []), v] })}
          onRemove={(i) => {
            const next = [...(local.preferredFormats ?? [])]; next.splice(i, 1);
            setLocal({ ...local, preferredFormats: next });
          }}
        />
      </Field>
      <Field label="Notas editoriais">
        <Textarea
          rows={4}
          value={local.contentNotes ?? ""}
          onChange={(e) => setLocal({ ...local, contentNotes: e.target.value })}
          placeholder="Tom de chamada, do/don't, palavras evitadas..."
        />
      </Field>
    </SectionShell>
  );
}

// ============================================================
// Typography
// ============================================================

export function TypographySection({ value, onSave }: { value: ClientTypography; onSave: (v: ClientTypography) => void }) {
  const [local, setLocal] = useState<ClientTypography>(value);
  const [target, setTarget] = useState<"primary" | "secondary">("primary");
  return (
    <SectionShell title="Tipografia" description="Fontes utilizadas pela marca." onSave={() => onSave(local)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Fonte primária" hint="Clique nas sugestões abaixo para preencher.">
          <Input
            list="kora-font-suggestions"
            value={local.primaryFont ?? ""}
            onChange={(e) => setLocal({ ...local, primaryFont: e.target.value })}
            onFocus={() => setTarget("primary")}
            placeholder="Ex: Inter"
          />
        </Field>
        <Field label="Fonte secundária">
          <Input
            list="kora-font-suggestions"
            value={local.secondaryFont ?? ""}
            onChange={(e) => setLocal({ ...local, secondaryFont: e.target.value })}
            onFocus={() => setTarget("secondary")}
            placeholder="Ex: Playfair Display"
          />
        </Field>
      </div>
      <datalist id="kora-font-suggestions">
        {FONT_SUGGESTIONS.map((f) => <option key={f} value={f} />)}
      </datalist>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Sugestões — clique para aplicar em <span className="text-primary font-medium">{target === "primary" ? "primária" : "secundária"}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {FONT_SUGGESTIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() =>
                setLocal(target === "primary" ? { ...local, primaryFont: f } : { ...local, secondaryFont: f })
              }
              className="rounded-md border border-border/60 bg-secondary/40 hover:bg-secondary/70 hover:border-border px-3 py-1.5 text-xs text-foreground transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      </div>


      <Field label="Links de fontes" hint="Google Fonts, arquivos de fonte em Drive, etc.">
        <ChipList
          items={local.fontLinks ?? []}
          placeholder="https://fonts.google.com/..."
          onAdd={(v) => setLocal({ ...local, fontLinks: [...(local.fontLinks ?? []), v] })}
          onRemove={(i) => {
            const next = [...(local.fontLinks ?? [])]; next.splice(i, 1);
            setLocal({ ...local, fontLinks: next });
          }}
        />
      </Field>

      <Field label="Observações">
        <Textarea
          rows={3}
          value={local.typographyNotes ?? ""}
          onChange={(e) => setLocal({ ...local, typographyNotes: e.target.value })}
          placeholder="Pesos preferidos, hierarquia, tracking..."
        />
      </Field>
    </SectionShell>
  );
}

// ============================================================
// Social Links
// ============================================================

export function SocialSection({ value, onSave }: { value: ClientSocialLinks; onSave: (v: ClientSocialLinks) => void }) {
  const [local, setLocal] = useState<ClientSocialLinks>(value);
  const [other, setOther] = useState({ label: "", url: "" });

  const setField = (k: keyof ClientSocialLinks, v: string) => setLocal({ ...local, [k]: v });

  const addOther = () => {
    if (!other.label.trim() || !other.url.trim()) {
      toast.error("Preencha rótulo e URL");
      return;
    }
    if (!isValidUrl(other.url)) {
      toast.error("URL inválida");
      return;
    }
    setLocal({
      ...local,
      otherLinks: [...(local.otherLinks ?? []), { label: other.label.trim(), url: normUrl(other.url.trim()) }],
    });
    setOther({ label: "", url: "" });
  };

  return (
    <SectionShell title="Redes Sociais" description="Onde essa marca está presente." onSave={() => onSave(local)}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Instagram"><Input value={local.instagram ?? ""} onChange={(e) => setField("instagram", e.target.value)} placeholder="https://instagram.com/..." /></Field>
        <Field label="YouTube"><Input value={local.youtube ?? ""} onChange={(e) => setField("youtube", e.target.value)} placeholder="https://youtube.com/..." /></Field>
        <Field label="TikTok"><Input value={local.tiktok ?? ""} onChange={(e) => setField("tiktok", e.target.value)} placeholder="https://tiktok.com/@..." /></Field>
        <Field label="LinkedIn"><Input value={local.linkedin ?? ""} onChange={(e) => setField("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." /></Field>
        <Field label="Facebook"><Input value={local.facebook ?? ""} onChange={(e) => setField("facebook", e.target.value)} placeholder="https://facebook.com/..." /></Field>
        <Field label="Site"><Input value={local.website ?? ""} onChange={(e) => setField("website", e.target.value)} placeholder="https://..." /></Field>
      </div>

      <Separator className="bg-border/40" />

      <Field label="Outros links">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] gap-2">
          <Input placeholder="Rótulo (ex: Pinterest)" value={other.label} onChange={(e) => setOther({ ...other, label: e.target.value })} />
          <Input placeholder="https://..." value={other.url} onChange={(e) => setOther({ ...other, url: e.target.value })} />
          <Button type="button" variant="outline" className="gap-1" onClick={addOther}>
            <Plus className="h-4 w-4" /> Adicionar
          </Button>
        </div>
        {!!local.otherLinks?.length && (
          <div className="space-y-2 mt-3">
            {local.otherLinks.map((l, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{l.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.url}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" asChild>
                    <a href={l.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => {
                      const next = [...(local.otherLinks ?? [])]; next.splice(i, 1);
                      setLocal({ ...local, otherLinks: next });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive/80" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Field>
    </SectionShell>
  );
}

// ============================================================
// Accesses
// ============================================================

export function AccessesSection({
  value, onChange,
}: { value: ClientAccess[]; onChange: (v: ClientAccess[]) => void }) {
  const [editing, setEditing] = useState<ClientAccess | null>(null);
  const [open, setOpen] = useState(false);
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const startNew = () => {
    setEditing({ id: uid(), platform: "", login: "", password: "", notes: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    setOpen(true);
  };
  const startEdit = (a: ClientAccess) => { setEditing({ ...a }); setOpen(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.platform.trim()) { toast.error("Informe a plataforma"); return; }
    const now = new Date().toISOString();
    const exists = value.some((a) => a.id === editing.id);
    const next = exists
      ? value.map((a) => a.id === editing.id ? { ...editing, updatedAt: now } : a)
      : [...value, { ...editing, updatedAt: now }];
    onChange(next);
    toast.success(exists ? "Acesso atualizado" : "Acesso adicionado");
    setOpen(false); setEditing(null);
  };

  const remove = (id: string) => {
    onChange(value.filter((a) => a.id !== id));
    toast.success("Acesso removido");
    setDeleteId(null);
  };

  return (
    <SectionShell title="Acessos" description="Logins e dados de plataformas usados pela marca." hideSave>
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200/90 leading-relaxed">
          Esta versão salva acessos <strong>localmente neste dispositivo</strong>, sem criptografia.
          Cofre seguro com criptografia ponta-a-ponta entra em etapa futura. Evite registrar senhas críticas aqui.
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> Novo acesso</Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhum acesso registrado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((a) => (
            <div key={a.id} className="rounded-lg border border-border/60 bg-card/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{a.platform}</p>
                  {a.login && (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground truncate">{a.login}</p>
                      <Button
                        size="sm" variant="ghost" className="h-6 px-2"
                        onClick={async () => { await navigator.clipboard.writeText(a.login!); toast.success("Login copiado"); }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {a.password && (
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-secondary/60 px-2 py-1 rounded border border-border/60 text-foreground font-mono">
                        {showPwd[a.id] ? a.password : "••••••••"}
                      </code>
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setShowPwd((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                        {showPwd[a.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm" variant="ghost" className="h-7 px-2"
                        onClick={async () => { await navigator.clipboard.writeText(a.password!); toast.success("Senha copiada"); }}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  {a.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{a.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive/80" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editing && value.some((a) => a.id === editing.id) ? "Editar acesso" : "Novo acesso"}</DialogTitle>
            <DialogDescription className="text-xs">
              Dados salvos localmente, sem criptografia.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Plataforma">
                <Input value={editing.platform} onChange={(e) => setEditing({ ...editing, platform: e.target.value })} placeholder="Ex: Instagram, Meta Business, Google Ads" />
              </Field>
              <Field label="Login/E-mail">
                <Input value={editing.login ?? ""} onChange={(e) => setEditing({ ...editing, login: e.target.value })} />
              </Field>
              <Field label="Senha">
                <Input type="text" value={editing.password ?? ""} onChange={(e) => setEditing({ ...editing, password: e.target.value })} placeholder="Opcional" />
              </Field>
              <Field label="Observações">
                <Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="2FA, recuperação, etc." />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
                <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover acesso?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && remove(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}

// ============================================================
// Competitors
// ============================================================

export function CompetitorsSection({
  value, onChange,
}: { value: ClientCompetitor[]; onChange: (v: ClientCompetitor[]) => void }) {
  const [editing, setEditing] = useState<ClientCompetitor | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const startNew = () => { setEditing({ id: uid(), name: "", url: "", notes: "" }); setOpen(true); };
  const startEdit = (c: ClientCompetitor) => { setEditing({ ...c }); setOpen(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error("Informe o nome"); return; }
    if (editing.url && !isValidUrl(editing.url)) { toast.error("URL inválida"); return; }
    const exists = value.some((c) => c.id === editing.id);
    const norm = { ...editing, url: editing.url ? normUrl(editing.url) : undefined };
    onChange(exists ? value.map((c) => c.id === editing.id ? norm : c) : [...value, norm]);
    toast.success(exists ? "Concorrente atualizado" : "Concorrente adicionado");
    setOpen(false); setEditing(null);
  };

  return (
    <SectionShell title="Concorrentes" description="Quem está olhando o mesmo mercado." hideSave>
      <div className="flex justify-end">
        <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> Novo concorrente</Button>
      </div>
      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhum concorrente registrado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/60 bg-card/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{c.name}</p>
                  {c.url && <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate inline-block">{c.url}</a>}
                  {c.notes && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive/80" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editing && value.some((c) => c.id === editing.id) ? "Editar concorrente" : "Novo concorrente"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <Field label="Nome"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
              <Field label="Link"><Input value={editing.url ?? ""} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." /></Field>
              <Field label="Observações"><Textarea rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
                <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover concorrente?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteId) return;
                onChange(value.filter((c) => c.id !== deleteId));
                toast.success("Concorrente removido");
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}

// ============================================================
// Briefing
// ============================================================

export function BriefingSection({ value, onSave }: { value: ClientBriefing; onSave: (v: ClientBriefing) => void }) {
  const [local, setLocal] = useState<ClientBriefing>(value);
  return (
    <SectionShell title="Briefing & Notas" description="Contexto geral do cliente e da marca." onSave={() => onSave(local)}>
      <Field label="Briefing geral">
        <Textarea rows={8} value={local.generalBriefing ?? ""} onChange={(e) => setLocal({ ...local, generalBriefing: e.target.value })} placeholder="Histórico, objetivos, posicionamento, contexto de mercado..." />
      </Field>
      <Field label="Notas adicionais">
        <Textarea rows={5} value={local.additionalNotes ?? ""} onChange={(e) => setLocal({ ...local, additionalNotes: e.target.value })} placeholder="Anotações livres, recados, alertas..." />
      </Field>
    </SectionShell>
  );
}

// ============================================================
// Assets
// ============================================================

const ASSET_TYPES: ClientAssetType[] = [
  "drive", "figma", "canva", "identidade_visual", "tipografia",
  "fotos_ensaios", "videos", "briefing", "contrato", "referencias", "redes_sociais", "outro",
];
const ASSET_ACCESS: ClientAssetAccessStatus[] = [
  "liberado", "solicitar_acesso", "publico", "privado", "expirado", "revisar",
];

export function AssetsSection({
  value,
  onChange,
  clientId,
}: {
  value: ClientAsset[];
  onChange: (v: ClientAsset[]) => void;
  clientId?: number;
}) {
  const [editing, setEditing] = useState<ClientAsset | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { workspace } = useCurrentWorkspace();

  const supabaseClientId = useMemo(() => {
    if (!clientId) return null;
    try {
      const raw = localStorage.getItem("kora.clients.supabaseImport.v1");
      if (raw) {
        const parsed = JSON.parse(raw);
        const map = parsed.importedMap || {};
        return (map[String(clientId)] as string) || null;
      }
    } catch {
      // Ignore
    }
    return null;
  }, [clientId]);

  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "success" | "error" | "invalid" | "size_exceeded">("idle");
  const [uploadErrorMsg, setUploadErrorMsg] = useState("");
  const [uploadedMaterial, setUploadedMaterial] = useState<{
    path: string;
    url: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
  } | null>(null);

  const handleUploadMaterial = async (file: File) => {
    if (!workspace?.id || !supabaseClientId) {
      toast.error("Vínculo Supabase ou workspace ativo ausente.");
      return;
    }

    setUploading(true);
    setUploadStatus("idle");
    setUploadErrorMsg("");
    setUploadedMaterial(null);

    const validation = clientAssetsStorage.validateMaterialFile(file);
    if (!validation.valid) {
      const errorType = validation.error?.includes("tamanho") ? "size_exceeded" : "invalid";
      setUploadStatus(errorType);
      setUploadErrorMsg(validation.error || "Arquivo inválido.");
      toast.error(validation.error);
      setUploading(false);
      return;
    }

    try {
      const result = await clientAssetsStorage.uploadClientMaterial(
        workspace.id,
        supabaseClientId,
        file
      );
      setUploadedMaterial(result);
      setUploadStatus("success");
      toast.success("Material enviado ao Supabase Storage com sucesso!");
    } catch (err) {
      console.error("Storage material upload error:", err);
      setUploadStatus("error");
      setUploadErrorMsg("Erro ao fazer upload do material.");
      toast.error("Erro ao fazer upload do material.");
    } finally {
      setUploading(false);
    }
  };

  const openStorageAsset = async (a: ClientAsset) => {
    if (!a.storagePath) {
      const link = document.createElement("a");
      link.href = a.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      if (a.kind === "file") {
        link.download = a.fileName || a.title || "arquivo";
      }
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    try {
      const freshUrl = await clientAssetsStorage.getClientAssetSignedUrl(a.storagePath);
      window.open(freshUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Error generating signed URL for opening asset:", err);
      toast.error("Erro ao gerar link de visualização. Tente novamente.");
    }
  };

  const usedBytes = useMemo(
    () => value.reduce((acc, a) => acc + (a.kind === "file" ? (a.fileSize ?? 0) : 0), 0),
    [value]
  );
  const remainingBytes = Math.max(0, ASSETS_QUOTA_BYTES - usedBytes);
  const quotaPct = Math.min(100, Math.round((usedBytes / ASSETS_QUOTA_BYTES) * 100));
  const quotaFull = remainingBytes <= 0;

  const startNew = () => {
    const now = new Date().toISOString();
    setEditing({
      id: uid(), title: "", type: "drive", url: "", accessStatus: "liberado",
      kind: "link", createdAt: now, updatedAt: now,
    });
    setOpen(true);
  };
  const startEdit = (a: ClientAsset) => { setEditing({ ...a, kind: a.kind ?? "link" }); setOpen(true); };

  const save = () => {
    if (!editing) return;
    if (!editing.title.trim()) { toast.error("Informe o título"); return; }
    if (!editing.url.trim()) { toast.error("Anexe um arquivo ou informe um link"); return; }
    if (editing.kind !== "file" && !isValidUrl(editing.url)) { toast.error("URL inválida"); return; }
    const now = new Date().toISOString();
    const exists = value.some((a) => a.id === editing.id);
    const norm: ClientAsset = {
      ...editing,
      url: editing.kind === "file" ? editing.url : normUrl(editing.url.trim()),
      updatedAt: now,
    };
    onChange(exists ? value.map((a) => a.id === editing.id ? norm : a) : [...value, norm]);
    toast.success(exists ? "Material atualizado" : "Material adicionado");
    setOpen(false); setEditing(null);
  };

  const handleFile = async (file: File) => {
    if (!editing) return;
    if (file.size > ASSET_FILE_MAX_BYTES) {
      toast.error(`Arquivo acima de ${formatBytes(ASSET_FILE_MAX_BYTES)}. Para maiores, use um link externo (Drive/Dropbox).`);
      return;
    }
    // se já era um arquivo neste item, libera o tamanho dele do cálculo de cota
    const previousSize = editing.kind === "file" ? (editing.fileSize ?? 0) : 0;
    if (usedBytes - previousSize + file.size > ASSETS_QUOTA_BYTES) {
      toast.error(`Cota local do cliente esgotada (${formatBytes(ASSETS_QUOTA_BYTES)}). Remova arquivos ou use links externos.`);
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setEditing({
        ...editing,
        kind: "file",
        url: dataUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
        title: editing.title || file.name.replace(/\.[^.]+$/, ""),
      });
      toast.success("Arquivo carregado");
    } catch {
      toast.error("Não foi possível ler o arquivo");
    }
  };



  return (
    <SectionShell title="Materiais e Anexos" description="Envie arquivos pequenos ou registre links externos." hideSave>
      {/* Quota */}
      <div className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground font-medium">Cota local de uploads</span>
          <span className="text-muted-foreground tabular-nums">
            {formatBytes(usedBytes)} / {formatBytes(ASSETS_QUOTA_BYTES)}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-secondary/60 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              quotaPct >= 90 ? "bg-destructive" : quotaPct >= 70 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${quotaPct}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
          Arquivos ficam salvos <strong>somente neste navegador</strong> (localStorage). Limite por arquivo:{" "}
          {formatBytes(ASSET_FILE_MAX_BYTES)}. Quando a cota esgotar, novos materiais só poderão ser adicionados como link externo
          (Drive, Dropbox, Figma…). Storage em nuvem chega em etapa futura.
        </p>
      </div>

      {/* Supabase Storage Materials Upload (Experimental V1) */}
      {workspace && supabaseClientId && (
        <div className="rounded-lg border border-primary/25 bg-primary/5 p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <CloudLightning className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Enviar material para Supabase Storage</span>
              <Badge variant="outline" className="text-[9px] uppercase font-mono py-0 text-muted-foreground">
                Experimental V1
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="inline-flex items-center gap-2 rounded-lg border border-border bg-background hover:bg-secondary/40 px-3 h-9 cursor-pointer transition-colors text-xs text-foreground font-medium disabled:opacity-50">
              <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{uploading ? "Enviando..." : "Selecionar e Enviar"}</span>
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    handleUploadMaterial(file);
                  }
                }}
              />
            </label>
            <span className="text-[10px] text-muted-foreground">
              Formatos aceitos: PDF, PNG, JPEG, WebP, TXT, DOCX, XLSX (Máx: 8MB). Sem SVG ou ZIP.
            </span>
          </div>

          {/* Upload Status / Actions */}
          {uploading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Enviando material para a nuvem privada...</span>
            </div>
          )}

          {uploadStatus === "success" && uploadedMaterial && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 p-2.5 rounded border border-emerald-500/25">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Arquivo enviado com sucesso! Caminho: <code className="font-mono text-[10px] break-all">{uploadedMaterial.path}</code></span>
              </div>
              
              <div className="bg-secondary/40 border border-border/50 rounded p-3 text-xs space-y-2">
                <p className="font-semibold text-foreground">
                  Material enviado. Deseja adicionar este item à Ficha Técnica local?
                </p>
                <p className="text-[11px] text-muted-foreground leading-normal">
                  A URL assinada para visualização expira em 1 hora. O Supabase recebe as referências permanentemente quando você salvar a Ficha Técnica na nuvem.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-7"
                    type="button"
                    onClick={() => {
                      setUploadStatus("idle");
                      setUploadedMaterial(null);
                    }}
                  >
                    Apenas manter no Supabase
                  </Button>
                  <Button
                    size="sm"
                    className="text-[11px] h-7"
                    type="button"
                    onClick={() => {
                      const now = new Date().toISOString();
                      const newItem: ClientAsset = {
                        id: uid(),
                        title: uploadedMaterial.fileName.replace(/\.[^.]+$/, ""),
                        type: "outro", // Default type
                        url: uploadedMaterial.url,
                        accessStatus: "privado", // Default access status
                        kind: "file",
                        fileName: uploadedMaterial.fileName,
                        fileSize: uploadedMaterial.fileSize,
                        mimeType: uploadedMaterial.mimeType,
                        storagePath: uploadedMaterial.path,
                        uploadedAt: now,
                        source: "storage",
                        createdAt: now,
                        updatedAt: now,
                      };
                      onChange([...value, newItem]);
                      toast.success("Material adicionado à Ficha Técnica local.");
                      setUploadStatus("idle");
                      setUploadedMaterial(null);
                    }}
                  >
                    Adicionar à Ficha Técnica local
                  </Button>
                </div>
              </div>
            </div>
          )}

          {(uploadStatus === "error" || uploadStatus === "invalid" || uploadStatus === "size_exceeded") && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/25">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{uploadErrorMsg || "Erro ao fazer upload do material."}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={startNew} className="gap-2"><Plus className="h-4 w-4" /> Novo material</Button>
      </div>

      {value.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
          Nenhum material registrado ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {value.map((a) => {
            const isFile = a.kind === "file";
            return (
              <div key={a.id} className="rounded-lg border border-border/60 bg-card/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{a.title}</p>
                      <Badge variant="outline" className="text-[10px]">{CLIENT_ASSET_TYPE_LABELS[a.type]}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CLIENT_ASSET_ACCESS_LABELS[a.accessStatus]}</Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] gap-1",
                          isFile ? "bg-primary/10 text-primary border-primary/20" : "bg-secondary/40"
                        )}
                      >
                        {isFile ? <FileUp className="h-2.5 w-2.5" /> : <Link2 className="h-2.5 w-2.5" />}
                        {isFile ? "Arquivo" : "Link"}
                      </Badge>
                    </div>
                    {isFile ? (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {a.fileName} · {formatBytes(a.fileSize ?? 0)}
                      </p>
                    ) : (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline truncate inline-block mt-1">
                        {a.url}
                      </a>
                    )}
                    {a.description && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line">{a.description}</p>}
                    {!!a.tags?.length && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {a.tags.map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isFile ? (
                      <Button size="sm" variant="ghost" onClick={() => openStorageAsset(a)} title="Visualizar / Baixar arquivo">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => openStorageAsset(a)} title="Abrir link externo">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={async () => { await navigator.clipboard.writeText(a.url); toast.success("Link copiado"); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => startEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive/80" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>{editing && value.some((a) => a.id === editing.id) ? "Editar material" : "Novo material"}</DialogTitle>
            <DialogDescription className="text-xs">
              Envie um arquivo (até {formatBytes(ASSET_FILE_MAX_BYTES)}) ou cole um link externo.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              {/* Toggle kind */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-secondary/40 border border-border/60">
                <button
                  type="button"
                  onClick={() => {
                    if (quotaFull && editing.kind !== "file") {
                      toast.error("Cota local esgotada. Use link externo.");
                      return;
                    }
                    setEditing({
                      ...editing, kind: "file",
                      url: editing.kind === "file" ? editing.url : "",
                      fileName: editing.kind === "file" ? editing.fileName : undefined,
                      fileSize: editing.kind === "file" ? editing.fileSize : undefined,
                      mimeType: editing.kind === "file" ? editing.mimeType : undefined,
                    });
                  }}
                  disabled={quotaFull && editing.kind !== "file"}
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors",
                    editing.kind === "file"
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    quotaFull && editing.kind !== "file" && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <FileUp className="h-3.5 w-3.5" /> Upload de arquivo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setEditing({
                      ...editing, kind: "link",
                      url: editing.kind === "file" ? "" : editing.url,
                      fileName: undefined, fileSize: undefined, mimeType: undefined,
                    })
                  }
                  className={cn(
                    "rounded-md px-3 py-2 text-xs font-medium flex items-center justify-center gap-2 transition-colors",
                    editing.kind !== "file" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" /> Link externo
                </button>
              </div>

              {quotaFull && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-200/90">
                  Cota local esgotada ({formatBytes(ASSETS_QUOTA_BYTES)}). Novos uploads bloqueados — adicione como link.
                </div>
              )}

              <Field label="Título"><Input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo">
                  <select
                    className="flex h-11 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={editing.type}
                    onChange={(e) => setEditing({ ...editing, type: e.target.value as ClientAssetType })}
                  >
                    {ASSET_TYPES.map((t) => <option key={t} value={t}>{CLIENT_ASSET_TYPE_LABELS[t]}</option>)}
                  </select>
                </Field>
                <Field label="Acesso">
                  <select
                    className="flex h-11 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={editing.accessStatus}
                    onChange={(e) => setEditing({ ...editing, accessStatus: e.target.value as ClientAssetAccessStatus })}
                  >
                    {ASSET_ACCESS.map((t) => <option key={t} value={t}>{CLIENT_ASSET_ACCESS_LABELS[t]}</option>)}
                  </select>
                </Field>
              </div>

              {editing.kind === "file" ? (
                <Field label="Arquivo" hint={`Limite por arquivo: ${formatBytes(ASSET_FILE_MAX_BYTES)}. Restante na cota: ${formatBytes(remainingBytes)}.`}>
                  <label className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/60 bg-secondary/30 hover:bg-secondary/50 px-4 py-3 cursor-pointer transition-colors">
                    <div className="min-w-0 flex-1">
                      {editing.fileName ? (
                        <>
                          <p className="text-sm text-foreground truncate">{editing.fileName}</p>
                          <p className="text-[11px] text-muted-foreground">{formatBytes(editing.fileSize ?? 0)}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-foreground">Selecionar arquivo</p>
                          <p className="text-[11px] text-muted-foreground">PDF, imagem, doc, etc.</p>
                        </>
                      )}
                    </div>
                    <Upload className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      className="sr-only"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (f) await handleFile(f);
                      }}
                    />
                  </label>
                </Field>
              ) : (
                <Field label="Link"><Input value={editing.url} onChange={(e) => setEditing({ ...editing, url: e.target.value })} placeholder="https://..." /></Field>
              )}

              <Field label="Descrição"><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <Field label="Tags (separadas por vírgula)">
                <Input
                  value={(editing.tags ?? []).join(", ")}
                  onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                />
              </Field>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Cancelar</Button>
                <Button onClick={save} className="gap-2"><Save className="h-4 w-4" /> Salvar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir material?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteId) return;
                onChange(value.filter((a) => a.id !== deleteId));
                toast.success("Material removido");
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SectionShell>
  );
}

export default ClientTechnicalSheetDialog;
