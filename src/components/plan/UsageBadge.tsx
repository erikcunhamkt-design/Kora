import { usePlan } from "@/contexts/plan-context-value";
import { AlertTriangle, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Props {
  resource: "clients" | "projects" | "tasks" | "leads";
  label: string;
}

const icons: Record<string, string> = {
  clients: "clientes",
  projects: "projetos",
  tasks: "tarefas",
  leads: "leads",
};

export function UsageBadge({ resource, label }: Props) {
  const { isPro, limits, usage } = usePlan();
  const navigate = useNavigate();

  if (isPro) return null;

  const current = usage[resource];
  const max = limits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}` as keyof typeof limits];
  const atLimit = current >= max;

  return (
    <button
      onClick={() => navigate("/upgrade")}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
        atLimit
          ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
          : "border-border bg-muted/50 text-muted-foreground hover:bg-muted"
      }`}
    >
      {atLimit ? <AlertTriangle className="h-3 w-3" /> : <Crown className="h-3 w-3" />}
      {current}/{max === Infinity ? "∞" : max} {label}
    </button>
  );
}
