import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles, ArrowRight, ArrowLeft, RotateCcw, Check, LifeBuoy, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export type PlanRec = "free" | "pro" | "studio" | "scale";

const STORAGE_KEY = "kora.plan.recommendation.v1";

type Answer = string;
type MultiAnswer = string[];

interface SavedRec {
  plan: PlanRec;
  reasons: string[];
  answers: Record<string, Answer | MultiAnswer>;
  savedAt: string;
}

const PLAN_LABEL: Record<PlanRec, string> = {
  free: "Free",
  pro: "Pro",
  studio: "Studio",
  scale: "Scale / Agency",
};

const PLAN_PITCH: Record<PlanRec, string> = {
  free: "Ideal para começar a organizar seus primeiros clientes e tarefas.",
  pro: "Para profissionais solo ou pequenos estúdios que precisam de CRM, financeiro e automações.",
  studio: "Para estúdios com equipe pequena/média, portal do cliente e recursos premium.",
  scale: "Para agências de alto volume, com múltiplos membros, permissões e suporte prioritário.",
};

const PLAN_BENEFITS: Record<PlanRec, string[]> = {
  free: ["CRM essencial", "Tarefas e Central do Dia", "Notificações no app"],
  pro: ["Clientes e projetos ilimitados", "Financeiro completo", "Automações e integrações"],
  studio: ["Tudo do Pro", "Portal do Cliente (em breve)", "Relatórios premium", "Personalização de marca"],
  scale: ["Tudo do Studio", "Membros e permissões avançadas", "Suporte prioritário dedicado", "Relatórios por equipe"],
};

interface Step {
  id: string;
  question: string;
  multi?: boolean;
  options: { value: string; label: string }[];
}

const STEPS: Step[] = [
  {
    id: "work",
    question: "Como você trabalha hoje?",
    options: [
      { value: "solo", label: "Sozinho" },
      { value: "small", label: "Com equipe pequena" },
      { value: "agency", label: "Agência / time maior" },
    ],
  },
  {
    id: "clients",
    question: "Quantos clientes ativos você gerencia?",
    options: [
      { value: "1-3", label: "1 a 3" },
      { value: "4-10", label: "4 a 10" },
      { value: "11-30", label: "11 a 30" },
      { value: "30+", label: "Mais de 30" },
    ],
  },
  {
    id: "projects",
    question: "Quantos projetos ou entregas você toca por mês?",
    options: [
      { value: "few", label: "Poucos" },
      { value: "some", label: "Alguns" },
      { value: "many", label: "Muitos" },
      { value: "high", label: "Alto volume" },
    ],
  },
  {
    id: "focus",
    question: "O que você mais precisa resolver agora?",
    options: [
      { value: "organize", label: "Organizar clientes e tarefas" },
      { value: "sales", label: "Vender e acompanhar leads" },
      { value: "finance", label: "Controlar financeiro" },
      { value: "team", label: "Escalar equipe" },
      { value: "automation", label: "Automatizar atendimento" },
    ],
  },
  {
    id: "advanced",
    question: "Você pretende usar recursos avançados?",
    multi: true,
    options: [
      { value: "ai", label: "IA" },
      { value: "automations", label: "Automações" },
      { value: "portal", label: "Portal do Cliente" },
      { value: "reports", label: "Relatórios" },
      { value: "integrations", label: "Integrações" },
    ],
  },
  {
    id: "users",
    question: "Você precisa de mais de um usuário?",
    options: [
      { value: "no", label: "Não" },
      { value: "3", label: "Sim, até 3" },
      { value: "10", label: "Sim, 4 a 10" },
      { value: "10+", label: "Sim, mais de 10" },
    ],
  },
];

function computeRecommendation(answers: Record<string, Answer | MultiAnswer>): { plan: PlanRec; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const work = answers.work as string;
  if (work === "agency") { score += 3; reasons.push("você atua como agência ou time maior"); }
  else if (work === "small") { score += 2; reasons.push("você trabalha com uma equipe pequena"); }
  else if (work === "solo") { score += 0; }

  const clients = answers.clients as string;
  if (clients === "30+") { score += 3; reasons.push("gerencia mais de 30 clientes ativos"); }
  else if (clients === "11-30") { score += 2; reasons.push("gerencia entre 11 e 30 clientes"); }
  else if (clients === "4-10") { score += 1; reasons.push("gerencia entre 4 e 10 clientes"); }

  const projects = answers.projects as string;
  if (projects === "high") { score += 3; reasons.push("toca um alto volume de projetos por mês"); }
  else if (projects === "many") { score += 2; }
  else if (projects === "some") { score += 1; }

  const focus = answers.focus as string;
  if (focus === "team") { score += 2; reasons.push("precisa escalar a equipe"); }
  else if (focus === "automation") { score += 1; reasons.push("quer automatizar processos"); }
  else if (focus === "sales" || focus === "finance") { score += 1; }

  const advanced = (answers.advanced as string[]) || [];
  score += advanced.length;
  if (advanced.includes("portal") || advanced.includes("reports")) {
    reasons.push("quer recursos premium como portal e relatórios");
  } else if (advanced.length >= 2) {
    reasons.push("quer usar recursos avançados como IA e automações");
  }

  const users = answers.users as string;
  if (users === "10+") { score += 4; reasons.push("precisa de mais de 10 usuários"); }
  else if (users === "10") { score += 2; reasons.push("precisa de 4 a 10 usuários"); }
  else if (users === "3") { score += 1; }

  let plan: PlanRec = "free";
  if (score >= 10) plan = "scale";
  else if (score >= 6) plan = "studio";
  else if (score >= 2) plan = "pro";

  // Top 3 reasons
  return { plan, reasons: reasons.slice(0, 3) };
}

function loadSaved(): SavedRec | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedRec) : null;
  } catch {
    return null;
  }
}

export function PlanAdvisor({ onSeePlan }: { onSeePlan?: (plan: PlanRec) => void }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<SavedRec | null>(null);

  useEffect(() => {
    setSaved(loadSaved());
  }, []);

  return (
    <>
      {saved ? (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Crown className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                Plano recomendado para você
              </p>
              <p className="text-lg font-semibold text-foreground">{PLAN_LABEL[saved.plan]}</p>
              {saved.reasons[0] && (
                <p className="text-xs text-muted-foreground truncate">Porque {saved.reasons[0]}.</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" /> Refazer diagnóstico
            </Button>
            <Button size="sm" onClick={() => onSeePlan?.(saved.plan)} className="gap-1.5">
              Ver plano <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-foreground">Encontre o plano ideal</p>
              <p className="text-xs text-muted-foreground">
                Responda algumas perguntas e veja qual plano combina com seu momento.
              </p>
            </div>
          </div>
          <Button onClick={() => setOpen(true)} className="gap-1.5 shrink-0">
            Começar diagnóstico <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AdvisorDialog
        open={open}
        onOpenChange={setOpen}
        onComplete={(rec, answers) => {
          const data: SavedRec = {
            plan: rec.plan,
            reasons: rec.reasons,
            answers,
            savedAt: new Date().toISOString(),
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          setSaved(data);
        }}
        onSeePlan={(p) => {
          setOpen(false);
          onSeePlan?.(p);
        }}
      />
    </>
  );
}

function AdvisorDialog({
  open,
  onOpenChange,
  onComplete,
  onSeePlan,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: (rec: { plan: PlanRec; reasons: string[] }, answers: Record<string, Answer | MultiAnswer>) => void;
  onSeePlan: (p: PlanRec) => void;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer | MultiAnswer>>({});
  const [done, setDone] = useState<{ plan: PlanRec; reasons: string[] } | null>(null);

  useEffect(() => {
    if (open) {
      setStep(0);
      setAnswers({});
      setDone(null);
    }
  }, [open]);

  const total = STEPS.length;
  const current = STEPS[step];
  const progress = done ? 100 : ((step) / total) * 100;

  const currentAnswer = current ? answers[current.id] : undefined;
  const canNext = current?.multi
    ? Array.isArray(currentAnswer) && currentAnswer.length > 0
    : Boolean(currentAnswer);

  const select = (value: string) => {
    if (!current) return;
    if (current.multi) {
      const prev = (answers[current.id] as string[]) || [];
      const next = prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      setAnswers({ ...answers, [current.id]: next });
    } else {
      setAnswers({ ...answers, [current.id]: value });
    }
  };

  const next = () => {
    if (step < total - 1) {
      setStep(step + 1);
    } else {
      const rec = computeRecommendation(answers);
      setDone(rec);
      onComplete(rec, answers);
    }
  };

  const back = () => setStep(Math.max(0, step - 1));

  const benefits = useMemo(() => (done ? PLAN_BENEFITS[done.plan] : []), [done]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {done ? "Sua recomendação" : "Assistente de Plano"}
          </DialogTitle>
          <DialogDescription>
            {done
              ? "Sugestão baseada apenas nas suas respostas. Nada é cobrado agora."
              : `Pergunta ${step + 1} de ${total}`}
          </DialogDescription>
        </DialogHeader>

        <Progress value={progress} className="h-1" />

        {!done && current && (
          <div className="space-y-4 py-2">
            <p className="text-base font-semibold text-foreground">{current.question}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {current.options.map((opt) => {
                const isSelected = current.multi
                  ? ((answers[current.id] as string[]) || []).includes(opt.value)
                  : answers[current.id] === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => select(opt.value)}
                    className={`text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 text-foreground"
                        : "border-border/60 bg-muted/10 text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </button>
                );
              })}
            </div>
            {current.multi && (
              <p className="text-[11px] text-muted-foreground">Selecione uma ou mais opções.</p>
            )}

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={back} disabled={step === 0} className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Button>
              <Button size="sm" onClick={next} disabled={!canNext} className="gap-1.5">
                {step === total - 1 ? "Ver recomendação" : "Próximo"}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-4 py-2">
            <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-4">
              <Badge variant="default" className="mb-2">Recomendado</Badge>
              <p className="text-2xl font-bold text-foreground">Plano {PLAN_LABEL[done.plan]}</p>
              <p className="text-sm text-muted-foreground mt-1">{PLAN_PITCH[done.plan]}</p>
            </div>

            {done.reasons.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Por que esta sugestão
                </p>
                <ul className="space-y-1.5">
                  {done.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                      <span>Porque {r}.</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Benefícios alinhados
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-foreground">
                    <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  toast.info("Abra a Central de Suporte pelo menu do usuário.");
                }}
                className="gap-1.5"
              >
                <LifeBuoy className="h-3.5 w-3.5" /> Falar com suporte
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Comparar todos os planos
              </Button>
              <Button size="sm" onClick={() => onSeePlan(done.plan)} className="gap-1.5">
                Ver plano recomendado <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
