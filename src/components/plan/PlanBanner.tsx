import { usePlan } from "@/contexts/plan-context-value";
import { Crown, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function PlanBanner() {
  const { isPro, plan } = usePlan();
  const navigate = useNavigate();

  if (isPro) return null;

  return (
    <button
      onClick={() => navigate("/upgrade")}
      className="w-full flex items-center justify-between p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg orbit-gradient flex items-center justify-center">
          <Crown className="h-4 w-4 text-white" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium text-foreground">Plano Free</p>
          <p className="text-xs text-muted-foreground">Desbloqueie recursos avançados para acelerar seu estúdio</p>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
        <Zap className="h-3 w-3" /> Upgrade
      </div>
    </button>
  );
}
