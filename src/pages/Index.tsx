import { DollarSign, Users, CheckSquare, FileText, Target, Briefcase } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { CRMPipeline } from "@/components/dashboard/CRMPipeline";
import { GoalsSection } from "@/components/dashboard/GoalsSection";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { InsightsSection } from "@/components/dashboard/InsightsSection";
import { TodayTasks } from "@/components/dashboard/TodayTasks";
import { FinanceSummary } from "@/components/dashboard/FinanceSummary";

const metrics = [
  { title: "Faturamento do Mês", value: "R$ 12.450", change: "+12% vs mês anterior", changeType: "positive" as const, icon: DollarSign },
  { title: "Clientes Ativos", value: "24", change: "+3 novos este mês", changeType: "positive" as const, icon: Users },
  { title: "Tarefas Pendentes", value: "8", change: "3 com prazo próximo", changeType: "negative" as const, icon: CheckSquare },
  { title: "Propostas em Andamento", value: "5", change: "2 aguardando resposta", changeType: "neutral" as const, icon: FileText },
  { title: "Meta Mensal", value: "78%", change: "R$ 3.550 restantes", changeType: "positive" as const, icon: Target },
  { title: "Projetos no Portfólio", value: "16", change: "+2 este mês", changeType: "positive" as const, icon: Briefcase },
];

const Dashboard = () => (
  <div className="space-y-6">
    {/* Metric Cards */}
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {metrics.map((m) => (
        <MetricCard key={m.title} {...m} />
      ))}
    </div>

    {/* Insights */}
    <InsightsSection />

    {/* Finance + Goals */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <FinanceSummary />
      <GoalsSection />
    </div>

    {/* Chart + Today Tasks */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <PerformanceChart />
      <TodayTasks />
    </div>

    {/* CRM Pipeline */}
    <CRMPipeline />

    {/* Activity Feed */}
    <ActivityFeed />
  </div>
);

export default Dashboard;
