import { DollarSign, Users, CheckSquare, FileText, Target, Briefcase } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { CRMPipeline } from "@/components/dashboard/CRMPipeline";
import { GoalsSection } from "@/components/dashboard/GoalsSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { TodayTasks } from "@/components/dashboard/TodayTasks";
import { FinanceSummary } from "@/components/dashboard/FinanceSummary";
import { PlanBanner } from "@/components/plan/PlanBanner";
import { PageHeader } from "@/components/layout/PageHeader";
import { usePlan } from "@/contexts/PlanContext";
import { Crown, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const metrics = [
  { title: "Faturamento do Mês", value: "R$ 12.450", change: "+12% vs mês anterior", changeType: "positive" as const, icon: DollarSign },
  { title: "Clientes Ativos", value: "24", change: "+3 novos este mês", changeType: "positive" as const, icon: Users },
  { title: "Tarefas Pendentes", value: "8", change: "3 com prazo próximo", changeType: "negative" as const, icon: CheckSquare },
  { title: "Propostas em Andamento", value: "5", change: "2 aguardando resposta", changeType: "neutral" as const, icon: FileText },
  { title: "Meta Mensal", value: "78%", change: "R$ 3.550 restantes", changeType: "positive" as const, icon: Target },
  { title: "Projetos no Portfólio", value: "16", change: "+2 este mês", changeType: "positive" as const, icon: Briefcase },
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

const Dashboard = () => (
  <div className="space-y-6">
    <PageHeader title="Dashboard" subtitle="Visão geral do seu negócio" />
    <PlanBanner />


    {/* Metric Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
      {metrics.map((m) => (
        <MetricCard key={m.title} {...m} />
      ))}
    </div>

    <UsageSummary />

    <InsightsSection />

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FinanceSummary />
      <GoalsSection />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PerformanceChart />
      <TodayTasks />
    </div>

    <CRMPipeline />

    <ActivityFeed />
  </div>
);

export default Dashboard;
