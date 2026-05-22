import { Trophy, Users, Target, Image, Sparkles, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const badges = [
  { icon: Users, label: "Primeiro cliente", earned: true },
  { icon: Target, label: "Meta de receita", earned: false },
  { icon: Image, label: "Portfólio ativo", earned: true },
  { icon: Sparkles, label: "5 propostas", earned: false },
  { icon: Award, label: "10 projetos", earned: false },
];

export function StudioProgress() {
  const progress = 42;
  return (
    <div className="orbit-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            Progresso do estúdio
          </h3>
          <p className="text-sm text-muted-foreground">Conquistas e evolução mensal</p>
        </div>
        <span className="text-2xl font-bold text-foreground">{progress}%</span>
      </div>

      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <p className="text-xs text-muted-foreground">Você completou {progress}% das metas deste mês</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {badges.map((b) => (
          <div
            key={b.label}
            className={`flex flex-col items-center gap-2 p-3 rounded-lg border transition-all ${
              b.earned
                ? "border-primary/40 bg-primary/10"
                : "border-border bg-muted/20 opacity-60"
            }`}
          >
            <div
              className={`h-10 w-10 rounded-full flex items-center justify-center ${
                b.earned ? "bg-primary/20" : "bg-muted/40"
              }`}
            >
              <b.icon className={`h-5 w-5 ${b.earned ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <span className="text-[11px] font-medium text-center text-foreground leading-tight">{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
