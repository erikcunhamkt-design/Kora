import { useEffect, useState, useMemo } from "react";
import { Check, ChevronDown, ChevronUp, EyeOff, Sparkles, UserPlus, FileText, TrendingUp, Calendar, Receipt, ClipboardCheck } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/useClients";
import { useLeads } from "@/hooks/useLeads";
import { useQuotes } from "@/hooks/useQuotes";
import { useFinance } from "@/hooks/useFinance";
import { useProjects } from "@/hooks/useProjects";
import { useNavigate } from "react-router-dom";

export interface OnboardingState {
  seen: boolean;
  dismissed: boolean;
  minimized: boolean;
  completedSteps: string[];
  updatedAt: string;
}

const STORAGE_KEY = "kora.onboarding.v1";
const DAYCENTER_OPENED_KEY = "kora.daycenter.opened.v1";

const DEFAULT_STATE: OnboardingState = {
  seen: false,
  dismissed: false,
  minimized: false,
  completedSteps: [],
  updatedAt: new Date().toISOString(),
};

export function KoraOnboarding() {
  const navigate = useNavigate();
  
  // Hooks de dados para verificar status real em tempo real
  const { clients } = useClients();
  const { leads } = useLeads();
  const { quotes } = useQuotes();
  const { transactions } = useFinance();
  const { projects } = useProjects();

  const [state, setState] = useState<OnboardingState>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  const [daycenterOpened, setDaycenterOpened] = useState(() => {
    try {
      return localStorage.getItem(DAYCENTER_OPENED_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Listener para atualizações externas (por exemplo, ao abrir a Central do Dia ou nas Configurações)
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setState(JSON.parse(raw));
        setDaycenterOpened(localStorage.getItem(DAYCENTER_OPENED_KEY) === "true");
      } catch { /* noop */ }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("kora:onboarding:refresh", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("kora:onboarding:refresh", handleStorageChange);
    };
  }, []);

  const saveState = (next: OnboardingState) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // Disparar evento para sincronizar outros componentes que possam estar ouvindo
      window.dispatchEvent(new Event("kora:onboarding:refresh"));
    } catch { /* noop */ }
  };

  // 1. Cadastrar primeiro cliente
  const step1 = useMemo(() => {
    return clients.some((c) => !c.isDemo);
  }, [clients]);

  // 2. Preencher Ficha Técnica
  const step2 = useMemo(() => {
    return clients.some((c) => {
      if (c.isDemo) return false;
      const ts = c.technicalSheet;
      if (!ts) return false;
      
      const hasBranding = ts.branding && (ts.branding.voiceTone || ts.branding.slogan || (ts.branding.colors && ts.branding.colors.length > 0));
      const hasPersona = ts.persona && (ts.persona.name || ts.persona.desires || ts.persona.pains);
      const hasAssets = ts.assets && ts.assets.length > 0;
      
      return !!(hasBranding || hasPersona || hasAssets);
    });
  }, [clients]);

  // 3. Criar oportunidade
  const step3 = useMemo(() => {
    return leads.some((l) => !l.isDemo);
  }, [leads]);

  // 4. Criar orçamento
  const step4 = useMemo(() => {
    return quotes.some((q) => !q.isDemo);
  }, [quotes]);

  // 5. Gerar recebível ou projeto
  const step5 = useMemo(() => {
    const hasFinance = transactions.some((t) => !t.isDemo && t.source === "quote");
    const hasProject = projects.some((p) => !p.isDemo && p.quoteId);
    return hasFinance || hasProject;
  }, [transactions, projects]);

  // 6. Usar Central do Dia
  const step6 = daycenterOpened;

  const steps = [
    {
      id: "step1",
      title: "Cadastrar primeiro cliente",
      description: "Adicione seu primeiro cliente real para centralizar o histórico e contatos.",
      completed: step1,
      cta: "Novo cliente",
      icon: UserPlus,
      action: () => navigate("/clientes"),
    },
    {
      id: "step2",
      title: "Preencher Ficha Técnica básica",
      description: "Defina marca, persona ou anexe arquivos essenciais no perfil do cliente.",
      completed: step2,
      cta: "Abrir cliente / Ficha Técnica",
      icon: ClipboardCheck,
      action: () => navigate("/clientes"),
    },
    {
      id: "step3",
      title: "Criar oportunidade",
      description: "Alimente seu CRM criando uma nova oportunidade de negócio ou lead.",
      completed: step3,
      cta: "Nova oportunidade",
      icon: TrendingUp,
      action: () => navigate("/crm?newOpportunity=1"),
    },
    {
      id: "step4",
      title: "Criar orçamento",
      description: "Gere sua primeira proposta comercial premium para enviar ao cliente.",
      completed: step4,
      cta: "Novo orçamento",
      icon: FileText,
      action: () => navigate("/vendas?tab=orcamentos&newQuote=1"),
    },
    {
      id: "step5",
      title: "Gerar recebível ou projeto",
      description: "Aprove um orçamento para criar um projeto ou lançar uma conta a receber.",
      completed: step5,
      cta: "Ver orçamentos",
      icon: Receipt,
      action: () => navigate("/vendas?tab=orcamentos"),
    },
    {
      id: "step6",
      title: "Usar Central do Dia",
      description: "Acesse o painel inteligente para visualizar suas tarefas e prioridades diárias.",
      completed: step6,
      cta: "Abrir Central do Dia",
      icon: Calendar,
      action: () => {
        try {
          localStorage.setItem(DAYCENTER_OPENED_KEY, "true");
          window.dispatchEvent(new Event("kora:open-day"));
          setDaycenterOpened(true);
        } catch { /* noop */ }
      },
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);
  const allCompleted = completedCount === steps.length;

  if (state.dismissed) return null;

  // Render compacto quando tudo estiver completo
  if (allCompleted) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 flex items-center justify-between animate-fade-up">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Check className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[0.9375rem] font-bold text-foreground">Setup inicial concluído!</p>
            <p className="text-xs text-muted-foreground/80 font-normal">KORA configurado com sucesso para a sua operação.</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => saveState({ ...state, dismissed: true, updatedAt: new Date().toISOString() })}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          Ocultar
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/20 bg-card/25 backdrop-blur-xs overflow-hidden animate-fade-up">
      {/* Header do checklist */}
      <div className="p-5 flex items-center justify-between border-b border-border/10">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[0.9375rem] font-bold text-foreground">Comece pelo essencial</h3>
            <p className="text-xs text-muted-foreground/80 mt-0.5 font-normal">
              Configure sua operação em poucos passos e transforme o KORA no seu cockpit comercial e operacional.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => saveState({ ...state, minimized: !state.minimized, updatedAt: new Date().toISOString() })}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-border/10 rounded-lg"
          >
            {state.minimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (window.confirm("Deseja ocultar o checklist? Você pode reativá-lo a qualquer momento nas Configurações.")) {
                saveState({ ...state, dismissed: true, updatedAt: new Date().toISOString() });
              }
            }}
            className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-border/10 rounded-lg"
          >
            <EyeOff className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progresso Geral */}
      <div className="px-5 py-4 border-b border-border/10 bg-muted/[0.02]">
        <div className="flex items-center justify-between text-xs text-muted-foreground/80 mb-2 font-semibold">
          <span>Progresso da ativação</span>
          <span className="tabular-nums font-bold text-foreground">{completedCount} de {steps.length} concluídos ({progressPct}%)</span>
        </div>
        <Progress value={progressPct} className="h-1 bg-border/10" />
      </div>

      {/* Lista de passos (se não minimizado) */}
      {!state.minimized && (
        <div className="divide-y divide-border/10">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.id}
                className={`p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all duration-300 ${
                  step.completed ? "bg-muted/[0.01] opacity-60" : "hover:bg-muted/[0.03]"
                }`}
              >
                <div className="flex gap-3.5">
                  <div
                    className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 ${
                      step.completed
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : "bg-background/40 border-border/30 text-muted-foreground"
                    }`}
                  >
                    {step.completed ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${step.completed ? "text-muted-foreground/80 line-through" : "text-foreground"}`}>
                      {step.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground/75 leading-normal mt-0.5 font-normal">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex items-center sm:justify-end pl-11 sm:pl-0">
                  {step.completed ? (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5" /> Concluído
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      onClick={step.action}
                      className="h-8 text-[11px] font-bold tracking-wide uppercase bg-primary/15 text-white border border-primary/30 hover:bg-primary/25 transition-all duration-300"
                    >
                      {step.cta}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
