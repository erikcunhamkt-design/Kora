import { DollarSign, Users, CheckSquare, FileText, TrendingUp } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { CRMPipeline } from "@/components/dashboard/CRMPipeline";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { FinanceSummary } from "@/components/dashboard/FinanceSummary";
import { QuickShortcuts } from "@/components/dashboard/QuickShortcuts";
import { ComingSoon } from "@/components/dashboard/ComingSoon";
import { GreetingHero } from "@/components/dashboard/GreetingHero";
import { DayCenterSummary } from "@/components/dashboard/DayCenterSummary";
import { PlanBanner } from "@/components/plan/PlanBanner";
import { usePlan } from "@/contexts/PlanContext";
import { Crown, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const metrics = [
  { title: "Clientes Ativos", value: "24", change: "+3 novos este mês", changeType: "positive" as const, icon: Users },
  { title: "Leads Abertos", value: "9", change: "4 sem retorno há 3+ dias", changeType: "neutral" as const, icon: TrendingUp },
  { title: "Propostas em Aberto", value: "5", change: "2 aguardando resposta", changeType: "neutral" as const, icon: FileText },
  { title: "Valor Previsto", value: "R$ 18.300", change: "Pipeline ponderado", changeType: "positive" as const, icon: DollarSign },
  { title: "Tarefas Pendentes", value: "8", change: "3 com prazo próximo", changeType: "negative" as const, icon: CheckSquare },
];

function UsageSummary() {
  const { isPro, limits, usage } = usePlan();
  const navigate = useNavigate();

  if (isPro) return null;

  const items = [
    { label: "Clientes", current: usage.clients, max: limits.maxClients },
    { label: "Projetos", current: usage.projects, max: limits.maxProjects },
    { label: "Tarefas", current: usage.tasks, max: limits.maxTasks },
    { label: "Leads", current: usage.leads, max: limits.maxLeads },
  ];

  return (
    <div className="orbit-card p-6 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-[0.9375rem] font-medium text-foreground">Uso do plano Free</span>
        </div>
        <button onClick={() => navigate("/upgrade")} className="text-[0.8125rem] text-primary hover:underline font-medium">
          Upgrade
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((item) => {
          const atLimit = item.current >= item.max;
          return (
            <div key={item.label} className={`p-3.5 rounded-lg border transition-all duration-200 ${atLimit ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/20"}`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {atLimit && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                <span className="text-[0.8125rem] text-muted-foreground uppercase tracking-wider">{item.label}</span>
              </div>
              <p className={`text-xl font-bold ${atLimit ? "text-destructive" : "text-foreground"}`}>
                {item.current}/{item.max === Infinity ? "∞" : item.max}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Dashboard = () => {
  const navigate = useNavigate();



  return (
    <div className="space-y-8">
      {/* 1 — Saudação + próxima melhor ação */}
      <GreetingHero
        nextAction={{
          title: "Responder proposta da Acme Corp",
          reason: "Cliente aguarda retorno há 3 dias — risco de esfriar.",
          cta: "Abrir proposta",
          onClick: () => navigate("/vendas?tab=orcamentos"),
        }}
      />

      <PlanBanner />

      {/* 2 — Métricas principais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 stagger-children">
        {metrics.map((m) => (
          <MetricCard key={m.title} {...m} />
        ))}
      </div>

      {/* 3 — Central do Dia (próxima melhor ação + próximos itens + resumo por categoria) */}
      <DayCenterSummary />

      {/* 4 — Pipeline + financeiro (negócio) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CRMPipeline />
        <FinanceSummary />
      </div>


      {/* Atalhos rápidos */}
      <QuickShortcuts />

      {/* 6 — Insights */}
      <InsightsSection />

      <UsageSummary />

      {/* 7 — Roadmap (discreto, no final) */}
      <ComingSoon />

      <ActivityFeed />
    </div>
  );
};

export default Dashboard;
