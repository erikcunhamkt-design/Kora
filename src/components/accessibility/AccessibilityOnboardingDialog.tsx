import React, { useState } from "react";
import { useAccessibility, type AccessibilitySettings } from "@/contexts/AccessibilityContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Eye,
  Brain,
  Sparkles,
  Zap,
  Activity,
  Maximize2,
  Palette,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const AccessibilityOnboardingDialog: React.FC = () => {
  const { settings, updateSetting, hasCompletedOnboarding, completeOnboarding } = useAccessibility();
  const [open, setOpen] = useState(!hasCompletedOnboarding);

  const handleToggle = (key: keyof AccessibilitySettings, value: boolean) => {
    updateSetting(key, value);
  };

  const handleDaltonismChange = (val: AccessibilitySettings["daltonism"]) => {
    updateSetting("daltonism", val);
  };

  const handleSave = () => {
    completeOnboarding();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) handleSave();
    }}>
      <DialogContent className="sm:max-w-[620px] bg-card/95 border-border/40 backdrop-blur-md max-h-[85vh] overflow-y-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary animate-pulse" />
            <span>Kora para Todos</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs leading-relaxed">
            Personalize a experiência do Kora Hub de acordo com o funcionamento da sua mente ou necessidade visual. Todas as opções podem ser alteradas depois nas Configurações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Deficiência Visual */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              settings.lowVision ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-sky-400" />
                  <span className="text-xs font-semibold">Problema de Visão</span>
                </div>
                <Switch
                  checked={settings.lowVision}
                  onCheckedChange={(v) => handleToggle("lowVision", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Aumenta a escala do texto da interface e adiciona bordas de alto contraste nítidas em cartões e campos.
              </p>
            </div>

            {/* TDAH */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              settings.adhd ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold">TDAH / Foco</span>
                </div>
                <Switch
                  checked={settings.adhd}
                  onCheckedChange={(v) => handleToggle("adhd", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Desativa transições de tela e efeitos de animação interativos para minimizar distração e sobrecarga mental.
              </p>
            </div>

            {/* Autismo */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              settings.autism ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-semibold">Autismo (TEA)</span>
                </div>
                <Switch
                  checked={settings.autism}
                  onCheckedChange={(v) => handleToggle("autism", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Oculta pop-ups automáticos, modais não solicitados e simplifica saudações em tom de voz literal e previsível.
              </p>
            </div>

            {/* Ansiedade / Depressão */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              settings.anxiety ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-semibold">Reduzir Ansiedade</span>
                </div>
                <Switch
                  checked={settings.anxiety}
                  onCheckedChange={(v) => handleToggle("anxiety", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Suaviza contadores numéricos estressantes e prazos em atraso com um tom de voz acolhedor e cores calmas.
              </p>
            </div>

            {/* Dislexia */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              settings.dyslexia ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-pink-400" />
                  <span className="text-xs font-semibold">Otimizar p/ Dislexia</span>
                </div>
                <Switch
                  checked={settings.dyslexia}
                  onCheckedChange={(v) => handleToggle("dyslexia", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Aumenta o espaçamento de caracteres e ajusta o fundo de texto para uma leitura mais fluida e confortável.
              </p>
            </div>

            {/* Discalculia */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200",
              settings.dyscalculia ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold text-blue-400 tracking-tight">R$</span>
                  <span className="text-xs font-semibold">Otimizar p/ Números</span>
                </div>
                <Switch
                  checked={settings.dyscalculia}
                  onCheckedChange={(v) => handleToggle("dyscalculia", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Habilita arredondamentos de faturamentos (ex: R$ 18.000 em vez de R$ 18.293,42) nos cartões principais.
              </p>
            </div>

            {/* Limitações Motoras */}
            <div className={cn(
              "p-3 rounded-lg border transition-all duration-200 col-span-1 sm:col-span-2",
              settings.motor ? "border-primary/40 bg-primary/[0.02]" : "border-border/50 bg-muted/10 hover:border-border"
            )}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-semibold">Limitações Motoras ( Parkinson / Tremores )</span>
                </div>
                <Switch
                  checked={settings.motor}
                  onCheckedChange={(v) => handleToggle("motor", v)}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                Aumenta as áreas de toque (padding) dos links e botões para cliques fáceis, e adiciona contornos de foco robustos para navegação segura pelo teclado.
              </p>
            </div>
          </div>

          {/* Daltonismo */}
          <div className="p-3.5 rounded-lg border border-border/50 bg-muted/10">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold">Filtros de Daltonismo</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["none", "deuteranopia", "protanopia", "tritanopia"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleDaltonismChange(mode)}
                  className={cn(
                    "px-2.5 py-1.5 text-[10px] font-medium rounded-md border text-center transition-all capitalize",
                    settings.daltonism === mode
                      ? "border-primary bg-primary text-white"
                      : "border-border/80 bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {mode === "none" ? "Nenhum" : mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t border-border/20">
          <Button onClick={handleSave} className="orbit-gradient text-white border-0 w-full sm:w-auto px-6 h-9">
            Salvar e Entrar no Kora
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
