import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Loader2, CheckCircle2, ShieldCheck, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";
import { useWhatsAppOfficial } from "@/hooks/useWhatsAppOfficial";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { toastError } from "@/lib/supabase/errors";

const WEBHOOK_URL = `https://ewamvzncsloagtcvkbxv.supabase.co/functions/v1/whatsapp-official-webhook`;
const ADMIN_ONLY_MESSAGE = "Apenas administradores do workspace podem alterar esta configuração.";

export function OfficialWhatsAppCard() {
  // G71 (adendo de backlog de UI) — 3ª tela do backlog: mesmo achado do
  // WhatsAppBotConfig/VertexAIConnectionCard, mas AQUI a escrita já era o
  // precedente que o G71 citou pro RLS admin-gated (whatsapp_official_
  // credentials) — e mesmo essa tela nunca teve gate de papel na UI. Nota:
  // diferente das outras 2, esta tela nunca fala direto com a tabela — todo
  // save/verify/remove passa pela edge function whatsapp-official-
  // credentials (useWhatsAppOfficial.ts, supabase.functions.invoke) — o
  // gate de UI aqui é uma melhoria própria, não uma duplicação 1:1 da RLS
  // (que se aplica a chamadas PostgREST diretas, não à function).
  const { isAdmin } = useWorkspaceRole();
  const { credentials, loading, busy, save, verify, remove } = useWhatsAppOfficial();
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [appSecret, setAppSecret] = useState("");

  useEffect(() => {
    if (credentials) {
      setPhoneNumberId(credentials.phone_number_id);
      setWabaId(credentials.waba_id);
      setAccessToken("");
      setAppSecret("");
    }
  }, [credentials]);

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSave = async () => {
    if (!phoneNumberId.trim() || !wabaId.trim()) {
      toast.error("Phone Number ID e WABA ID são obrigatórios");
      return;
    }
    if (!credentials && !accessToken.trim()) {
      toast.error("Access Token é obrigatório");
      return;
    }
    try {
      await save({
        phone_number_id: phoneNumberId.trim(),
        waba_id: wabaId.trim(),
        access_token: accessToken.trim() || undefined,
        app_secret: appSecret.trim() || null,
      });
      toast.success("Credenciais salvas");
    } catch (e) {
      // G71 (adendo): erro cru trocado pelo normalizador ja existente
      // (src/lib/supabase/errors.ts).
      toastError(e, "Falha ao salvar");
    }
  };

  const handleVerify = async () => {
    try {
      await verify();
      toast.success("Conexão verificada com a Meta");
    } catch (e) {
      toastError(e, "Falha na verificação");
    }
  };

  const handleRemove = async () => {
    try {
      await remove();
      setPhoneNumberId(""); setWabaId(""); setAccessToken(""); setAppSecret("");
      toast.success("Credenciais removidas");
    } catch (e) {
      toastError(e, "Falha ao remover");
    }
  };

  if (loading) {
    return (
      <Card className="p-5 flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <TooltipProvider>
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            WhatsApp Cloud API (Meta Oficial)
            {credentials?.status === "verified" && (
              <Badge className="bg-success/15 text-success border-success/30">
                <CheckCircle2 className="h-3 w-3" /> Verificado
              </Badge>
            )}
            {credentials?.status === "configured" && (
              <Badge variant="outline">Configurado</Badge>
            )}
            {!credentials && <Badge variant="secondary">Não configurado</Badge>}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {credentials?.display_phone_number
              ? `Número: ${credentials.display_phone_number}${credentials.verified_name ? ` · ${credentials.verified_name}` : ""}`
              : "Use suas próprias credenciais da Meta para enviar e receber mensagens oficiais."}
          </p>
        </div>
        {credentials && (isAdmin ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={busy}>
                <Trash2 className="h-4 w-4" /> Remover
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover credenciais oficiais?</AlertDialogTitle>
                <AlertDialogDescription>
                  As credenciais serão apagadas e o provedor ativo voltará para uazapi.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRemove}>Remover</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" size="sm" disabled title={ADMIN_ONLY_MESSAGE} className="opacity-60 cursor-not-allowed">
                  <Lock className="h-4 w-4" /> Remover
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{ADMIN_ONLY_MESSAGE}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="off-phone-id" className="text-xs">Phone Number ID</Label>
          <Input
            id="off-phone-id"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="ex.: 1234567890"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="off-waba-id" className="text-xs">WhatsApp Business Account ID</Label>
          <Input
            id="off-waba-id"
            value={wabaId}
            onChange={(e) => setWabaId(e.target.value)}
            placeholder="ex.: 9876543210"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="off-token" className="text-xs">Permanent Access Token</Label>
          <Input
            id="off-token"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={credentials ? "•••• salvo (deixe em branco para manter)" : "EAAG..."}
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="off-secret" className="text-xs">App Secret (opcional, valida assinatura do webhook)</Label>
          <Input
            id="off-secret"
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            placeholder={credentials?.has_app_secret ? "•••• salvo" : "opcional"}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {isAdmin ? (
          <Button onClick={handleSave} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {credentials ? "Atualizar credenciais" : "Salvar credenciais"}
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button disabled title={ADMIN_ONLY_MESSAGE} className="opacity-60 cursor-not-allowed">
                  <Lock className="h-4 w-4" />
                  {credentials ? "Atualizar credenciais" : "Salvar credenciais"}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{ADMIN_ONLY_MESSAGE}</TooltipContent>
          </Tooltip>
        )}
        {credentials && (isAdmin ? (
          <Button variant="outline" onClick={handleVerify} disabled={busy}>
            <CheckCircle2 className="h-4 w-4" /> Testar conexão
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button variant="outline" disabled title={ADMIN_ONLY_MESSAGE} className="opacity-60 cursor-not-allowed">
                  <Lock className="h-4 w-4" /> Testar conexão
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{ADMIN_ONLY_MESSAGE}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      {credentials && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Configure no Meta Developer Portal</p>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Callback URL</Label>
            <div className="flex gap-2">
              <Input readOnly value={WEBHOOK_URL} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(WEBHOOK_URL, "URL")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Verify Token</Label>
            <div className="flex gap-2">
              <Input readOnly value={credentials.verify_token} className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => copy(credentials.verify_token, "Verify Token")}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Em <strong>WhatsApp → Configuration → Webhook</strong>, cole a URL e o Verify Token, depois inscreva os campos <code>messages</code>.
          </p>
        </div>
      )}
    </Card>
    </TooltipProvider>
  );
}
