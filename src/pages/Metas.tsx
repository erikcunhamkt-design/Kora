import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  Target, DollarSign, Users, Briefcase, CheckSquare, TrendingUp,
  Plus, Flame, Trophy, AlertTriangle, BarChart3
} from "lucide-react";

interface Goal {
  id: string;
  title: string;
  type: "faturamento" | "clientes" | "projetos" | "tarefas";
  current: number;
  target: number;
  unit: string;
  prefix: string;
  period: string;
  description: string;
  icon: typeof Target;
  color: string;
  gradient: string;
}

const initialGoals: Goal[] = [
  {
    id: "1", title: "Faturamento Mensal", type: "faturamento",
    current: 6500, target: 10000, unit: "", prefix: "R$",
    period: "Abril 2026", description: "Meta de faturamento bruto mensal",
    icon: DollarSign, color: "text-emerald-400",
    gradient: "from-emerald-500/20 to-emerald-500/5",
  },
  {
    id: "2", title: "Novos Clientes", type: "clientes",
    current: 6, target: 10, unit: "", prefix: "",
    period: "Abril 2026", description: "Conquistar novos clientes no mês",
    icon: Users, color: "text-primary",
    gradient: "from-primary/20 to-primary/5",
  },
  {
    id: "3", title: "Projetos Entregues", type: "projetos",
    current: 7, target: 8, unit: "", prefix: "",
    period: "Abril 2026", description: "Entregar projetos dentro do prazo",
    icon: Briefcase, color: "text-secondary",
    gradient: "from-secondary/20 to-secondary/5",
  },
  {
    id: "4", title: "Tarefas Concluídas", type: "tarefas",
    current: 32, target: 50, unit: "", prefix: "",
    period: "Abril 2026", description: "Concluir tarefas planejadas no mês",
    icon: CheckSquare, color: "text-accent",
    gradient: "from-accent/20 to-accent/5",
  },
  {
    id: "5", title: "Ticket Médio", type: "faturamento",
    current: 2800, target: 3500, unit: "", prefix: "R$",
    period: "Abril 2026", description: "Aumentar o valor médio por projeto",
    icon: TrendingUp, color: "text-amber-400",
    gradient: "from-amber-500/20 to-amber-500/5",
  },
  {
    id: "6", title: "Taxa de Conversão", type: "clientes",
    current: 65, target: 80, unit: "%", prefix: "",
    period: "Abril 2026", description: "Melhorar conversão de leads em clientes",
    icon: Target, color: "text-pink-400",
    gradient: "from-pink-500/20 to-pink-500/5",
  },
];

function fmt(v: number, prefix: string, unit: string) {
  if (prefix === "R$") return `R$ ${v.toLocaleString("pt-BR")}`;
  return `${v}${unit}`;
}

function statusLabel(pct: number) {
  if (pct >= 100) return { text: "Concluída", cls: "text-emerald-400 bg-emerald-400/10" };
  if (pct >= 75) return { text: "No caminho", cls: "text-emerald-400 bg-emerald-400/10" };
  if (pct >= 50) return { text: "Atenção", cls: "text-amber-400 bg-amber-400/10" };
  return { text: "Em risco", cls: "text-destructive bg-destructive/10" };
}

const goalTypes = [
  { value: "faturamento", label: "Faturamento" },
  { value: "clientes", label: "Clientes" },
  { value: "projetos", label: "Projetos" },
  { value: "tarefas", label: "Tarefas" },
];

const Metas = () => {
  const [goals, setGoals] = useState(initialGoals);
  const [dialogOpen, setDialogOpen] = useState(false);

  const completed = goals.filter((g) => Math.round((g.current / g.target) * 100) >= 100).length;
  const atRisk = goals.filter((g) => Math.round((g.current / g.target) * 100) < 50).length;
  const avgPerf = Math.round(goals.reduce((s, g) => s + (g.current / g.target) * 100, 0) / goals.length);

  const handleNew = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const type = fd.get("type") as Goal["type"];
    const isFinancial = type === "faturamento";
    const newGoal: Goal = {
      id: Date.now().toString(),
      title: fd.get("title") as string,
      type,
      current: 0,
      target: Number(fd.get("target")),
      unit: isFinancial ? "" : "",
      prefix: isFinancial ? "R$" : "",
      period: "Abril 2026",
      description: fd.get("description") as string,
      icon: type === "faturamento" ? DollarSign : type === "clientes" ? Users : type === "projetos" ? Briefcase : CheckSquare,
      color: "text-primary",
      gradient: "from-primary/20 to-primary/5",
    };
    setGoals((p) => [...p, newGoal]);
    setDialogOpen(false);
  };

  const indicators = [
    { label: "Metas Ativas", value: goals.length, icon: Target, color: "text-primary" },
    { label: "Concluídas", value: completed, icon: Trophy, color: "text-emerald-400" },
    { label: "Em Risco", value: atRisk, icon: AlertTriangle, color: "text-destructive" },
    { label: "Desempenho", value: `${avgPerf}%`, icon: BarChart3, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Metas</h1>
          <p className="text-sm text-muted-foreground mt-1">Defina objetivos e acompanhe sua evolução profissional</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="orbit-gradient hover:opacity-90 gap-2"><Plus className="h-4 w-4" /> Nova meta</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Nova Meta</DialogTitle></DialogHeader>
            <form onSubmit={handleNew} className="space-y-4">
              <div><Label>Título</Label><Input name="title" required className="mt-1.5 bg-muted border-border" /></div>
              <div><Label>Tipo</Label>
                <Select name="type" defaultValue="faturamento">
                  <SelectTrigger className="mt-1.5 bg-muted border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {goalTypes.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor Alvo</Label><Input name="target" type="number" required className="mt-1.5 bg-muted border-border" /></div>
              <div><Label>Descrição</Label><Textarea name="description" className="mt-1.5 bg-muted border-border" /></div>
              <DialogFooter><Button type="submit" className="orbit-gradient hover:opacity-90">Criar Meta</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {indicators.map((ind) => {
          const Icon = ind.icon;
          return (
            <div key={ind.label} className="orbit-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted"><Icon className={`h-5 w-5 ${ind.color}`} /></div>
              <div>
                <p className="text-xs text-muted-foreground">{ind.label}</p>
                <p className="text-lg font-bold text-foreground">{ind.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Goal Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {goals.map((goal) => {
          const pct = Math.min(Math.round((goal.current / goal.target) * 100), 100);
          const status = statusLabel(pct);
          const Icon = goal.icon;
          return (
            <div key={goal.id} className="orbit-card p-5 hover:orbit-glow transition-all duration-300 group">
              <div className={`absolute inset-0 rounded-xl bg-gradient-to-br ${goal.gradient} opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
              <div className="relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted"><Icon className={`h-5 w-5 ${goal.color}`} /></div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{goal.title}</h3>
                      <p className="text-xs text-muted-foreground">{goal.period}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.text}</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-2xl font-bold text-foreground">{fmt(goal.current, goal.prefix, goal.unit)}</span>
                  <span className="text-sm text-muted-foreground">/ {fmt(goal.target, goal.prefix, goal.unit)}</span>
                </div>
                <Progress value={pct} className="h-2 bg-muted mt-3" />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-muted-foreground">{pct}% concluído</span>
                  {pct >= 75 && <Flame className="h-4 w-4 text-amber-400 animate-pulse" />}
                </div>
                {goal.description && <p className="text-xs text-muted-foreground mt-3 border-t border-border pt-3">{goal.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Metas;
