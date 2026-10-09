// Etapa 9 · item 3 — UI do OPT-IN da base de conhecimento do robô
// (docs/qa/etapa-9-item3-r1-base-conhecimento-liga.md). Mesmo padrão do cérebro
// (AiBrainSection): SettingsSection/SettingsCard, flag SÓ de UI, 100% Supabase.
//
// Vocabulário = comportamento real (G29/G40): só a categoria "itens já orçados"
// tem leitura implementada no servidor; as demais aparecem DESABILITADAS e dizem
// por quê — nenhum toggle promete o que o robô não faz (padrão G48).
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, ShieldAlert, Lock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsCard } from "@/components/settings/SettingsCard";
import { getBooleanFlag, setBooleanFlag } from "@/config/flags";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import {
  aiKnowledgeConsentsRepository,
  type KnowledgeConsentsState,
} from "@/repositories/aiKnowledgeConsentsRepository";
import {
  KNOWLEDGE_CATEGORIES,
  activeCategories,
  type KnowledgeCategory,
} from "../../../supabase/functions/_shared/knowledgeConsent";

interface CategoryCopy {
  title: string;
  description: string;
  /** Só "catalog" tem leitura implementada no servidor nesta versão. */
  operational: boolean;
  /** Motivo exibido quando a categoria está desabilitada. */
  unavailableReason?: string;
}

// Classificação (doc §2): A não carrega dado pessoal (nome do item + contagem/
// faixa, sem texto livre e sem cliente) e é a única operante. B tem texto livre
// que pode citar cliente E nenhum leitor — fica desabilitada. C/D/E envolvem dado
// pessoal de clientes do operador — exigem atesto de base legal e ficam
// desabilitadas nesta rodada.
const CATEGORY_COPY: Record<KnowledgeCategory, CategoryCopy> = {
  catalog: {
    title: "Itens já orçados",
    description:
      "O robô passa a conhecer os nomes dos itens/serviços que já aparecem nos seus orçamentos enviados, aprovados ou recusados e a faixa de preço unitário. " +
      "É um resumo agregado: só entram itens que aparecem em pelo menos 2 orçamentos e que não citam nenhum cliente cadastrado — nenhum nome, contato ou texto livre de orçamento é enviado. " +
      "Não é o seu catálogo de serviços: o catálogo ainda fica só neste navegador e o robô não o enxerga.",
    operational: true,
  },
  internal_ops: {
    title: "Tarefas e projetos",
    description: "Títulos e status de tarefas e projetos como contexto para o robô.",
    operational: false,
    unavailableReason:
      "Indisponível nesta versão: o robô ainda não lê esta categoria, e títulos de tarefas podem citar clientes.",
  },
  crm: {
    title: "Cadastro de clientes e CRM",
    description: "Dados dos seus clientes e oportunidades como contexto para o robô.",
    operational: false,
    unavailableReason:
      "Indisponível nesta versão. Envolve dado pessoal dos seus clientes — quando existir, vai exigir que você ateste ter base legal (LGPD) antes de ligar.",
  },
  conversations: {
    title: "Conversas de WhatsApp",
    description: "O conteúdo de conversas anteriores como contexto para o robô.",
    operational: false,
    unavailableReason:
      "Indisponível nesta versão. Envolve comunicações privadas dos seus clientes — quando existir, vai exigir que você ateste ter base legal (LGPD) antes de ligar.",
  },
  financial: {
    title: "Financeiro",
    description: "Valores e transações como contexto para o robô.",
    operational: false,
    unavailableReason:
      "Indisponível nesta versão. Envolve dado financeiro ligado a clientes — quando existir, vai exigir que você ateste ter base legal (LGPD) antes de ligar.",
  },
};

export function AiKnowledgeSection() {
  const { workspace, membership } = useCurrentWorkspace();
  const { isAdmin } = useWorkspaceRole();
  // Flag gateia SÓ esta UI — o servidor é gateado pela linha de consentimento
  // (ver BOOLEAN_FLAG_KEYS.aiKnowledgeBaseEnabled).
  const [enabled, setEnabledState] = useState(() => getBooleanFlag("aiKnowledgeBaseEnabled"));
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<KnowledgeConsentsState | null>(null);
  const [savingCategory, setSavingCategory] = useState<KnowledgeCategory | null>(null);

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      setState(await aiKnowledgeConsentsRepository.list(workspace.id));
    } catch (e) {
      toast.error("Erro ao carregar a base de conhecimento", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [enabled, load]);

  const handleToggleFlag = (next: boolean) => {
    setBooleanFlag("aiKnowledgeBaseEnabled", next);
    setEnabledState(next);
  };

  // "Efetivamente ativa" = a MESMA regra que o servidor aplica (activeCategories),
  // não só a coluna `enabled` — o que a tela mostra é o que o robô vai usar.
  const active = state ? activeCategories(state.consents) : [];

  const handleCategoryToggle = async (category: KnowledgeCategory, next: boolean) => {
    if (!workspace?.id) return;
    setSavingCategory(category);
    try {
      await aiKnowledgeConsentsRepository.setEnabled(workspace.id, category, next, membership?.user_id ?? null);
      toast.success(next ? "Base de conhecimento ligada" : "Base de conhecimento desligada");
      await load();
    } catch (e) {
      toast.error("Erro ao salvar a base de conhecimento", { description: (e as Error).message });
    } finally {
      setSavingCategory(null);
    }
  };

  const unavailable = state !== null && !state.available;

  return (
    <SettingsSection
      title="Base de conhecimento do Robô"
      description="Dados do seu workspace que o robô de IA do WhatsApp pode usar como contexto para responder. Tudo começa desligado — você liga só o que quiser."
    >
      <SettingsCard>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-500/10 border border-violet-500/25 text-violet-500 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Mostrar a base de conhecimento</p>
              <p className="text-xs text-muted-foreground">
                Mostra as categorias abaixo. Uma categoria já ligada continua valendo pro robô mesmo com este interruptor desligado.
              </p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={handleToggleFlag}
            aria-label="Mostrar a base de conhecimento"
          />
        </div>
      </SettingsCard>

      {enabled && (
        <SettingsCard>
          {loading && state === null ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  Estes dados passam a compor o contexto enviado ao provedor de IA a cada resposta do robô.
                  Ligue só o que faz sentido para o seu atendimento — você pode desligar a qualquer momento.
                </p>
              </div>

              {unavailable && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
                >
                  <Lock className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>
                    A base de conhecimento ainda não está disponível neste ambiente (a atualização do banco está
                    pendente). Nada foi alterado e o robô segue respondendo como antes.
                  </p>
                </div>
              )}

              {!isAdmin && !unavailable && (
                <p className="text-xs text-muted-foreground">
                  Só o dono ou um administrador do workspace pode ligar ou desligar estas categorias.
                </p>
              )}

              <ul className="divide-y divide-border/60">
                {KNOWLEDGE_CATEGORIES.map((category) => {
                  const copy = CATEGORY_COPY[category];
                  const isOn = active.includes(category);
                  const disabled =
                    !copy.operational || unavailable || !isAdmin || savingCategory !== null || state === null;
                  return (
                    <li key={category} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{copy.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{copy.description}</p>
                          {!copy.operational && copy.unavailableReason && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">{copy.unavailableReason}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {savingCategory === category && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                          <Switch
                            checked={copy.operational && isOn}
                            disabled={disabled}
                            onCheckedChange={(next) => handleCategoryToggle(category, next)}
                            aria-label={`Usar ${copy.title.toLowerCase()} como contexto do robô`}
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </SettingsCard>
      )}
    </SettingsSection>
  );
}
