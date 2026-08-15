// Etapa 9 · item 2 — UI do "Cérebro" do robô. Padrão SettingsSection/
// SettingsCard, precedente de layout: seção "Empresa" (Configuracoes.tsx) —
// mecanismo 100% Supabase, NÃO localStorage (ao contrário da seção Empresa,
// que é local-only; ver docs/architecture/etapa-9-item2-cerebro-fase-a.md
// §4, ressalva explícita de não repetir esse padrão aqui).
import { useEffect, useState } from "react";
import { BrainCircuit, Loader2, Save, ShieldAlert } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { getBooleanFlag, setBooleanFlag } from "@/config/flags";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { aiBrainRepository, type AiBrainProfileFields } from "@/repositories/aiBrainRepository";

const EMPTY_FIELDS: AiBrainProfileFields = {
  tone: "",
  talk_about: "",
  dont_talk_about: "",
  products_services: "",
  limits: "",
};

// Etapa 9 · item 2 §3.3 do desenho — soft-cap de ENGENHARIA (custo de
// contexto/token), nunca bloqueia salvar, só avisa. Soma os 5 campos.
const SOFT_CAP_CHARS = 2000;

export function AiBrainSection() {
  const { workspace } = useCurrentWorkspace();
  // Flag gateia SÓ esta UI (mostrar/ocultar o formulário) — a composição no
  // servidor não lê esta flag, é gateada pela existência do perfil
  // (whatsapp-bot-reply/index.ts). Ver comentário em BOOLEAN_FLAG_KEYS.aiBrainEnabled.
  const [enabled, setEnabledState] = useState(() => getBooleanFlag("aiBrainEnabled"));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<AiBrainProfileFields>(EMPTY_FIELDS);

  useEffect(() => {
    if (!enabled || !workspace?.id) return;
    let cancelled = false;
    setLoading(true);
    aiBrainRepository
      .getByWorkspace(workspace.id)
      .then((profile) => {
        if (cancelled || !profile) return;
        setFields({
          tone: profile.tone ?? "",
          talk_about: profile.talk_about ?? "",
          dont_talk_about: profile.dont_talk_about ?? "",
          products_services: profile.products_services ?? "",
          limits: profile.limits ?? "",
        });
      })
      .catch((e) => toast.error("Erro ao carregar o cérebro do robô", { description: (e as Error).message }))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, workspace?.id]);

  const handleToggle = (next: boolean) => {
    setBooleanFlag("aiBrainEnabled", next);
    setEnabledState(next);
  };

  const updateField = (key: keyof AiBrainProfileFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const totalChars = Object.values(fields).reduce((sum: number, v) => sum + (v?.length ?? 0), 0);
  const overSoftCap = totalChars > SOFT_CAP_CHARS;

  const handleSave = async () => {
    if (!workspace?.id) return;
    setSaving(true);
    try {
      await aiBrainRepository.upsert(workspace.id, fields);
      toast.success("Cérebro do robô salvo com sucesso!");
    } catch (e) {
      toast.error("Erro ao salvar o cérebro do robô", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title="Cérebro do Robô"
      description="Instruções gerais sobre a sua empresa que o robô de IA do WhatsApp usa para responder — complementa (não substitui) o campo &quot;Instruções de Personalidade&quot; do construtor de fluxo."
    >
      <SettingsCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-500 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ativar cérebro do robô</p>
              <p className="text-xs text-muted-foreground">
                Mostra o formulário abaixo. Um perfil já salvo continua valendo pro robô mesmo com este interruptor desligado.
              </p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={handleToggle} aria-label="Ativar cérebro do robô" />
        </div>
      </SettingsCard>

      {enabled && (
        <SettingsCard>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Não repita aqui o que já está em "Instruções de Personalidade" do fluxo — evita duplicação.
                  E nunca inclua dado de um cliente específico, nome real, telefone ou qualquer informação
                  pessoal de terceiro — este campo é sobre a EMPRESA, não sobre pessoas.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Tom de voz
                </label>
                <Textarea
                  value={fields.tone ?? ""}
                  onChange={(e) => updateField("tone", e.target.value)}
                  placeholder="Ex.: formal e direto / descontraído, usa emoji"
                  className="min-h-[60px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Fale sobre
                </label>
                <Textarea
                  value={fields.talk_about ?? ""}
                  onChange={(e) => updateField("talk_about", e.target.value)}
                  placeholder="Produtos, diferenciais e argumentos que o robô pode usar"
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Não fale sobre
                </label>
                <Textarea
                  value={fields.dont_talk_about ?? ""}
                  onChange={(e) => updateField("dont_talk_about", e.target.value)}
                  placeholder="Ex.: preços de concorrentes, prazos que não podemos garantir"
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Produtos/serviços
                </label>
                <Textarea
                  value={fields.products_services ?? ""}
                  onChange={(e) => updateField("products_services", e.target.value)}
                  placeholder="Descrição livre dos produtos/serviços oferecidos"
                  className="min-h-[80px] text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Limites
                </label>
                <Textarea
                  value={fields.limits ?? ""}
                  onChange={(e) => updateField("limits", e.target.value)}
                  placeholder="Ex.: não fecha vendas, só qualifica / não dá desconto sem aprovação"
                  className="min-h-[60px] text-sm"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className={`text-xs ${overSoftCap ? "text-amber-500" : "text-muted-foreground"}`}>
                  {totalChars} / {SOFT_CAP_CHARS} caracteres
                  {overSoftCap && " — acima do recomendado, considere resumir (não bloqueia salvar)"}
                </p>
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </SettingsCard>
      )}
    </SettingsSection>
  );
}
